import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
const ES_URL = process.env.ES_URL || "http://localhost:9200";
const QUESTION_LOG_INDEX =
  process.env.QUESTION_LOG_INDEX || "power-question-log-v1";

let mcpClientPromise;

async function getMcpClient() {
  if (!mcpClientPromise) {
    mcpClientPromise = (async () => {
      const client = new Client({
        name: "elastic-web-backend",
        version: "1.0.0",
      });

      const transport = new StdioClientTransport({
        command: "node",
        args: ["mcp-elastic-server.js"],
        cwd: __dirname,
      });

      await client.connect(transport);
      return client;
    })();
  }

  return mcpClientPromise;
}

function metricValue(bucket, path, fallback = null) {
  return path.reduce((value, key) => value?.[key], bucket) ?? fallback;
}

function getLeader(buckets, metric) {
  const validBuckets = buckets.filter((bucket) => Number.isFinite(bucket[metric]));

  if (validBuckets.length === 0) {
    return null;
  }

  return [...validBuckets].sort((a, b) => b[metric] - a[metric])[0];
}

function buildCompactData(mcpData) {
  const buckets = (mcpData?.buckets || []).map((bucket) => ({
    name: bucket.name,
    count: bucket.doc_count,
    avg: metricValue(bucket, ["avg_usage", "value"]),
    median: metricValue(bucket, ["usage_percentiles", "values", "50.0"]),
    p95: metricValue(bucket, ["usage_percentiles", "values", "95.0"]),
    max: metricValue(bucket, ["max_usage", "value"]),
    stdDeviation: metricValue(bucket, ["usage_stats", "std_deviation"]),
  }));

  return {
    theme: mcpData?.theme,
    totalCount: mcpData?.totalCount,
    totalHouseholds: mcpData?.totalHouseholds,
    leaders: {
      average: getLeader(buckets, "avg"),
      median: getLeader(buckets, "median"),
      p95: getLeader(buckets, "p95"),
    },
    buckets,
  };
}

function cleanOllamaAnswer(text) {
  return String(text || "")
    .replaceAll("\u5343\u74e6\u65f6", "kWh")
    .replaceAll("\u5343\u74e6", "kWh")
    .replaceAll("\u5ea6\u7535", "kWh")
    .trim();
}

async function saveQuestionLog(log) {
  try {
    const response = await fetch(`${ES_URL}/${QUESTION_LOG_INDEX}/_doc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(log),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error(`Question log save failed: ${response.status} ${message}`);
    }
  } catch (error) {
    console.error("Question log save failed:", error);
  }
}

async function askOllama({ question, theme, mcpData }) {
  const compactData = buildCompactData(mcpData);

  const prompt = `
You are a Korean data explainer for a household electricity usage analysis platform.

The JSON below is real aggregated data retrieved from Elasticsearch through an MCP tool.
Answer only from this data. Do not invent missing facts.

Interpretation rules:
- If the user asks for total respondents, total answerers, total question answerers, total households, or total data count, answer with totalCount.
- If the user asks "how many people/households/items", interpret it in the household survey context and use totalCount or bucket counts.
- Use median and p95 when explaining outlier-resistant results.
- If the user asks "without outliers" or "outlier-resistant", prefer leaders.median first, then leaders.p95.
- If the user asks for the simple average, use leaders.average.
- Average can be affected by extreme outliers, especially when max is much larger than median or p95.

Selected theme:
${theme}

User question:
${question}

Aggregated data JSON:
${JSON.stringify(compactData, null, 2)}

Answer rules:
- Answer in Korean.
- Use polite Korean.
- Do not use Chinese characters or Chinese expressions.
- Use units as kWh or kWh/15min only.
- Answer only the question.
- Include numbers when useful.
- Keep it short, 1 to 2 sentences.
- If the question is ambiguous, answer using the most natural interpretation from the data context.
`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        num_predict: 90,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Ollama error ${response.status}: ${message}`);
  }

  const data = await response.json();
  return cleanOllamaAnswer(data.response);
}

app.get("/", (req, res) => {
  res.send("Backend server is running with MCP + Ollama!");
});

app.get("/health", async (req, res) => {
  try {
    const client = await getMcpClient();
    const tools = await client.listTools();

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    const ollamaOk = ollamaResponse.ok;

    res.json({
      api: "ok",
      mcp: "ok",
      ollama: ollamaOk ? "ok" : "error",
      model: OLLAMA_MODEL,
      questionLogIndex: QUESTION_LOG_INDEX,
      tools: tools.tools.map((tool) => tool.name),
    });
  } catch (error) {
    res.status(500).json({
      api: "ok",
      mcp: "error",
      ollama: "unknown",
      error: error.message,
    });
  }
});

app.post("/api/ask", async (req, res) => {
  const startedAt = Date.now();
  const { theme, question } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({
      answer: "\uad81\uae08\ud55c \uc810\uc744 \uba3c\uc800 \uc785\ub825\ud574\uc8fc\uc138\uc694.",
    });
  }

  try {
    const client = await getMcpClient();

    const mcpResult = await client.callTool({
      name: "analyze_power_usage",
      arguments: {
        theme,
        question,
      },
    });

    const text = mcpResult.content?.[0]?.text || "{}";
    const payload = JSON.parse(text);

    const ollamaAnswer = await askOllama({
      question,
      theme,
      mcpData: payload.data,
    });

    const responseTimeMs = Date.now() - startedAt;

    await saveQuestionLog({
      createdAt: new Date().toISOString(),
      theme,
      question,
      answer: ollamaAnswer,
      rawAnswer: payload.answer,
      success: true,
      responseTimeMs,
      model: OLLAMA_MODEL,
      totalCount: payload.data?.totalCount,
      bucketCount: payload.data?.buckets?.length || 0,
    });

    res.json({
      answer: ollamaAnswer,
      rawAnswer: payload.answer,
      data: payload.data,
    });
  } catch (error) {
    console.error(error);

    await saveQuestionLog({
      createdAt: new Date().toISOString(),
      theme,
      question,
      answer: null,
      rawAnswer: null,
      success: false,
      error: error.message,
      responseTimeMs: Date.now() - startedAt,
      model: OLLAMA_MODEL,
    });

    res.status(500).json({
      answer:
        "MCP, Elasticsearch, Ollama \ucc98\ub9ac \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.",
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
