const { incrementCounter, setGauge } = require('./metrics.service');
const {
  emitStructuredAppLog,
  parseBoolean,
} = require('../observability/observability.utils');

const DEFAULT_BACKEND_URL =
  process.env.YENKASA_AI_INTELLIGENCE_URL ||
  process.env.YENKASA_AI_BACKEND_URL ||
  'https://yenkasa-ai-backend-496173204476.europe-west1.run.app';
const INTERNAL_API_KEY =
  process.env.YENKASA_AI_INTERNAL_API_KEY ||
  process.env.INTERNAL_PLATFORM_API_KEY ||
  '';
const ENABLED = parseBoolean(process.env.YENKASA_AI_INTELLIGENCE_ENABLED, Boolean(INTERNAL_API_KEY));
const FLUSH_INTERVAL_MS = Math.max(
  1000,
  Number(process.env.YENKASA_AI_BRIDGE_FLUSH_INTERVAL_MS || 5000),
);
const BATCH_SIZE = Math.max(1, Number(process.env.YENKASA_AI_BRIDGE_BATCH_SIZE || 25));
const REQUEST_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.YENKASA_AI_BRIDGE_TIMEOUT_MS || 8000),
);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.YENKASA_AI_BRIDGE_MAX_ATTEMPTS || 4));

const queues = {
  events: [],
  logs: [],
};
const timers = {
  events: null,
  logs: null,
};
const state = {
  enabled: ENABLED,
  endpoint: DEFAULT_BACKEND_URL,
  lastEventFlushAt: null,
  lastLogFlushAt: null,
  lastError: '',
  lastErrorAt: null,
};

function isBridgeReady() {
  return Boolean(state.enabled && state.endpoint && INTERNAL_API_KEY);
}

function buildUrl(path) {
  return `${String(state.endpoint || '').replace(/\/$/, '')}${path}`;
}

function queueSize(kind) {
  return Array.isArray(queues[kind]) ? queues[kind].length : 0;
}

function updateQueueMetrics() {
  setGauge('intelligenceBridgeEventQueueDepth', queueSize('events'));
  setGauge('intelligenceBridgeLogQueueDepth', queueSize('logs'));
}

function scheduleFlush(kind) {
  if (!isBridgeReady()) return;
  if (timers[kind]) return;

  timers[kind] = setTimeout(() => {
    timers[kind] = null;
    flushQueue(kind).catch((error) => {
      state.lastError = error.message;
      state.lastErrorAt = new Date();
      emitStructuredAppLog({
        severity: 'ERROR',
        component: 'yme.intelligence_bridge',
        message: 'Intelligence bridge flush failed.',
        data: {
          kind,
          error: error.message,
        },
      });
    });
  }, FLUSH_INTERVAL_MS);
}

async function postBatch(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Api-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (_error) {
        payload = { rawText: text };
      }
    }

    if (!response.ok) {
      const error = new Error(
        payload?.detail ||
          payload?.message ||
          payload?.rawText ||
          `Bridge request failed with status ${response.status}.`,
      );
      error.status = response.status;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function requeue(kind, items) {
  const retryable = [];
  const now = Date.now();

  for (const item of items) {
    const attempts = Number(item.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) continue;
    retryable.push({
      payload: item.payload,
      attempts,
      queuedAt: item.queuedAt || new Date(now),
    });
  }

  if (retryable.length) {
    queues[kind].unshift(...retryable);
    updateQueueMetrics();
    scheduleFlush(kind);
  }
}

async function flushQueue(kind) {
  if (!isBridgeReady()) return { flushed: false, reason: 'bridge_not_ready' };
  const queue = queues[kind];
  if (!queue.length) return { flushed: false, reason: 'empty' };

  const items = queue.splice(0, BATCH_SIZE);
  updateQueueMetrics();
  const payloadKey = kind === 'events' ? 'events' : 'logs';
  const path =
    kind === 'events'
      ? '/api/internal/platform/events/batch'
      : '/api/internal/platform/logs/batch';

  try {
    await postBatch(path, {
      source: 'yenkasa_app_backend',
      sentAt: new Date().toISOString(),
      [payloadKey]: items.map((item) => item.payload),
    });

    if (kind === 'events') {
      state.lastEventFlushAt = new Date();
      incrementCounter('intelligenceBridgeEventsFlushed', items.length);
    } else {
      state.lastLogFlushAt = new Date();
      incrementCounter('intelligenceBridgeLogsFlushed', items.length);
    }

    emitStructuredAppLog({
      severity: 'INFO',
      component: 'yme.intelligence_bridge',
      message: 'Intelligence bridge batch flushed.',
      data: {
        kind,
        count: items.length,
      },
    });

    if (queue.length) scheduleFlush(kind);
    return { flushed: true, count: items.length };
  } catch (error) {
    incrementCounter('intelligenceBridgeFlushFailures');
    requeue(kind, items);
    throw error;
  }
}

function enqueueBridgeEvent(payload) {
  if (!isBridgeReady()) {
    return { queued: false, reason: 'bridge_not_ready' };
  }

  queues.events.push({
    payload,
    attempts: 0,
    queuedAt: new Date(),
  });
  incrementCounter('intelligenceBridgeEventsQueued');
  updateQueueMetrics();
  if (queueSize('events') >= BATCH_SIZE) {
    flushQueue('events').catch(() => {});
  } else {
    scheduleFlush('events');
  }
  return { queued: true, kind: 'events' };
}

function enqueueBridgeLog(payload) {
  if (!isBridgeReady()) {
    return { queued: false, reason: 'bridge_not_ready' };
  }

  queues.logs.push({
    payload,
    attempts: 0,
    queuedAt: new Date(),
  });
  incrementCounter('intelligenceBridgeLogsQueued');
  updateQueueMetrics();
  if (queueSize('logs') >= BATCH_SIZE) {
    flushQueue('logs').catch(() => {});
  } else {
    scheduleFlush('logs');
  }
  return { queued: true, kind: 'logs' };
}

function getIntelligenceBridgeHealth() {
  return {
    enabled: state.enabled,
    ready: isBridgeReady(),
    endpoint: state.endpoint,
    queueDepths: {
      events: queueSize('events'),
      logs: queueSize('logs'),
    },
    lastEventFlushAt: state.lastEventFlushAt,
    lastLogFlushAt: state.lastLogFlushAt,
    lastError: state.lastError,
    lastErrorAt: state.lastErrorAt,
  };
}

module.exports = {
  enqueueBridgeEvent,
  enqueueBridgeLog,
  flushQueue,
  getIntelligenceBridgeHealth,
};
