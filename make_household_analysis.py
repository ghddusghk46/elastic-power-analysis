from elasticsearch import Elasticsearch, helpers # bulk 등 (helpers 안)

es = Elasticsearch(["http://localhost:9200"])

LABEL_INDEX = "power-label-v1"
USAGE_INDEX = "power-usage-v2"
TARGET_INDEX = "power-household-analysis-v2"

TARGET_FIELDS = {
    "memberNo",
    "houseType",
    "location",
    "covidEffect",
    "houseArea",
    "jobType",
    "airconUsageTime"
}

def parse_aircon_hour(value):
    if not value:
        return 0.0
    try:
        nums = [float(x.strip()) for x in value.split(",")]
        return sum(nums)
    except:
        return 0.0

print("1. 라벨 데이터 읽는 중...")

label_map = {}

query = {
    "_source": ["memberID", "QITM_EN", "RSPNS_CN"],
    "query": {
        "terms": {
            "QITM_EN": list(TARGET_FIELDS)
        }
    }
}

for doc in helpers.scan(es, index=LABEL_INDEX, query=query, size=1000):
    src = doc["_source"]
    member_id = src["memberID"]
    field = src["QITM_EN"]
    value = src["RSPNS_CN"]

    if member_id not in label_map:
        label_map[member_id] = {}

    label_map[member_id][field] = value

print(f"라벨 가구 수: {len(label_map)}")

print("2. 사용량 데이터 memberID별 집계 중...")

usage_query = {
    "_source": ["memberID", "pwrQrt"],
    "query": {
        "match_all": {}
    }
}

stats = {}

count = 0

for doc in helpers.scan(es, index=USAGE_INDEX, query=usage_query, size=5000):
    src = doc["_source"]
    member_id = src["memberID"]
    pwr = float(src.get("pwrQrt", 0))

    if member_id not in stats:
        stats[member_id] = {
            "sumPwrQrt": 0.0,
            "maxPwrQrt": pwr,
            "dataCount": 0
        }

    stats[member_id]["sumPwrQrt"] += pwr
    stats[member_id]["maxPwrQrt"] = max(stats[member_id]["maxPwrQrt"], pwr)
    stats[member_id]["dataCount"] += 1

    count += 1
    if count % 1000000 == 0:
        print(f"{count:,}건 처리 완료")

print(f"사용량 memberID 수: {len(stats)}")

print("3. 분석 인덱스에 적재 중...")

actions = []

for member_id, s in stats.items():
    labels = label_map.get(member_id, {})

    data_count = s["dataCount"]
    avg = s["sumPwrQrt"] / data_count if data_count > 0 else 0

    doc = {
        "memberID": member_id,
        "avgPwrQrt": avg,
        "sumPwrQrt": s["sumPwrQrt"],
        "maxPwrQrt": s["maxPwrQrt"],
        "dataCount": data_count,

        "memberNo": labels.get("memberNo"),
        "houseType": labels.get("houseType"),
        "location": labels.get("location"),
        "covidEffect": labels.get("covidEffect"),
        "houseArea": labels.get("houseArea"),
        "jobType": labels.get("jobType"),

        "airconUsageTime": labels.get("airconUsageTime"),
        "airconUsageHour": parse_aircon_hour(labels.get("airconUsageTime"))
    }

    actions.append({
        "_index": TARGET_INDEX,
        "_id": member_id,
        "_source": doc
    })

    if len(actions) >= 1000:
        helpers.bulk(es, actions)
        actions = []

if actions:
    helpers.bulk(es, actions)

print("완료!")