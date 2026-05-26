const { createLogger } = require('../observability/logger');
const {
  enqueueBridgeDeadLetter,
  enqueueBridgeItems,
  getDeadLetterJob,
  getDeadLetterJobs,
} = require('./bridgeQueue');

const logger = createLogger('yme.bridge_dead_letter', {
  sourceModule: 'bridge.dead_letter',
});

function buildDeadLetterPayload({ kind, job, items = [], error } = {}) {
  return {
    originalKind: kind,
    originalJobId: job?.id || '',
    originalTraceId: job?.data?.traceId || '',
    attemptsMade: Number(job?.attemptsMade || 0) + 1,
    queueName: job?.queueName || '',
    failedAt: new Date().toISOString(),
    error: {
      message: error?.message || 'Unknown bridge delivery error',
      status: Number(error?.status || 0) || null,
      name: error?.name || 'Error',
      nonRetryable: error?.nonRetryable === true,
    },
    metadata: job?.data?.metadata || {},
    items,
  };
}

async function moveBridgeJobToDeadLetter({ kind, job, items = [], error } = {}) {
  const payload = buildDeadLetterPayload({
    kind,
    job,
    items,
    error,
  });
  const result = await enqueueBridgeDeadLetter(payload);
  logger.error('Bridge job moved to dead-letter queue.', {
    traceId: job?.data?.traceId || '',
    data: {
      queueName: payload.queueName,
      originalJobId: payload.originalJobId,
      originalKind: payload.originalKind,
      attemptsMade: payload.attemptsMade,
      deadLetterJobId: result.jobId || '',
    },
    error,
  });

  return {
    ...result,
    payload,
  };
}

async function replayDeadLetterJob(jobId) {
  const job = await getDeadLetterJob(jobId);
  if (!job) {
    return {
      replayed: false,
      reason: 'dead_letter_not_found',
    };
  }

  const payload = job.data || {};
  const result = await enqueueBridgeItems(payload.originalKind || 'events', payload.items || [], {
    traceId: payload.originalTraceId || '',
    sourceModule: 'bridge.dead_letter.replay',
    metadata: {
      replayOfJobId: String(job.id),
    },
  });

  if (result.queued) {
    await job.remove();
  }

  return {
    replayed: Boolean(result.queued),
    queueName: result.queueName || '',
    jobId: result.jobId || '',
    originalDeadLetterJobId: String(job.id),
  };
}

async function listDeadLetters(limit = 25) {
  const jobs = await getDeadLetterJobs(limit);
  return jobs.map((job) => ({
    id: String(job.id),
    queueName: job.queueName,
    attemptsMade: Number(job.attemptsMade || 0),
    data: job.data,
    timestamp: new Date(job.timestamp),
  }));
}

module.exports = {
  listDeadLetters,
  moveBridgeJobToDeadLetter,
  replayDeadLetterJob,
};
