const { getYmeConfig } = require('../config/yme.config');
const { incrementCounter, recordDuration, setGauge } = require('./metrics.service');

const QUEUE_NAMES = Object.freeze({
  EVENT: 'ymeEventIngestionQueue',
  EMBEDDING: 'ymeEmbeddingQueue',
  CONSOLIDATION: 'ymeConsolidationQueue',
  CHAT_SUMMARY: 'ymeChatSummaryQueue',
});

let bullmqModulePromise = null;
let redisModulePromise = null;
let sharedConnection = null;
const queues = new Map();
const queueEvents = new Map();
const workers = new Map();

function isQueueEnabled() {
  const config = getYmeConfig();
  if (!config.queue.enabled) return false;
  if (config.queue.mode === 'inline') return false;
  return Boolean(
    process.env.REDIS_URL ||
      process.env.YENKASA_REDIS_URL ||
      process.env.REDIS_HOST ||
      process.env.YENKASA_REDIS_HOST,
  );
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

async function getQueue(queueName) {
  if (!queues.has(queueName)) {
    const { Queue } = await loadBullmq();
    const connection = await getSharedConnection();
    const config = getYmeConfig();

    queues.set(
      queueName,
      new Queue(queueName, {
        connection,
        prefix: config.queue.prefix,
      }),
    );
  }

  return queues.get(queueName);
}

async function getQueueEvents(queueName) {
  if (!queueEvents.has(queueName)) {
    const { QueueEvents } = await loadBullmq();
    const connection = await getSharedConnection();
    const config = getYmeConfig();
    const events = new QueueEvents(queueName, {
      connection,
      prefix: config.queue.prefix,
    });

    events.on('completed', (payload) => {
      incrementCounter('queueJobsCompleted');
      const processDurationMs = Number(payload?.returnvalue?.metrics?.processDurationMs);
      if (Number.isFinite(processDurationMs)) {
        recordDuration('queueProcess', processDurationMs);
      }
    });

    events.on('failed', () => {
      incrementCounter('queueJobsFailed');
    });

    queueEvents.set(queueName, events);
  }

  return queueEvents.get(queueName);
}

function buildJobOptions(type) {
  const config = getYmeConfig();
  const common = {
    removeOnComplete: 100,
    removeOnFail: 200,
  };

  if (type === 'event') {
    return {
      ...common,
      attempts: config.queue.eventAttempts,
      backoff: { type: 'exponential', delay: config.queue.eventBackoffMs },
    };
  }

  if (type === 'embedding' || type === 'chat_summary') {
    return {
      ...common,
      attempts: config.queue.embeddingAttempts,
      backoff: { type: 'exponential', delay: config.queue.embeddingBackoffMs },
    };
  }

  return {
    ...common,
    attempts: config.queue.consolidationAttempts,
    backoff: { type: 'exponential', delay: config.queue.consolidationBackoffMs },
  };
}

async function enqueue(queueName, jobName, payload, options = {}) {
  if (!isQueueEnabled()) {
    return {
      queued: false,
      mode: getYmeConfig().queue.mode,
      queueName,
      reason: 'queue_not_configured',
    };
  }

  const queue = await getQueue(queueName);
  await getQueueEvents(queueName);
  const job = await queue.add(jobName, payload, options);
  incrementCounter('queueJobsEnqueued');

  return {
    queued: true,
    mode: getYmeConfig().queue.mode,
    queueName,
    jobId: job.id,
  };
}

async function enqueueEventProcessingJob(payload) {
  return enqueue(QUEUE_NAMES.EVENT, 'yme_process_event', payload, buildJobOptions('event'));
}

async function enqueueEmbeddingJob(payload) {
  return enqueue(QUEUE_NAMES.EMBEDDING, 'yme_embed_memory', payload, buildJobOptions('embedding'));
}

async function enqueueConsolidationJob(payload) {
  return enqueue(
    QUEUE_NAMES.CONSOLIDATION,
    'yme_consolidate_memory',
    payload,
    buildJobOptions('consolidation'),
  );
}

async function enqueueChatSummaryJob(payload) {
  return enqueue(
    QUEUE_NAMES.CHAT_SUMMARY,
    'yme_chat_summary',
    payload,
    buildJobOptions('chat_summary'),
  );
}

async function registerYmeWorkers({
  eventProcessor,
  embeddingProcessor,
  consolidationProcessor,
  chatSummaryProcessor,
} = {}) {
  if (!isQueueEnabled()) {
    return {
      started: false,
      reason: 'queue_not_configured',
    };
  }

  const { Worker } = await loadBullmq();
  const connection = await getSharedConnection();
  const config = getYmeConfig();

  async function register(queueName, processor, concurrency) {
    if (!processor || workers.has(queueName)) return;

    const workerOptions = {
      connection,
      concurrency,
      prefix: config.queue.prefix,
    };

    if (
      queueName === QUEUE_NAMES.EMBEDDING &&
      config.queue.embeddingRateMax > 0 &&
      config.queue.embeddingRateWindowMs > 0
    ) {
      workerOptions.limiter = {
        max: config.queue.embeddingRateMax,
        duration: config.queue.embeddingRateWindowMs,
      };
    }

    workers.set(
      queueName,
      new Worker(
        queueName,
        async (job) => {
          const startedAt = Date.now();
          const queueWaitMs = startedAt - new Date(job.timestamp).getTime();
          recordDuration('queueWait', queueWaitMs);
          const result = await processor(job);
          return {
            ...result,
            metrics: {
              ...(result?.metrics || {}),
              queueWaitMs,
              processDurationMs: Date.now() - startedAt,
            },
          };
        },
        workerOptions,
      ),
    );
  }

  await register(QUEUE_NAMES.EVENT, eventProcessor, config.queue.eventConcurrency);
  await register(QUEUE_NAMES.EMBEDDING, embeddingProcessor, config.queue.embeddingConcurrency);
  await register(
    QUEUE_NAMES.CONSOLIDATION,
    consolidationProcessor,
    config.queue.consolidationConcurrency,
  );
  await register(
    QUEUE_NAMES.CHAT_SUMMARY,
    chatSummaryProcessor,
    config.queue.chatSummaryConcurrency,
  );

  return {
    started: true,
    queues: [...workers.keys()],
  };
}

async function closeYmeQueueResources() {
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

function getQueueState() {
  return {
    enabled: isQueueEnabled(),
    mode: getYmeConfig().queue.mode,
    activeQueues: [...workers.keys()],
  };
}

async function getQueueHealth() {
  if (!isQueueEnabled()) {
    return {
      enabled: false,
      mode: getYmeConfig().queue.mode,
      queues: {},
    };
  }

  const health = {};
  for (const queueName of Object.values(QUEUE_NAMES)) {
    const queue = await getQueue(queueName);
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    health[queueName] = counts;
    setGauge(`${queueName}.waiting`, Number(counts.waiting || 0));
    setGauge(`${queueName}.active`, Number(counts.active || 0));
    setGauge(`${queueName}.failed`, Number(counts.failed || 0));
  }

  return {
    enabled: true,
    mode: getYmeConfig().queue.mode,
    queues: health,
  };
}

module.exports = {
  QUEUE_NAMES,
  isQueueEnabled,
  enqueueEventProcessingJob,
  enqueueEmbeddingJob,
  enqueueConsolidationJob,
  enqueueChatSummaryJob,
  registerYmeWorkers,
  closeYmeQueueResources,
  getQueueState,
  getQueueHealth,
};
