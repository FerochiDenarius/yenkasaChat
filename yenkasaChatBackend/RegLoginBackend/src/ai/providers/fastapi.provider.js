const fs = require('node:fs');

const DEFAULT_ENGINE_URL = process.env.YENKASA_AI_ENGINE_URL || 'https://yenkasa-ai-3vx2nvls4a-ew.a.run.app';

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
  const response = await fetch(`${DEFAULT_ENGINE_URL}/chat`, {
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
  const response = await fetch(`${DEFAULT_ENGINE_URL}/search`, {
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

  const response = await fetch(`${DEFAULT_ENGINE_URL}/ingest?audience=${encodeURIComponent(audience)}`, {
    method: 'POST',
    body: formData
  });

  return handleResponse(response, 'AI knowledge ingest');
}

module.exports = {
  name: 'fastapi_rag',
  chat,
  search,
  ingest
};
