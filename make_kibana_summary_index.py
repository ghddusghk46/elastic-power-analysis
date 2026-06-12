import json
from statistics import median
from urllib import request
from urllib.error import HTTPError


ES_URL = "http://localhost:9200"
SOURCE_INDEX = "power-analysis-v1"
TARGET_INDEX = "power-kibana-summary-v1"


INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "theme": {"type": "keyword"},
            "chartName": {"type": "keyword"},
            "targetType": {"type": "keyword"},
            "dimension": {"type": "keyword"},
            "groupName": {"type": "keyword"},
            "metricName": {"type": "keyword"},
            "metricValue": {"type": "double"},
            "docCount": {"type": "integer"},
        }
    }
}


def es_request(method, path, body=None):
    data = None
    headers = {}

    if body is not None:
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


def fetch_all_docs():
    status, payload = es_request(
        "POST",
        f"/{SOURCE_INDEX}/_search?scroll=2m",
        {
            "size": 1000,
            "_source": [
                "targetType",
                "locationName",
                "avgPwrQrt",
                "maxPwrQrt",
                "memberNoName",
                "houseTypeName",
                "houseAreaName",
                "jobTypeName",
                "indusKindName",
                "workNoName",
                "workHourName",
            ],
            "query": {"match_all": {}},
        },
    )

    if status >= 300:
        raise RuntimeError(payload)

    docs = []
    scroll_id = payload.get("_scroll_id")

    while True:
        hits = payload.get("hits", {}).get("hits", [])
        if not hits:
            break

        docs.extend(hit["_source"] for hit in hits)

        status, payload = es_request(
            "POST",
            "/_search/scroll",
            {"scroll": "2m", "scroll_id": scroll_id},
        )
        if status >= 300:
            raise RuntimeError(payload)
        scroll_id = payload.get("_scroll_id")

    return docs


def percentile(values, percent):
    if not values:
        return None

    sorted_values = sorted(values)
    if len(sorted_values) == 1:
        return sorted_values[0]

    rank = (len(sorted_values) - 1) * (percent / 100)
    lower = int(rank)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = rank - lower

    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def add_summary(summary_docs, theme, chart_name, target_type, dimension, group_name, metric_name, metric_value, doc_count):
    if group_name in (None, "") or metric_value is None:
        return

    summary_docs.append(
        {
            "theme": theme,
            "chartName": chart_name,
            "targetType": target_type,
            "dimension": dimension,
            "groupName": str(group_name),
            "metricName": metric_name,
            "metricValue": float(metric_value),
            "docCount": int(doc_count),
        }
    )


def grouped_values(docs, field, target_type=None):
    groups = {}
    for doc in docs:
        if target_type and doc.get("targetType") != target_type:
            continue

        group_name = doc.get(field)
        value = doc.get("avgPwrQrt")

        if group_name in (None, "") or value is None:
            continue

        groups.setdefault(group_name, []).append(float(value))

    return groups


def add_count_chart(summary_docs, docs, theme, chart_name, dimension, field, target_type=None):
    counts = {}
    for doc in docs:
        if target_type and doc.get("targetType") != target_type:
            continue

        group_name = doc.get(field)
        if group_name in (None, ""):
            continue

        counts[group_name] = counts.get(group_name, 0) + 1

    for group_name, count in counts.items():
        add_summary(
            summary_docs,
            theme,
            chart_name,
            target_type or "전체",
            dimension,
            group_name,
            "데이터 수",
            count,
            count,
        )


def add_metric_chart(summary_docs, docs, theme, chart_name, dimension, field, target_type=None, metrics=None):
    metrics = metrics or ["평균", "중앙값"]
    groups = grouped_values(docs, field, target_type)

    for group_name, values in groups.items():
        metric_map = {
            "평균": sum(values) / len(values),
            "중앙값": median(values),
            "p95": percentile(values, 95),
            "p99": percentile(values, 99),
            "최댓값": max(values),
        }

        for metric_name in metrics:
            add_summary(
                summary_docs,
                theme,
                chart_name,
                target_type or "전체",
                dimension,
                group_name,
                metric_name,
                metric_map.get(metric_name),
                len(values),
            )


def add_naju_range_chart(summary_docs, docs):
    ranges = [
        ("0~1 미만", None, 1),
        ("1~5 미만", 1, 5),
        ("5~20 미만", 5, 20),
        ("20~100 미만", 20, 100),
        ("100 이상", 100, None),
    ]

    naju_docs = [
        doc for doc in docs
        if doc.get("locationName") == "나주" and doc.get("avgPwrQrt") is not None
    ]

    for label, lower, upper in ranges:
        count = 0
        for doc in naju_docs:
            value = float(doc["avgPwrQrt"])
            if lower is not None and value < lower:
                continue
            if upper is not None and value >= upper:
                continue
            count += 1

        add_summary(
            summary_docs,
            "이상치 분석",
            "나주 전력 소비 구간별 분포",
            "전체",
            "avgPwrQrt 구간",
            label,
            "데이터 수",
            count,
            count,
        )


def build_summary(docs):
    summary_docs = []

    add_count_chart(summary_docs, docs, "데이터 품질", "수집 대상별 분포", "수집 대상", "targetType")
    add_count_chart(summary_docs, docs, "데이터 품질", "지역별 데이터 분포", "지역", "locationName")
    add_count_chart(summary_docs, docs, "데이터 품질", "구성원 수별 데이터 분포", "구성원 수", "memberNoName", "가구")

    add_metric_chart(summary_docs, docs, "가구 분석", "구성원 수별 평균·중앙값 전력 소비량", "구성원 수", "memberNoName", "가구")
    add_metric_chart(summary_docs, docs, "가구 분석", "주거 형태별 평균·중앙값 전력 소비량", "주거 형태", "houseTypeName", "가구")
    add_metric_chart(summary_docs, docs, "가구 분석", "주거 면적별 평균·중앙값 전력 소비량", "주거 면적", "houseAreaName", "가구")

    add_metric_chart(summary_docs, docs, "기업 분석", "산업 종류별 평균·중앙값 전력 소비량", "산업 종류", "indusKindName", "기업")
    add_metric_chart(summary_docs, docs, "기업 분석", "근무자 수별 평균·중앙값 전력 소비량", "근무자 수", "workNoName", "기업")
    add_metric_chart(summary_docs, docs, "기업 분석", "근무 시간별 평균·중앙값 전력 소비량", "근무 시간", "workHourName", "기업")

    add_metric_chart(summary_docs, docs, "지역 분석", "지역별 평균·중앙값·p95 전력 소비량", "지역", "locationName", None, ["평균", "중앙값", "p95"])
    add_count_chart(summary_docs, docs, "지역 분석", "지역별 데이터 수", "지역", "locationName")

    add_naju_range_chart(summary_docs, docs)
    add_metric_chart(summary_docs, docs, "이상치 분석", "지역별 p99·최댓값 비교", "지역", "locationName", None, ["p99", "최댓값"])
    add_metric_chart(summary_docs, docs, "이상치 분석", "지역별 평균·중앙값 차이", "지역", "locationName", None, ["평균", "중앙값"])

    return summary_docs


def recreate_index():
    status, _ = es_request("HEAD", f"/{TARGET_INDEX}")
    if status == 200:
        es_request("DELETE", f"/{TARGET_INDEX}")

    status, payload = es_request("PUT", f"/{TARGET_INDEX}", INDEX_MAPPING)
    if status >= 300:
        raise RuntimeError(payload)


def bulk_insert(docs):
    lines = []
    for index, doc in enumerate(docs, start=1):
        lines.append(json.dumps({"index": {"_index": TARGET_INDEX, "_id": str(index)}}, ensure_ascii=False))
        lines.append(json.dumps(doc, ensure_ascii=False))

    body = "\n".join(lines) + "\n"
    req = request.Request(
        f"{ES_URL}/_bulk",
        data=body.encode("utf-8"),
        headers={"Content-Type": "application/x-ndjson"},
        method="POST",
    )

    with request.urlopen(req) as res:
        payload = json.loads(res.read().decode("utf-8"))
        if payload.get("errors"):
            raise RuntimeError(json.dumps(payload, ensure_ascii=False)[:2000])

    es_request("POST", f"/{TARGET_INDEX}/_refresh")


if __name__ == "__main__":
    source_docs = fetch_all_docs()
    summary_docs = build_summary(source_docs)
    recreate_index()
    bulk_insert(summary_docs)

    print(f"source docs: {len(source_docs):,}")
    print(f"summary docs: {len(summary_docs):,}")
    print(f"created index: {TARGET_INDEX}")
