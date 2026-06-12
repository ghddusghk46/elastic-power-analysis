import csv
import json
from pathlib import Path
from urllib import request
from urllib.error import HTTPError


ES_URL = "http://localhost:9200"
INDEX_NAME = "power-analysis-v1"
DATA_ROOT = Path(__file__).resolve().parent / "data"
BULK_SIZE = 100


LOCATION_MAP = {
    "1": "\uc21c\ucc9c",
    "2": "\ubaa9\ud3ec",
    "3": "\uc5ec\uc218",
    "4": "\uad11\uc591",
    "5": "\ub098\uc8fc",
}

MEMBER_MAP = {
    "1": "1\uc778",
    "2": "2~3\uc778",
    "3": "4\uc778 \uc774\uc0c1",
}

JOB_MAP = {
    "1": "\uc678\ubc8c\uc774",
    "2": "\ub9de\ubc8c\uc774",
    "3": "\ub178\ub839/\uc0c1\uc8fc/\ubb34\uc9c1",
}

HOUSE_TYPE_MAP = {
    "1": "\ub2e8\ub3c5\uc8fc\ud0dd",
    "2": "\uc544\ud30c\ud2b8",
    "3": "\ube4c\ub77c",
}

HOUSE_AREA_MAP = {
    "1": "80m\u00b2 \uc774\ud558",
    "2": "116m\u00b2 \uc774\ud558",
    "3": "116m\u00b2 \ucd08\uacfc",
}

INDUSTRY_MAP = {
    "1": "\ub18d/\uc784/\uc5b4\uc5c5",
    "2": "\uc219\ubc15/\uc74c\uc2dd\uc810\uc5c5",
    "3": "\uc81c\uc870\uc5c5",
    "4": "\ub3c4/\uc18c\ub9e4\uc5c5",
}

WORK_NO_MAP = {
    "1": "1~30\uc778",
    "2": "31~50\uc778",
    "3": "50\uc778 \ucd08\uacfc",
}

WORK_HOUR_MAP = {
    "1": "\uc8fc\uac04",
    "2": "\uc57c\uac04",
    "3": "\uc8fc/\uc57c\uac04",
}


INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "memberID": {"type": "keyword"},
            "targetType": {"type": "keyword"},
            "datasetSplit": {"type": "keyword"},
            "sourceFolder": {"type": "keyword"},
            "labelFolder": {"type": "keyword"},
            "location": {"type": "integer"},
            "locationName": {"type": "keyword"},
            "avgPwrQrt": {"type": "double"},
            "sumPwrQrt": {"type": "double"},
            "maxPwrQrt": {"type": "double"},
            "dataCount": {"type": "integer"},
            "memberNo": {"type": "integer"},
            "memberNoName": {"type": "keyword"},
            "jobType": {"type": "integer"},
            "jobTypeName": {"type": "keyword"},
            "houseType": {"type": "integer"},
            "houseTypeName": {"type": "keyword"},
            "houseArea": {"type": "integer"},
            "houseAreaName": {"type": "keyword"},
            "covidEffect": {"type": "integer"},
            "covidPeriod": {"type": "integer"},
            "indusKind": {"type": "integer"},
            "indusKindName": {"type": "keyword"},
            "workNo": {"type": "integer"},
            "workNoName": {"type": "keyword"},
            "workHour": {"type": "integer"},
            "workHourName": {"type": "keyword"},
        }
    }
}


def es_request(method, path, body=None):
    data = None
    headers = {}

    if body is not None:
        if isinstance(body, str):
            data = body.encode("utf-8")
            headers["Content-Type"] = "application/x-ndjson"
        else:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"

    req = request.Request(f"{ES_URL}{path}", data=data, headers=headers, method=method)

    try:
        with request.urlopen(req) as res:
            text = res.read().decode("utf-8")
            return res.status, json.loads(text) if text else {}
    except HTTPError as error:
        text = error.read().decode("utf-8")
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = {"error": text}
        return error.code, payload


def to_int(value):
    if value is None or value == "":
        return None
    try:
        return int(float(str(value).strip()))
    except ValueError:
        return None


def read_labels(label_path):
    labels = {}

    for encoding in ("utf-8-sig", "cp949"):
        try:
            with label_path.open("r", encoding=encoding, newline="") as file:
                reader = csv.DictReader(file)
                for row in reader:
                    key = (row.get("QITM_EN") or "").strip()
                    value = (row.get("RSPNS_CN") or "").strip()
                    if key:
                        labels[key] = value
            return labels
        except UnicodeDecodeError:
            labels = {}
            continue

    raise UnicodeDecodeError("utf-8-sig/cp949", b"", 0, 1, f"cannot decode {label_path}")

    return labels


def read_usage_stats(source_path):
    total = 0.0
    max_value = None
    count = 0

    with source_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            raw_value = row.get("pwrQrt")
            if raw_value is None or raw_value == "":
                continue

            try:
                value = float(raw_value)
            except ValueError:
                continue

            total += value
            max_value = value if max_value is None else max(max_value, value)
            count += 1

    if count == 0:
        return None

    return {
        "sumPwrQrt": total,
        "maxPwrQrt": max_value,
        "avgPwrQrt": total / count,
        "dataCount": count,
    }


def folder_location(folder_name):
    for code, location_name in LOCATION_MAP.items():
        if f"_{code}." in folder_name:
            return code, location_name
    return None, None


def iter_source_label_pairs():
    splits = [
        ("Training", "TS", "TL"),
        ("Validation", "VS", "VL"),
    ]

    for split_name, source_prefix, label_prefix in splits:
        source_root = DATA_ROOT / split_name / "01.source"
        label_root = DATA_ROOT / split_name / "02.label"

        if not source_root.exists() or not label_root.exists():
            continue

        for source_dir in source_root.iterdir():
            if not source_dir.is_dir():
                continue
            if "weatherdata" in source_dir.name.lower():
                continue
            if "(2)" in source_dir.name:
                continue

            label_dir_name = source_dir.name.replace(source_prefix, label_prefix, 1)
            label_dir = label_root / label_dir_name
            if not label_dir.exists():
                print(f"skip missing label folder: {label_dir}")
                continue

            target_type = "\uae30\uc5c5" if "industry" in source_dir.name else "\uac00\uad6c"

            for source_path in source_dir.glob("*.csv"):
                label_path = label_dir / source_path.name
                if not label_path.exists():
                    print(f"skip missing label file: {label_path}")
                    continue

                yield split_name, target_type, source_dir, label_dir, source_path, label_path


def add_code_fields(doc, labels, source_folder):
    location = labels.get("location")
    if not location:
        location, location_name = folder_location(source_folder.name)
    else:
        location_name = LOCATION_MAP.get(location)

    doc["location"] = to_int(location)
    doc["locationName"] = location_name

    member_no = labels.get("memberNo")
    job_type = labels.get("jobType")
    house_type = labels.get("houseType")
    house_area = labels.get("houseArea")
    covid_effect = labels.get("covidEffect")
    covid_period = labels.get("covidPeriod")
    indus_kind = labels.get("indusKind")
    work_no = labels.get("workNo")
    work_hour = labels.get("workHour")

    doc["memberNo"] = to_int(member_no)
    doc["memberNoName"] = MEMBER_MAP.get(member_no)
    doc["jobType"] = to_int(job_type)
    doc["jobTypeName"] = JOB_MAP.get(job_type)
    doc["houseType"] = to_int(house_type)
    doc["houseTypeName"] = HOUSE_TYPE_MAP.get(house_type)
    doc["houseArea"] = to_int(house_area)
    doc["houseAreaName"] = HOUSE_AREA_MAP.get(house_area)
    doc["covidEffect"] = to_int(covid_effect)
    doc["covidPeriod"] = to_int(covid_period)

    doc["indusKind"] = to_int(indus_kind)
    doc["indusKindName"] = INDUSTRY_MAP.get(indus_kind)
    doc["workNo"] = to_int(work_no)
    doc["workNoName"] = WORK_NO_MAP.get(work_no)
    doc["workHour"] = to_int(work_hour)
    doc["workHourName"] = WORK_HOUR_MAP.get(work_hour)


def ensure_index():
    status, _ = es_request("HEAD", f"/{INDEX_NAME}")
    if status == 200:
        print(f"index already exists: {INDEX_NAME}")
        return

    status, payload = es_request("PUT", f"/{INDEX_NAME}", INDEX_MAPPING)
    if status >= 300:
        raise RuntimeError(f"failed to create index: {status} {payload}")

    print(f"created index: {INDEX_NAME}")


def flush_bulk(actions):
    if not actions:
        return

    lines = []
    for action, doc in actions:
        lines.append(json.dumps(action, ensure_ascii=False))
        lines.append(json.dumps(doc, ensure_ascii=False))

    status, payload = es_request("POST", "/_bulk", "\n".join(lines) + "\n")
    if status >= 300 or payload.get("errors"):
        raise RuntimeError(f"bulk failed: {status} {json.dumps(payload, ensure_ascii=False)[:2000]}")


def build_index():
    ensure_index()

    actions = []
    total_docs = 0
    target_counts = {}
    split_counts = {}

    for split_name, target_type, source_dir, label_dir, source_path, label_path in iter_source_label_pairs():
        member_id = source_path.stem
        labels = read_labels(label_path)
        stats = read_usage_stats(source_path)

        if not stats:
            print(f"skip empty usage: {source_path}")
            continue

        doc = {
            "memberID": member_id,
            "targetType": target_type,
            "datasetSplit": split_name,
            "sourceFolder": source_dir.name,
            "labelFolder": label_dir.name,
            **stats,
        }

        add_code_fields(doc, labels, source_dir)

        actions.append((
            {"index": {"_index": INDEX_NAME, "_id": member_id}},
            doc,
        ))

        total_docs += 1
        target_counts[target_type] = target_counts.get(target_type, 0) + 1
        split_counts[split_name] = split_counts.get(split_name, 0) + 1

        if len(actions) >= BULK_SIZE:
            flush_bulk(actions)
            actions = []
            print(f"indexed {total_docs:,} docs...")

    flush_bulk(actions)

    es_request("POST", f"/{INDEX_NAME}/_refresh")

    print("done")
    print(f"indexed docs: {total_docs:,}")
    print(f"target counts: {target_counts}")
    print(f"split counts: {split_counts}")


if __name__ == "__main__":
    build_index()
