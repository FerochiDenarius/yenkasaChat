const fs = require('node:fs');

const DEFAULT_ENGINE_URL =
  process.env.YENKASA_AI_ENGINE_URL ||
  'https://yenkasa-ai-backend-496173204476.europe-west1.run.app';
const DEFAULT_ENGINE_API_PREFIX = process.env.YENKASA_AI_ENGINE_API_PREFIX || '';

function buildEngineUrl(path) {
  const base = String(DEFAULT_ENGINE_URL || '').replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPrefix = DEFAULT_ENGINE_API_PREFIX
    ? `/${String(DEFAULT_ENGINE_API_PREFIX).replace(/^\/+|\/+$/g, '')}`
    : '';

  if (!normalizedPrefix || base.endsWith(normalizedPrefix)) {
    return `${base}${normalizedPath}`;
  }

  return `${base}${normalizedPrefix}${normalizedPath}`;
}

function getInternalApiKey() {
  return String(
    process.env.INTERNAL_PLATFORM_API_KEY ||
      process.env.LOG_INGEST_API_KEY ||
      process.env.YENKASA_AI_EVENT_API_KEY ||
      '',
  ).trim();
}

async function parseJsonResponse(response) {
  const rawText = await response.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    return { rawText };
  }
}

async function handleResponse(response, context) {
  const payload = await parseJsonResponse(response);
  if (response.ok) return payload;

  const message =
    payload?.detail ||
    payload?.message ||
    payload?.rawText ||
    `${context} failed with status ${response.status}`;

  const error = new Error(message);
  error.status = response.status;
  error.payload = payload;
  throw error;
}

async function chat({ question, history = [], audience = 'public', includeDebug = false }) {
  const response = await fetch(buildEngineUrl('/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      history,
      audience,
      include_debug: includeDebug
    })
  });

  return handleResponse(response, 'AI chat');
}

async function search({ question, audience = 'public', topK = 4 }) {
  const response = await fetch(buildEngineUrl('/search'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      audience,
      top_k: topK
    })
  });

  return handleResponse(response, 'AI knowledge search');
}

async function ingest({ files, audience = 'public' }) {
  const formData = new FormData();

  for (const file of files) {
    const blob = await fs.openAsBlob(file.path, { type: file.mimetype || 'application/octet-stream' });
    formData.append('files', blob, file.originalname);
  }

  const headers = {};
  const apiKey = getInternalApiKey();
  if (apiKey) {
    headers['X-Event-Api-Key'] = apiKey;
  }

  const response = await fetch(`${buildEngineUrl('/ingest')}?audience=${encodeURIComponent(audience)}`, {
    method: 'POST',
    headers,
    body: formData
  });

  return handleResponse(response, 'AI knowledge ingest');
}

async function health() {
  const response = await fetch(buildEngineUrl('/health'));
  return handleResponse(response, 'AI health');
}

async function ingestJobs() {
  const response = await fetch(buildEngineUrl('/ingest/jobs'));
  if (response.status === 404 || response.status === 405) {
    return {
      jobs: [],
      version: 0,
      unsupported: true,
    };
  }
  return handleResponse(response, 'AI ingest jobs');
}

module.exports = {
  name: 'fastapi_rag',
  chat,
  search,
  ingest,
  health,
  ingestJobs
};
