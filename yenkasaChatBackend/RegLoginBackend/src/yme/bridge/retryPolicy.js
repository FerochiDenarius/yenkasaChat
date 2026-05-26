const { parseBoolean } = require('../observability/observability.utils');

const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 409, 410, 413, 422]);

function getBridgeConfig() {
  return {
    enabled: parseBoolean(process.env.YENKASA_AI_INTELLIGENCE_QUEUE_ENABLED, true),
    prefix: String(process.env.YENKASA_AI_BRIDGE_QUEUE_PREFIX || 'yme_bridge').trim(),
    batchSize: Math.max(1, Number(process.env.YENKASA_AI_BRIDGE_BATCH_SIZE || 25)),
    attempts: Math.max(1, Number(process.env.YENKASA_AI_BRIDGE_MAX_ATTEMPTS || 4)),
    backoffMs: Math.max(1000, Number(process.env.YENKASA_AI_BRIDGE_BACKOFF_MS || 5000)),
    concurrency: Math.max(1, Number(process.env.YENKASA_AI_BRIDGE_CONCURRENCY || 3)),
    removeOnComplete: Math.max(25, Number(process.env.YENKASA_AI_BRIDGE_REMOVE_ON_COMPLETE || 200)),
    removeOnFail: Math.max(50, Number(process.env.YENKASA_AI_BRIDGE_REMOVE_ON_FAIL || 500)),
    keepDeadLetters: parseBoolean(process.env.YENKASA_AI_BRIDGE_KEEP_DEAD_LETTERS, true),
  };
}

function buildBridgeJobOptions(_kind, overrides = {}) {
  const config = getBridgeConfig();
  return {
    attempts: config.attempts,
    backoff: {
      type: 'exponential',
      delay: config.backoffMs,
    },
    removeOnComplete: config.removeOnComplete,
    removeOnFail: config.removeOnFail,
    ...overrides,
  };
}

function isRetryableBridgeStatus(statusCode) {
  const numeric = Number(statusCode || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return true;
  return !NON_RETRYABLE_STATUS_CODES.has(numeric);
}

function isPoisonBridgeError(error) {
  if (!error) return false;
  if (error.nonRetryable === true) return true;
  return !isRetryableBridgeStatus(error.status);
}

function shouldDeadLetter(job, error) {
  if (isPoisonBridgeError(error)) return true;

  const attempts = Math.max(1, Number(job?.opts?.attempts || getBridgeConfig().attempts));
  const attemptsMade = Math.max(0, Number(job?.attemptsMade || 0));
  return attemptsMade + 1 >= attempts;
}

module.exports = {
  buildBridgeJobOptions,
  getBridgeConfig,
  isPoisonBridgeError,
  isRetryableBridgeStatus,
  shouldDeadLetter,
};
