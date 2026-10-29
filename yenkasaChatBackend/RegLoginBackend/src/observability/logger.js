const util = require('node:util');

const REDACTED_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'refreshToken',
  'token',
  'accessToken',
  'secret',
  'apiKey',
]);

function sanitize(value, key = '') {
  if (REDACTED_KEYS.has(key)) return '[REDACTED]';
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, code: value.code || undefined };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey)]),
    );
  }
  if (typeof value === 'string') return value.slice(0, 2000);
  return value;
}

function write(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'yenkasa-backend',
    environment: process.env.NODE_ENV || 'development',
    message,
    ...sanitize(context),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') return console.error(line);
  if (level === 'warn') return console.warn(line);
  return console.log(line);
}

module.exports = {
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, error, context = {}) => write('error', message, { ...context, error }),
  serialize: (value) => sanitize(value),
  inspect: (value) => util.inspect(value, { depth: 4, maxArrayLength: 20 }),
};
