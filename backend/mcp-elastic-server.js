import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const ES_URL = process.env.ES_URL || "http://localhost:9200";
const ANALYSIS_INDEX =
  process.env.ANALYSIS_INDEX || "power-household-analysis-v1";

const THEMES = {
  member: "\uad6c\uc131\uc6d0 \uc218",
  house: "\uc8fc\uac70 \ud615\ud0dc",
  region: "\uc9c0\uc5ed",
};

const locationName = {
  1: "\uc21c\ucc9c",
  2: "\ubaa9\ud3ec",
  3: "\uc5ec\uc218",
  4: "\uad11\uc591",
  5: "\ub098\uc8fc",
  6: "\uc0b0\uc5c5\ub2e8\uc9c0",
};

const themeConfig = {
  [THEMES.member]: {
    field: "memberNoName.keyword",
    label: THEMES.member,
  },
  [THEMES.house]: {
    field: "houseTypeName.keyword",
    label: THEMES.house,
  },
  [THEMES.region]: {
    field: "location",
    label: THEMES.region,
    formatKey: (key) => locationName[key] || `${THEMES.region} ${key}`,
  },
};

function formatNumber(value, digits = 3) {
  return Number(value || 0).toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
  });
}

async function searchElasticsearch(body) {
  const response = await fetch(`${ES_URL}/${ANALYSIS_INDEX}/_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Elasticsearch error ${response.status}: ${message}`);
  }

  return response.json();
}

function normalizeBucket(bucket, config) {
  return {
    key: bucket.key,
    name: config.formatKey ? config.formatKey(bucket.key) : bucket.key,
    doc_count: bucket.doc_count,
    avg_usage: bucket.avg_usage,
    max_usage: bucket.max_usage,
    usage_percentiles: bucket.usage_percentiles,
    usage_stats: bucket.usage_stats,
  };
}

function buildAnswer({ theme, question, totalCount, buckets }) {
  const lines = buckets.map((bucket, index) => {
    const p50 = bucket.usage_percentiles?.values?.["50.0"];
    const p95 = bucket.usage_percentiles?.values?.["95.0"];

    return `${index + 1}. ${bucket.name}: avg ${formatNumber(
      bucket.avg_usage.value
    )} kWh/15min, median ${formatNumber(
      p50
    )} kWh/15min, p95 ${formatNumber(
      p95
    )} kWh/15min, households ${bucket.doc_count.toLocaleString("ko-KR")}`;
  });

  const top = buckets[0];
  const bottom = buckets[buckets.length - 1];

  return [
    `Question: ${question}`,
    "",
    `${theme}: ${totalCount.toLocaleString("ko-KR")} households were aggregated.`,
    top && bottom
      ? `The highest average group is ${top.name}; the lowest average group is ${bottom.name}.`
      : "There is not enough comparable data.",
    "Median and p95 are included to reduce the effect of extreme outliers.",
    "",
    ...lines,
  ].join("\n");
}

async function analyzePowerUsage({ theme, question }) {
  const config = themeConfig[theme] || themeConfig[THEMES.member];

  const result = await searchElasticsearch({
    size: 0,
    aggs: {
      by_theme: {
        terms: {
          field: config.field,
          size: 10,
        },
        aggs: {
          avg_usage: {
            avg: {
              field: "avgPwrQrt",
            },
          },
          max_usage: {
            max: {
              field: "maxPwrQrt",
            },
          },
          usage_percentiles: {
            percentiles: {
              field: "avgPwrQrt",
              percents: [50, 95],
            },
          },
          usage_stats: {
            extended_stats: {
              field: "avgPwrQrt",
            },
          },
          sort_by_avg: {
            bucket_sort: {
              sort: [
                {
                  avg_usage: {
                    order: "desc",
                  },
                },
              ],
            },
          },
        },
      },
    },
  });

  const buckets = result.aggregations.by_theme.buckets.map((bucket) =>
    normalizeBucket(bucket, config)
  );

  return {
    answer: buildAnswer({
      theme: config.label,
      question,
      totalCount: result.hits.total.value,
      buckets,
    }),
    data: {
      theme: config.label,
      totalCount: result.hits.total.value,
      totalHouseholds: result.hits.total.value,
      buckets,
    },
  };
}

const server = new Server(
  {
    name: "elastic-power-mcp",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_power_usage",
        description:
          "Analyze household power usage from Elasticsearch with average, median, p95, max, and count by theme.",
        inputSchema: {
          type: "object",
          properties: {
            theme: {
              type: "string",
              enum: [THEMES.member, THEMES.house, THEMES.region],
            },
            question: {
              type: "string",
            },
          },
          required: ["theme", "question"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "analyze_power_usage") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const result = await analyzePowerUsage(request.params.arguments);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result),
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("elastic-power-mcp server started");
