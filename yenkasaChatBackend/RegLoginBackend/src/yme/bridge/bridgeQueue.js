const { incrementCounter, recordDuration, setGauge } = require('../services/metrics.service');
const { emitStructuredAppLog, parseBoolean } = require('../observability/observability.utils');
const { buildBridgeJobOptions, getBridgeConfig } = require('./retryPolicy');

const QUEUE_NAMES = Object.freeze({
  EVENT: 'ymeIntelligenceBridgeEventQueue',
  LOG: 'ymeIntelligenceBridgeLogQueue',
  DEAD_LETTER: 'ymeIntelligenceBridgeDeadLetterQueue',
});

let bullmqModulePromise = null;
let redisModulePromise = null;
let sharedConnection = null;
const queues = new Map();
const queueEvents = new Map();
const workers = new Map();

function bridgeRedisConfigured() {
  return Boolean(
    process.env.REDIS_URL ||
      process.env.YENKASA_REDIS_URL ||
      process.env.REDIS_HOST ||
      process.env.YENKASA_REDIS_HOST,
  );
}

function isBridgeQueueEnabled() {
  return getBridgeConfig().enabled && bridgeRedisConfigured();
}

async function loadBullmq() {
  if (!bullmqModulePromise) {
    bullmqModulePromise = Promise.resolve().then(() => require('bullmq'));
  }
  return bullmqModulePromise;
}

async function loadIoredis() {
  if (!redisModulePromise) {
    redisModulePromise = Promise.resolve().then(() => require('ioredis'));
  }
  return redisModulePromise;
}

async function getSharedConnection() {
  if (sharedConnection) return sharedConnection;

  const IORedis = await loadIoredis();
  const redisUrl = process.env.YENKASA_REDIS_URL || process.env.REDIS_URL;

  if (redisUrl) {
    sharedConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    return sharedConnection;
  }

  sharedConnection = new IORedis({
    host: process.env.YENKASA_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.YENKASA_REDIS_PORT || process.env.REDIS_PORT || 6379),
    password: process.env.YENKASA_REDIS_PASSWORD || process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.YENKASA_REDIS_DB || process.env.REDIS_DB || 0),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return sharedConnection;
}

function resolveQueueName(kind = 'events') {
  if (kind === 'logs') return QUEUE_NAMES.LOG;
  if (kind === 'dead_letters') return QUEUE_NAMES.DEAD_LETTER;
  return QUEUE_NAMES.EVENT;
}

function buildQueuePrefix() {
  return getBridgeConfig().prefix;
}

async function getQueue(kind = 'events') {
  const queueName = resolveQueueName(kind);

  if (!queues.has(queueName)) {
    const { Queue } = await loadBullmq();
    const connection = await getSharedConnection();

    queues.set(
      queueName,
      new Queue(queueName, {
        connection,
        prefix: buildQueuePrefix(),
      }),
    );
  }

  return queues.get(queueName);
}

async function getQueueEvents(kind = 'events') {
  const queueName = resolveQueueName(kind);

  if (!queueEvents.has(queueName)) {
    const { QueueEvents } = await loadBullmq();
    const connection = await getSharedConnection();
    const events = new QueueEvents(queueName, {
      connection,
      prefix: buildQueuePrefix(),
    });

    events.on('completed', (payload) => {
      incrementCounter(`intelligenceBridge${kind === 'logs' ? 'Log' : 'Event'}JobsCompleted`);
      const processDurationMs = Number(payload?.returnvalue?.metrics?.processDurationMs);
      if (Number.isFinite(processDurationMs)) {
        recordDuration(`intelligenceBridge${kind === 'logs' ? 'Log' : 'Event'}Process`, processDurationMs);
      }
    });

    events.on('failed', (payload) => {
      incrementCounter(`intelligenceBridge${kind === 'logs' ? 'Log' : 'Event'}JobsFailed`);
      emitStructuredAppLog({
        severity: 'ERROR',
        component: 'yme.bridge_queue',
        message: 'Bridge queue job failed.',
        data: {
          queueName,
          jobId: payload?.jobId || '',
          failedReason: payload?.failedReason || '',
        },
      });
    });

    queueEvents.set(queueName, events);
  }

  return queueEvents.get(queueName);
}

async function updateQueueDepthGauge(kind = 'events') {
  try {
    const queue = await getQueue(kind);
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
    const value = ['waiting', 'active', 'delayed', 'failed'].reduce(
      (sum, key) => sum + Number(counts?.[key] || 0),
      0,
    );
    const gaugeName =
      kind === 'logs'
        ? 'intelligenceBridgeLogQueueDepth'
        : kind === 'dead_letters'
          ? 'intelligenceBridgeDeadLetterDepth'
          : 'intelligenceBridgeEventQueueDepth';
    setGauge(gaugeName, value);
  } catch (_error) {}
}

async function enqueueBridgeItems(kind = 'events', items = [], context = {}) {
  if (!isBridgeQueueEnabled()) {
    return {
      queued: false,
      reason: 'queue_not_configured',
      queueName: resolveQueueName(kind),
    };
  }

  const batch = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!batch.length) {
    return {
      queued: false,
      reason: 'empty_batch',
      queueName: resolveQueueName(kind),
    };
  }

  const queue = await getQueue(kind);
  await getQueueEvents(kind);

  const job = await queue.add(
    kind === 'logs' ? 'bridge_deliver_logs' : 'bridge_deliver_events',
    {
      kind,
      items: batch,
      traceId: context.traceId || '',
      sourceModule: context.sourceModule || '',
      enqueuedAt: new Date().toISOString(),
      metadata: context.metadata || {},
    },
    buildBridgeJobOptions(kind),
  );

  incrementCounter(kind === 'logs' ? 'intelligenceBridgeLogsQueued' : 'intelligenceBridgeEventsQueued');
  await updateQueueDepthGauge(kind);

  return {
    queued: true,
    queueName: resolveQueueName(kind),
    jobId: job.id,
    count: batch.length,
  };
}

async function enqueueBridgeEventJob(payload, context = {}) {
  return enqueueBridgeItems('events', [payload], context);
}

async function enqueueBridgeLogJob(payload, context = {}) {
  return enqueueBridgeItems('logs', [payload], context);
}

async function enqueueBridgeDeadLetter(payload) {
  if (!isBridgeQueueEnabled()) {
    return {
      queued: false,
      reason: 'queue_not_configured',
      queueName: resolveQueueName('dead_letters'),
    };
  }

  const queue = await getQueue('dead_letters');
  const keepDeadLetters = parseBoolean(process.env.YENKASA_AI_BRIDGE_KEEP_DEAD_LETTERS, true);
  const job = await queue.add(
    'bridge_dead_letter',
    payload,
    {
      attempts: 1,
      removeOnComplete: keepDeadLetters ? false : 500,
      removeOnFail: false,
    },
  );
  incrementCounter('intelligenceBridgeDeadLettersQueued');
  await updateQueueDepthGauge('dead_letters');
  return {
    queued: true,
    queueName: resolveQueueName('dead_letters'),
    jobId: job.id,
  };
}

async function registerBridgeWorkers({ eventProcessor, logProcessor } = {}) {
  if (!isBridgeQueueEnabled()) {
    return {
      started: false,
      reason: 'queue_not_configured',
    };
  }

  const { Worker } = await loadBullmq();
  const connection = await getSharedConnection();
  const config = getBridgeConfig();

  async function register(kind, processor) {
    const queueName = resolveQueueName(kind);
    if (!processor || workers.has(queueName)) return;
    await getQueueEvents(kind);

    workers.set(
      queueName,
      new Worker(
        queueName,
        async (job) => {
          const startedAt = Date.now();
          const queueWaitMs = startedAt - new Date(job.timestamp).getTime();
          recordDuration(
            kind === 'logs' ? 'intelligenceBridgeLogQueueWait' : 'intelligenceBridgeEventQueueWait',
            queueWaitMs,
          );
          const result = await processor(job);
          await updateQueueDepthGauge(kind);
          return {
            ...result,
            metrics: {
              ...(result?.metrics || {}),
              queueWaitMs,
              processDurationMs: Date.now() - startedAt,
            },
          };
        },
        {
          connection,
          concurrency: config.concurrency,
          prefix: buildQueuePrefix(),
        },
      ),
    );
  }

  await register('events', eventProcessor);
  await register('logs', logProcessor);

  return {
    started: true,
    queues: [...workers.keys()],
  };
}

async function getBridgeQueueHealth() {
  if (!isBridgeQueueEnabled()) {
    return {
      enabled: false,
      queues: {},
      prefix: buildQueuePrefix(),
    };
  }

  const response = {
    enabled: true,
    prefix: buildQueuePrefix(),
    queues: {},
  };

  for (const kind of ['events', 'logs', 'dead_letters']) {
    const queue = await getQueue(kind);
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    response.queues[resolveQueueName(kind)] = counts;
  }

  return response;
}

async function getDeadLetterJobs(limit = 25) {
  if (!isBridgeQueueEnabled()) return [];
  const queue = await getQueue('dead_letters');
  return queue.getJobs(['waiting', 'delayed', 'paused'], 0, Math.max(0, Number(limit || 25) - 1));
}

async function getDeadLetterJob(jobId) {
  if (!isBridgeQueueEnabled()) return null;
  const queue = await getQueue('dead_letters');
  return queue.getJob(jobId);
}

async function closeBridgeQueueResources() {
  await Promise.all(
    [...workers.values()].map(async (worker) => {
      try {
        await worker.close();
      } catch (_error) {}
    }),
  );
  workers.clear();

  await Promise.all(
    [...queueEvents.values()].map(async (events) => {
      try {
        await events.close();
      } catch (_error) {}
    }),
  );
  queueEvents.clear();

  await Promise.all(
    [...queues.values()].map(async (queue) => {
      try {
        await queue.close();
      } catch (_error) {}
    }),
  );
  queues.clear();

  if (sharedConnection) {
    try {
      await sharedConnection.quit();
    } catch (_error) {}
    sharedConnection = null;
  }
}

module.exports = {
  QUEUE_NAMES,
  closeBridgeQueueResources,
  enqueueBridgeDeadLetter,
  enqueueBridgeEventJob,
  enqueueBridgeItems,
  enqueueBridgeLogJob,
  getBridgeQueueHealth,
  getDeadLetterJob,
  getDeadLetterJobs,
  isBridgeQueueEnabled,
  registerBridgeWorkers,
  resolveQueueName,
};
