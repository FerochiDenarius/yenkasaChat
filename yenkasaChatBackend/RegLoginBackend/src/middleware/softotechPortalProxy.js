const http = require('http');
const https = require('https');

const DEFAULT_TARGET = 'https://yenkasa-chat-backend-backup-496173204476.europe-west1.run.app';
const PROXY_PATH_PREFIXES = [
  '/api/project-portal',
  '/api/project-requests',
  '/api/portfolio',
  '/client',
  '/admin',
  '/portfolio-admin',
  '/request-project',
  '/website-request',
  '/software-solutions',
];

function normalizedTarget() {
  const raw = process.env.SOFTOTECH_PORTAL_PROXY_TARGET || DEFAULT_TARGET;
  return String(raw || '').replace(/\/+$/, '');
}

function shouldProxyHost(req, target) {
  if (String(process.env.SOFTOTECH_PORTAL_PROXY_ENABLED || '').toLowerCase() === 'true') return true;
  const host = String(req.headers.host || '').toLowerCase();
  if (!host) return false;
  if (host.includes(new URL(target).host.toLowerCase())) return false;
  return host === 'www.yenkasa.xyz' || host === 'yenkasa.xyz';
}

function shouldProxyPath(req) {
  const pathname = String(req.originalUrl || req.url || '').split('?')[0];
  return PROXY_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function filteredHeaders(req, targetUrl) {
  const headers = { ...req.headers };
  headers.host = targetUrl.host;
  headers['x-forwarded-host'] = req.headers.host || '';
  headers['x-forwarded-proto'] = req.protocol || 'https';
  delete headers.connection;
  delete headers['content-length'];
  return headers;
}

function rewriteLocation(value, req, targetUrl) {
  if (!value) return value;
  const publicHost = req.headers.host;
  if (!publicHost) return value;
  return String(value).replace(`${targetUrl.protocol}//${targetUrl.host}`, `${req.protocol || 'https'}://${publicHost}`);
}

function softotechPortalProxy(req, res, next) {
  const target = normalizedTarget();
  if (!target || !shouldProxyPath(req) || !shouldProxyHost(req, target)) return next();

  const targetUrl = new URL(req.originalUrl || req.url, target);
  const client = targetUrl.protocol === 'http:' ? http : https;
  const proxyReq = client.request({
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || undefined,
    method: req.method,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers: filteredHeaders(req, targetUrl),
  }, (proxyRes) => {
    res.statusCode = proxyRes.statusCode || 502;
    Object.entries(proxyRes.headers || {}).forEach(([key, value]) => {
      if (['connection', 'transfer-encoding'].includes(key.toLowerCase())) return;
      res.setHeader(key, key.toLowerCase() === 'location' ? rewriteLocation(value, req, targetUrl) : value);
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    if (res.headersSent) return res.end();
    error.statusCode = 502;
    return next(error);
  });

  req.pipe(proxyReq);
}

module.exports = softotechPortalProxy;
