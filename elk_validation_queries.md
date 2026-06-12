# ELK Validation Queries

This document contains Kibana Dev Tools queries used to validate the ELK data flow.

## 1. List Indices

```json
GET _cat/indices?v
```

## 2. Check Current Analysis Index

```json
GET power-analysis-current/_count
```

## 3. Check Current Kibana Summary Index

```json
GET power-kibana-summary-current/_count
```

## 4. Check Household and Business Counts

```json
GET power-analysis-current/_search
{
  "size": 0,
  "aggs": {
    "target_counts": {
      "terms": {
        "field": "targetType",
        "size": 10
      }
    }
  }
}
```

## 5. Check Location Counts

```json
GET power-analysis-current/_search
{
  "size": 0,
  "aggs": {
    "location_counts": {
      "terms": {
        "field": "locationName",
        "size": 10
      }
    }
  }
}
```

## 6. Check Summary Charts

```json
GET power-kibana-summary-current/_search
{
  "size": 0,
  "aggs": {
    "themes": {
      "terms": {
        "field": "theme",
        "size": 20
      }
    },
    "charts": {
      "terms": {
        "field": "chartName",
        "size": 30
      }
    }
  }
}
```

## 7. Check Question Logs

```json
GET power-question-log-v1/_count
```

## 8. Check Question Success Counts

```json
GET power-question-log-v1/_search
{
  "size": 0,
  "aggs": {
    "success_counts": {
      "terms": {
        "field": "success",
        "size": 10
      }
    }
  }
}
```

## 9. Check Average Response Time by Theme

```json
GET power-question-log-v1/_search
{
  "size": 0,
  "aggs": {
    "by_theme": {
      "terms": {
        "field": "theme",
        "size": 20
      },
      "aggs": {
        "avg_response_time": {
          "avg": {
            "field": "responseTimeMs"
          }
        }
      }
    }
  }
}
```

## 10. Check Alias Targets

```json
GET _alias/power-analysis-current
```

```json
GET _alias/power-kibana-summary-current
```
