const { getThresholds } = require('./moderationThresholds');
const {
  incrementCounter,
  recordDuration,
} = require('./moderationMetrics.service');

const QUEUE_NAMES = Object.freeze({
  IMAGE: 'imageModerationQueue',
  VIDEO: 'videoModerationQueue',
});

let bullmqModulePromise = null;
let redisModulePromise = null;
let sharedConnection = null;
const queues = new Map();
const queueEvents = new Map();
const workers = new Map();

function getQueueMode() {
  return String(process.env.YENKASA_MODERATION_QUEUE_MODE || '').trim().toLowerCase() || 'bullmq';
}

function isQueueEnabled() {
  if (process.env.YENKASA_MODERATION_QUEUE_ENABLED === 'false') return false;
  if (getQueueMode() === 'inline') return false;
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
    queues.set(queueName, new Queue(queueName, { connection }));
  }

  return queues.get(queueName);
}

async function getQueueEvents(queueName) {
  if (!queueEvents.has(queueName)) {
    const { QueueEvents } = await loadBullmq();
    const connection = await getSharedConnection();
    const events = new QueueEvents(queueName, { connection });

    events.on('completed', (payload) => {
      incrementCounter('queueJobsCompleted');
      const processDuration = Number(payload?.returnvalue?.metrics?.processDurationMs);
      if (Number.isFinite(processDuration) && processDuration >= 0) {
        recordDuration('queueProcess', processDuration);
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
  const thresholds = getThresholds();

  if (type === 'image') {
    return {
      attempts: thresholds.queue.imageAttempts,
      backoff: {
        type: 'exponential',
        delay: thresholds.queue.imageBackoffMs,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    };
  }

  return {
    attempts: thresholds.queue.videoAttempts,
    backoff: {
      type: 'exponential',
      delay: thresholds.queue.videoBackoffMs,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  };
}

async function enqueue(queueName, jobName, payload, options = {}) {
  if (!isQueueEnabled()) {
    return {
      queued: false,
      mode: getQueueMode(),
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
    mode: getQueueMode(),
    queueName,
    jobId: job.id,
  };
}

async function enqueueImageModerationJob(payload) {
  return enqueue(
    QUEUE_NAMES.IMAGE,
    'moderate_image_post',
    payload,
    buildJobOptions('image'),
  );
}

async function enqueueVideoModerationJob(payload) {
  return enqueue(
    QUEUE_NAMES.VIDEO,
    'moderate_video_post',
    payload,
    buildJobOptions('video'),
  );
}

async function registerModerationWorkers({
  imageProcessor,
  videoProcessor,
} = {}) {
  if (!isQueueEnabled()) {
    return {
      started: false,
      reason: 'queue_not_configured',
    };
  }

  const thresholds = getThresholds();
  const { Worker } = await loadBullmq();
  const connection = await getSharedConnection();

  if (imageProcessor && !workers.has(QUEUE_NAMES.IMAGE)) {
    workers.set(
      QUEUE_NAMES.IMAGE,
      new Worker(
        QUEUE_NAMES.IMAGE,
        async (job) => {
          const startedAt = Date.now();
          const queueWaitMs = startedAt - new Date(job.timestamp).getTime();
          recordDuration('queueWait', queueWaitMs);
          const result = await imageProcessor(job);
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
          concurrency: thresholds.queue.imageConcurrency,
        },
      ),
    );
  }

  if (videoProcessor && !workers.has(QUEUE_NAMES.VIDEO)) {
    workers.set(
      QUEUE_NAMES.VIDEO,
      new Worker(
        QUEUE_NAMES.VIDEO,
        async (job) => {
          const startedAt = Date.now();
          const queueWaitMs = startedAt - new Date(job.timestamp).getTime();
          recordDuration('queueWait', queueWaitMs);
          const result = await videoProcessor(job);
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
          concurrency: thresholds.queue.videoConcurrency,
        },
      ),
    );
  }

  return {
    started: true,
    queues: [...workers.keys()],
  };
}

async function closeModerationQueueResources() {
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

function getModerationQueueState() {
  return {
    enabled: isQueueEnabled(),
    mode: getQueueMode(),
    queueNames: QUEUE_NAMES,
    activeWorkers: [...workers.keys()],
  };
}

module.exports = {
  QUEUE_NAMES,
  closeModerationQueueResources,
  enqueueImageModerationJob,
  enqueueVideoModerationJob,
  getModerationQueueState,
  isQueueEnabled,
  registerModerationWorkers,
};
