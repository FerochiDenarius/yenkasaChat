const DEFAULT_API_BASE = "https://yenkasa-ai-496173204476.europe-west1.run.app";

const API_BASE = (import.meta.env.VITE_AI_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
const SUPPORTS_INGEST_JOBS = /\/api\/ai$/i.test(API_BASE);

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

  const payload = await parseResponse(response);
  return {
    ...payload,
    accepted: payload?.accepted ?? payload?.accepted_files ?? 0,
    targetCollection: payload?.targetCollection ?? payload?.target_collection ?? "yenkasa_research",
    chunksInserted: payload?.chunksInserted ?? payload?.chunks_inserted ?? null,
    uploadedToGcs: payload?.uploadedToGcs ?? payload?.uploaded_to_gcs ?? null,
  };
}

export async function fetchIngestionJobs() {
  if (!SUPPORTS_INGEST_JOBS) {
    return { jobs: [], version: 0 };
  }
  const response = await fetch(buildUrl("/ingest/jobs"));
  return parseResponse(response);
}

export function subscribeToIngestionJobs({ onMessage, onError } = {}) {
  if (!SUPPORTS_INGEST_JOBS || typeof window === "undefined" || typeof window.EventSource === "undefined") {
    return null;
  }

  const eventSource = new window.EventSource(buildUrl("/ingest/jobs/stream"));

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onMessage?.(payload);
    } catch (error) {
      onError?.(error);
    }
  };

  eventSource.onerror = (error) => {
    onError?.(error);
  };

  return eventSource;
}

export async function fetchAiSystemStatus() {
  const response = await fetch(buildUrl("/health"));
  return parseResponse(response);
}

export function supportsIngestionJobs() {
  return SUPPORTS_INGEST_JOBS;
}
