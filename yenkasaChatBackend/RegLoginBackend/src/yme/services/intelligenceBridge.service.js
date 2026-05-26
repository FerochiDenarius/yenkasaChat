const { enqueueBridgeEventJob, enqueueBridgeLogJob, getBridgeQueueHealth } = require('../bridge/bridgeQueue');
const { moveBridgeJobToDeadLetter } = require('../bridge/deadLetterHandler');
const { getBridgeConfig, shouldDeadLetter } = require('../bridge/retryPolicy');
const { incrementCounter, recordDuration, setGauge } = require('./metrics.service');
const { emitStructuredAppLog, parseBoolean } = require('../observability/observability.utils');

const DEFAULT_BACKEND_URL =
  process.env.YENKASA_AI_INTELLIGENCE_URL ||
  process.env.YENKASA_AI_BACKEND_URL ||
  'https://yenkasa-ai-backend-496173204476.europe-west1.run.app';
const INTERNAL_API_KEY =
  process.env.YENKASA_AI_INTERNAL_API_KEY ||
  process.env.INTERNAL_PLATFORM_API_KEY ||
  process.env.LOG_INGEST_API_KEY ||
  '';
const REQUEST_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.YENKASA_AI_BRIDGE_TIMEOUT_MS || 8000),
);

const state = {
  enabled: parseBoolean(process.env.YENKASA_AI_INTELLIGENCE_ENABLED, Boolean(INTERNAL_API_KEY)),
  endpoint: DEFAULT_BACKEND_URL,
  lastEventFlushAt: null,
  lastLogFlushAt: null,
  lastError: '',
  lastErrorAt: null,
  lastEventStatus: 'idle',
  lastLogStatus: 'idle',
  lastEventBatchSize: 0,
  lastLogBatchSize: 0,
};

function isBridgeReady() {
  return Boolean(state.enabled && state.endpoint && INTERNAL_API_KEY);
}

function buildUrl(path) {
  return `${String(state.endpoint || '').replace(/\/$/, '')}${path}`;
}

function getBatchSize(kind, items = []) {
  if (!Array.isArray(items)) return 0;
  if (kind === 'events' || kind === 'logs') {
    return items.length;
  }
  return 0;
}

function updateConfiguredMetrics() {
  const config = getBridgeConfig();
  setGauge('intelligenceBridgeConfiguredBatchSize', config.batchSize);
  setGauge('intelligenceBridgeConfiguredConcurrency', config.concurrency);
  setGauge('intelligenceBridgeConfiguredTimeoutMs', REQUEST_TIMEOUT_MS);
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
      error.nonRetryable = response.status >= 400 && response.status < 500;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Bridge request timed out.');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function deliverBridgeBatch(kind, job) {
  const items = Array.isArray(job?.data?.items) ? job.data.items : [];
  const batchSize = getBatchSize(kind, items);
  const startedAt = Date.now();

  if (!batchSize) {
    return {
      delivered: false,
      reason: 'empty_batch',
    };
  }

  if (!isBridgeReady()) {
    const error = new Error('Intelligence bridge is not configured.');
    error.nonRetryable = true;
    await moveBridgeJobToDeadLetter({ kind, job, items, error });
    incrementCounter('intelligenceBridgeSkippedBatches');
    return {
      delivered: false,
      deadLettered: true,
      reason: 'bridge_not_ready',
    };
  }

  const payloadKey = kind === 'events' ? 'events' : 'logs';
  const path =
    kind === 'events'
      ? '/api/internal/platform/events/batch'
      : '/api/internal/platform/logs/batch';

  try {
    const response = await postBatch(path, {
      source: 'yenkasa_app_backend',
      sentAt: new Date().toISOString(),
      [payloadKey]: items,
    });

    const durationMs = Date.now() - startedAt;
    recordDuration(
      kind === 'events' ? 'intelligenceBridgeEventLatency' : 'intelligenceBridgeLogLatency',
      durationMs,
    );
    incrementCounter(
      kind === 'events' ? 'intelligenceBridgeEventsDelivered' : 'intelligenceBridgeLogsDelivered',
      batchSize,
    );
    setGauge(
      kind === 'events' ? 'intelligenceBridgeLastEventBatchSize' : 'intelligenceBridgeLastLogBatchSize',
      batchSize,
    );

    if (kind === 'events') {
      state.lastEventFlushAt = new Date();
      state.lastEventStatus = 'success';
      state.lastEventBatchSize = batchSize;
    } else {
      state.lastLogFlushAt = new Date();
      state.lastLogStatus = 'success';
      state.lastLogBatchSize = batchSize;
    }
    state.lastError = '';

    emitStructuredAppLog({
      severity: 'INFO',
      component: 'yme.intelligence_bridge',
      message: 'Intelligence bridge batch delivered.',
      data: {
        kind,
        batchSize,
        durationMs,
        traceId: job?.data?.traceId || '',
        acceptedCount: Number(response?.accepted_count || batchSize),
      },
    });

    return {
      delivered: true,
      count: batchSize,
      metrics: {
        durationMs,
      },
    };
  } catch (error) {
    state.lastError = error.message;
    state.lastErrorAt = new Date();
    if (kind === 'events') {
      state.lastEventStatus = 'failed';
    } else {
      state.lastLogStatus = 'failed';
    }

    incrementCounter('intelligenceBridgeFlushFailures');
    if (shouldDeadLetter(job, error)) {
      await moveBridgeJobToDeadLetter({ kind, job, items, error });
      if (error.nonRetryable === true) {
        await job.discard();
        return {
          delivered: false,
          deadLettered: true,
          reason: error.message,
        };
      }
    }

    throw error;
  }
}

async function enqueueBridgeEvent(payload) {
  updateConfiguredMetrics();

  if (!isBridgeReady()) {
    return { queued: false, reason: 'bridge_not_ready' };
  }

  return enqueueBridgeEventJob(payload, {
    traceId: payload?.trace_id || payload?.traceId || '',
    sourceModule: payload?.source_module || payload?.sourceModule || 'yme.event_bus',
  });
}

async function enqueueBridgeLog(payload) {
  updateConfiguredMetrics();

  if (!isBridgeReady()) {
    return { queued: false, reason: 'bridge_not_ready' };
  }

  return enqueueBridgeLogJob(payload, {
    traceId: payload?.metadata?.trace_id || payload?.traceId || '',
    sourceModule: payload?.service || 'yme.event_bus',
  });
}

async function getIntelligenceBridgeHealth() {
  updateConfiguredMetrics();

  let queueHealth = {
    enabled: false,
    queues: {},
    error: '',
  };
  try {
    queueHealth = await getBridgeQueueHealth();
  } catch (error) {
    queueHealth = {
      enabled: false,
      queues: {},
      error: error.message,
    };
  }

  return {
    enabled: state.enabled,
    ready: isBridgeReady(),
    endpoint: state.endpoint,
    timeoutMs: REQUEST_TIMEOUT_MS,
    batchSize: getBridgeConfig().batchSize,
    queue: queueHealth,
    lastEventFlushAt: state.lastEventFlushAt,
    lastLogFlushAt: state.lastLogFlushAt,
    lastEventStatus: state.lastEventStatus,
    lastLogStatus: state.lastLogStatus,
    lastEventBatchSize: state.lastEventBatchSize,
    lastLogBatchSize: state.lastLogBatchSize,
    lastError: state.lastError,
    lastErrorAt: state.lastErrorAt,
  };
}

module.exports = {
  deliverBridgeBatch,
  enqueueBridgeEvent,
  enqueueBridgeLog,
  getIntelligenceBridgeHealth,
};
