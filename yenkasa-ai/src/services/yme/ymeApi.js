const DEFAULT_API_BASE = "/api/yme";

const API_BASE = (import.meta.env.VITE_YME_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function getAuthHeaders() {
  const token = window.localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.message || payload?.error || payload?.detail || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function requestJson(path, { method = "GET", params, body } = {}) {
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return parseResponse(response);
}

export function searchYmeUsers(query, limit = 8) {
  return requestJson("/admin/users/search", { params: { q: query, limit } });
}

export function fetchYmeInspectorOverview({ userId = "", query = "", limit = 30 } = {}) {
  return requestJson("/admin/inspector", { params: { userId, query, limit } });
}

export function fetchYmeProfile(userId) {
  return requestJson(`/profile/${encodeURIComponent(userId)}`);
}

export function fetchYmeEvents(params = {}) {
  return requestJson("/admin/events", { params });
}

export function fetchYmeLogs(params = {}) {
  return requestJson("/admin/logs", { params });
}

export function fetchYmeMetrics() {
  return requestJson("/admin/metrics");
}

export function fetchYmeQueueHealth() {
  return requestJson("/admin/queue-health");
}

export function fetchYmeEmbeddings(params = {}) {
  return requestJson("/admin/embeddings", { params });
}

export function fetchYmeFailedEmbeddings(params = {}) {
  return requestJson("/admin/failed-embeddings", { params });
}

export function fetchYmeRetrievalInspect({ userId, query = "", limit = 12 }) {
  return requestJson("/admin/retrieve-inspect", {
    method: "POST",
    body: { userId, query, limit },
  });
}
