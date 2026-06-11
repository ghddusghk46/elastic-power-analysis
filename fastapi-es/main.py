from fastapi import FastAPI
from elasticsearch import Elasticsearch
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

es = Elasticsearch(["http://localhost:9200"])

@app.get("/health")
def health_check():
    return {
        "api": "ok",
        "elasticsearch": es.ping()
    }

@app.get("/member/{member_id}")
def get_member(member_id: str):

    query = {
        "query": {
            "term": {
                "memberID": member_id
            }
        },
        "size": 100
    }

    result = es.search(index = "power-label-v1", body=query)

    labels = []

    for hit in result["hits"]["hits"]:
        source = hit["_source"]
        labels.append({
            "question": source.get("QITM_CN"),
            "field": source.get("QITM_EN"),
            "answer": source.get("RSPNS_CN")
        })


    return {
        "memberID": member_id,
        "count": len(labels),
        "labels": labels
    }

@app.get("/member/{member_id}/usage")
def get_member_usage(member_id: str):
    query = {
        "query": {
            "term": {
                "memberID": member_id
            }
        },
        "sort": [
            {"mrdDt": {"order": "asc"}}
        ],
        "size": 24
    }

    result = es.search(index="power-usage-v2", body = query)

    usage = []

    for hit in result["hits"]["hits"]:
        source = hit["_source"]
        usage.append({
            "time": source.get("mrdDt"),
            "usage": source.get("pwrQrt")
        })

    return {
        "memberID": member_id,
        "count": len(usage),
        "usage": usage
    }

@app.get("/", response_class = HTMLResponse)
def home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
    <meat charset="UTF-8>
    <title> 전력 사용량 조회 </title>
    </head>
    <body>
        <h1>전력 사용량 조회</h1>

        <input id="memberId" value="1410100001" />
        <button onclick="loadData()">조회</button>

        <h2>설문 정보</h2>
        <pre id="profile"></pre>

        <h2>전력 사용량</h2>
        <pre id="usage"></pre>

        <script>
            async function loadData() {
                const memberId = document.getElementById("memberId").value;

                const memberRes = await fetch(`/member/${memberId}`);
                const memberData = await memberRes.json();

                const usageRes = await fetch(`/member/${memberId}/usage`);
                const usageData = await usageRes.json();

                document.getElementById("profile").textContent =
                    JSON.stringify(memberData, null, 2);

                document.getElementById("usage").textContent =
                    JSON.stringify(usageData, null, 2);
            }
        </script>
    </body>
    </html>
    """