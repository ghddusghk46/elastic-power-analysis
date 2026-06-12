# Elastic Power Analysis

전력 소비 데이터를 Elasticsearch에 저장하고, React 화면에서 테마별 분석 결과와 자연어 질의응답을 제공하는 전력 소비 패턴 분석 플랫폼입니다.

사용자는 `구성원 수`, `주거 형태`, `지역` 기준으로 전력 사용 패턴을 확인할 수 있고, 질문 검색창에 자연어로 궁금한 점을 입력하면 MCP 도구가 Elasticsearch 데이터를 조회하고 로컬 LLM(Ollama)이 답변을 정리합니다.

## 주요 기능

- 테마별 전력 소비 분석 화면
  - 구성원 수
  - 주거 형태
  - 지역
- 테마별 분석 이미지 표시
- 자연어 질문 입력 및 답변 생성
- MCP 서버를 통한 Elasticsearch 분석 도구 호출
- Ollama 로컬 LLM을 이용한 한국어 답변 생성
- 이상치 영향을 줄이기 위한 중앙값, 95% 분위값, 표준편차 집계
- 사용자 질문 로그를 Elasticsearch 인덱스에 저장
- Kibana에서 질문 로그 대시보드 구성 가능

## 기술 스택

### Frontend

- React
- Vite
- React Router
- CSS

### Backend

- Node.js
- Express
- Model Context Protocol SDK
- Ollama API

### Data / Search

- Elasticsearch 7.10.2
- Logstash
- Kibana

## 시스템 구조

```text
React Frontend
  -> Express Backend (/api/ask)
    -> MCP Client
      -> Custom MCP Server (elastic-power-mcp)
        -> Elasticsearch
    -> Ollama Local LLM
  -> Answer Box
```

질문 로그는 별도 Elasticsearch 인덱스에 저장됩니다.

```text
power-question-log-v1
```

## MCP 구성

이 프로젝트는 외부 MCP 서버가 아니라 직접 만든 로컬 MCP 서버를 사용합니다.

```text
backend/mcp-elastic-server.js
```

MCP 서버 이름:

```text
elastic-power-mcp
```

MCP 도구:

```text
analyze_power_usage
```

이 도구는 선택된 테마에 따라 Elasticsearch의 `power-household-analysis-v1` 인덱스를 집계합니다.

| 테마 | 집계 기준 |
| --- | --- |
| 구성원 수 | `memberNoName.keyword` |
| 주거 형태 | `houseTypeName.keyword` |
| 지역 | `location` |

## Elasticsearch 인덱스

주요 인덱스:

```text
power-usage-v2
power-label-v1
power-household-analysis-v1
power-question-log-v1
```

`power-household-analysis-v1`은 가구별 전력 사용량과 라벨 정보를 합친 분석용 인덱스입니다.

주요 필드:

```text
memberID
avgPwrQrt
sumPwrQrt
maxPwrQrt
dataCount
memberNoName
houseTypeName
location
```

질문 로그 인덱스 `power-question-log-v1`에는 다음 정보가 저장됩니다.

```text
createdAt
theme
question
answer
rawAnswer
success
responseTimeMs
model
totalCount
bucketCount
```

## 이상치 처리

단순 평균은 매우 큰 값의 영향을 받을 수 있기 때문에 Elasticsearch aggregation을 확장해 다음 값을 함께 계산합니다.

- 평균
- 중앙값(p50)
- 95% 분위값(p95)
- 최대값
- 표준편차

사용자가 "이상치 영향 없이" 같은 질문을 하면 평균보다 중앙값과 p95를 우선 참고하도록 구성했습니다.

## 실행 방법

아래 4개가 실행되어야 전체 기능을 사용할 수 있습니다.

### 1. Elasticsearch 실행

```powershell
cd C:\elastic\elasticsearch-7.10.2\bin
.\elasticsearch.bat
```

확인:

```text
http://localhost:9200
```

### 2. Ollama 실행

모델이 없다면 먼저 다운로드합니다.

```powershell
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull qwen2.5:3b
```

실행:

```powershell
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" run qwen2.5:3b
```

Ollama API 확인:

```text
http://localhost:11434
```

### 3. Backend 실행

```powershell
cd C:\elastic\backend
npm install
npm run dev
```

확인:

```text
http://localhost:4000/health
```

정상 예시:

```json
{
  "api": "ok",
  "mcp": "ok",
  "ollama": "ok",
  "model": "qwen2.5:3b",
  "questionLogIndex": "power-question-log-v1",
  "tools": ["analyze_power_usage"]
}
```

### 4. Frontend 실행

```powershell
cd C:\elastic\frontend
npm install
npm run dev
```

접속:

```text
http://localhost:5173
```

## Kibana 활용

Kibana 접속:

```text
http://localhost:5601
```

추천 대시보드:

- 테마별 질문 수
- 테마별 평균 응답 시간
- 질문 성공/실패 비율
- 시간대별 질문 추이

질문 로그 데이터 뷰:

```text
power-question-log-v1
```

시간 필드:

```text
createdAt
```

## 프로젝트 구조

```text
C:\elastic
├─ backend
│  ├─ server.js
│  ├─ mcp-elastic-server.js
│  └─ package.json
├─ frontend
│  ├─ src
│  │  ├─ App.jsx
│  │  ├─ App.css
│  │  └─ pages
│  │     ├─ Home.jsx
│  │     └─ search.jsx
│  └─ public
│     ├─ images
│     └─ fonts
├─ fastapi-es
├─ make_household_analysis.py
├─ training_source.conf
├─ training_label.conf
├─ validation_source.conf
└─ validation_label.conf
```

## 향후 개선 방향

- 시간대별 전력 사용 패턴 분석 추가
- 질문 의도 분류 고도화
- 로컬 LLM LoRA 파인튜닝
- 질문 로그 기반 사용자 관심 테마 분석
- 이상치 제거 기준을 사용자가 선택할 수 있도록 개선


## ELK 운영 구성

- Index Template을 사용해 power-analysis-* 분석 인덱스의 필드 타입을 고정했습니다.
- Alias를 사용해 power-analysis-current와 power-kibana-summary-current가 현재 운영 인덱스를 가리키도록 구성했습니다.
- Logstash pipeline 설정은 logstash-pipelines/ 디렉터리에서 관리합니다.
- Python 분석 스크립트 make_power_analysis_index.py로 source 전력량과 label 정보를 결합해 power-analysis-v1 통합 분석 인덱스를 생성합니다.
- Python 요약 스크립트 make_kibana_summary_index.py로 Kibana 시각화용 power-kibana-summary-v1 인덱스를 생성합니다.
- 질문 로그는 power-question-log-v1에 저장해 서비스 사용 현황과 응답 시간을 모니터링합니다.
- 운영 검증 쿼리는 elk_validation_queries.md에 정리했습니다.
