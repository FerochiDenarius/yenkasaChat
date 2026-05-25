const { randomUUID } = require('node:crypto');

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function normalizePath(pathname = '') {
  const raw = String(pathname || '').trim();
  if (!raw) return '/';
  return raw.split('?')[0].replace(/\/{2,}/g, '/');
}

function getRouteGroupFromPath(pathname = '') {
  const normalized = normalizePath(pathname)
    .replace(/^\/triciabales-api\/api/, '/api')
    .replace(/^\/api/, '');
  const [segment = 'root'] = normalized.split('/').filter(Boolean);
  return segment || 'root';
}

function buildTraceId(value) {
  const normalized = String(value || '').trim();
  return normalized || randomUUID();
}

function getRequestIp(req) {
  return (
    req?.headers?.['x-forwarded-for'] ||
    req?.headers?.['cf-connecting-ip'] ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    ''
  )
    .toString()
    .split(',')[0]
    .trim();
}

function resolveUserId(req, responseBody = null) {
  const responseUserId =
    responseBody?.user?._id ||
    responseBody?.user?.id ||
    responseBody?.userId ||
    responseBody?.data?.userId ||
    responseBody?.data?.user?._id ||
    '';
  const requestUserId = req?.user?._id || req?.user?.id || req?.body?.userId || '';
  return String(requestUserId || responseUserId || '').trim();
}

function resolveClientPlatform(req) {
  return String(
    req?.headers?.['x-client-platform'] ||
      req?.headers?.['x-platform'] ||
      req?.body?.clientPlatform ||
      req?.body?.platform ||
      '',
  ).trim();
}

function resolveAppVersion(req) {
  return String(
    req?.headers?.['x-app-version'] || req?.body?.appVersion || req?.body?.version || '',
  ).trim();
}

function safePreview(value, limit = 800) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value.slice(0, limit);

  try {
    return JSON.stringify(value).slice(0, limit);
  } catch (_error) {
    return '[unserializable]';
  }
}

function buildRequestMetadata(req, responseBody = null, extra = {}) {
  const path = normalizePath(req?.originalUrl || req?.url || '');

  return {
    traceId: buildTraceId(req?.traceId || req?.headers?.['x-trace-id'] || req?.headers?.['x-request-id']),
    method: String(req?.method || '').toUpperCase(),
    path,
    routeGroup: getRouteGroupFromPath(path),
    ip: getRequestIp(req),
    userAgent: String(req?.get?.('user-agent') || req?.headers?.['user-agent'] || '').slice(0, 300),
    userId: resolveUserId(req, responseBody),
    clientPlatform: resolveClientPlatform(req),
    appVersion: resolveAppVersion(req),
    bodyPreview: safePreview(req?.body || {}),
    ...extra,
  };
}

function sanitizeError(error) {
  if (!error) return null;

  return {
    name: error.name || 'Error',
    message: error.message || 'Unknown error',
    stack: String(error.stack || '').slice(0, 4000),
  };
}

function emitStructuredAppLog({
  severity = 'INFO',
  component = 'yme.observability',
  message,
  data = {},
} = {}) {
  if (!message) return;

  const line = JSON.stringify({
    severity: String(severity || 'INFO').toUpperCase(),
    component,
    message,
    ...data,
  });

  if (severity === 'ERROR' || severity === 'CRITICAL') {
    console.error(line);
    return;
  }
  if (severity === 'WARN') {
    console.warn(line);
    return;
  }
  console.log(line);
}

module.exports = {
  parseBoolean,
  clamp,
  normalizePath,
  getRouteGroupFromPath,
  buildTraceId,
  getRequestIp,
  resolveUserId,
  resolveClientPlatform,
  resolveAppVersion,
  safePreview,
  buildRequestMetadata,
  sanitizeError,
  emitStructuredAppLog,
};
