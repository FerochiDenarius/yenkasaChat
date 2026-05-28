const mongoose = require('mongoose');

const { normalizeText } = require('./textNormalizer');

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;

  const normalized = String(value).trim();
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) return null;
  return new mongoose.Types.ObjectId(normalized);
}

function toDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function uniqueStrings(values, limit = 20) {
  const seen = new Set();
  const items = [];

  for (const value of values || []) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
    if (items.length >= limit) break;
  }

  return items;
}

function pickFirstNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function summarizeTopScored(items, key = 'label', limit = 5) {
  return ensureArray(items)
    .filter(Boolean)
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
    .slice(0, limit)
    .map((item) => String(item?.[key] || '').trim())
    .filter(Boolean);
}

function buildRequestTrace(req) {
  const requestId =
    req?.header?.('X-Request-Id') ||
    req?.header?.('X-Correlation-Id') ||
    req?.header?.('X-Amzn-Trace-Id') ||
    '';
  const traceHeader = req?.header?.('X-Cloud-Trace-Context');
  const traceIdHeader = req?.header?.('X-Trace-Id') || req?.header?.('X-Correlation-Id') || '';

  if (!traceHeader) {
    return {
      traceId: String(traceIdHeader || requestId || '').trim(),
      requestId: String(requestId || '').trim(),
    };
  }

  const projectId =
    process.env.YENKASA_GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    '';
  const [trace] = String(traceHeader).split('/');
  const resolvedTraceId = String(traceIdHeader || trace || requestId || '').trim();

  if (!projectId || !trace) {
    return {
      traceId: resolvedTraceId,
      requestId: String(requestId || '').trim(),
    };
  }

  return {
    traceId: resolvedTraceId,
    requestId: String(requestId || '').trim(),
    'logging.googleapis.com/trace': `projects/${projectId}/traces/${trace}`,
  };
}

module.exports = {
  toObjectId,
  toDate,
  clamp,
  normalizeText,
  uniqueStrings,
  pickFirstNumber,
  ensureArray,
  summarizeTopScored,
  buildRequestTrace,
};
