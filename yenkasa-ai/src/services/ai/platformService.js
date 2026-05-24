const DEFAULT_API_BASE = import.meta.env.PROD
  ? "/api/yenkasa-ai"
  : "http://localhost:8008/api/ai";

const API_BASE = (import.meta.env.VITE_AI_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

function buildUrl(path) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.detail || payload?.error || `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

export async function queryAssistant({ question, history = [], audience = "public" }) {
  const response = await fetch(buildUrl("/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      history: history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      audience,
    }),
  });

  return parseResponse(response);
}

export async function enqueueKnowledgeFiles(files = []) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(buildUrl("/ingest"), {
    method: "POST",
    body: formData,
  });

  return parseResponse(response);
}

export async function fetchIngestionJobs() {
  const response = await fetch(buildUrl("/ingest/jobs"));
  return parseResponse(response);
}

export async function fetchAiSystemStatus() {
  const response = await fetch(buildUrl("/health"));
  return parseResponse(response);
}
