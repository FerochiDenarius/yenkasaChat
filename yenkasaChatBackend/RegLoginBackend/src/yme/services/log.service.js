const MemoryLog = require('../models/memoryLog.model');
const { buildRequestTrace, toObjectId } = require('../utils/yme.utils');

async function writeMemoryLog({
  userId,
  eventId,
  jobName = '',
  queueName = '',
  stage,
  level = 'info',
  status = 'success',
  message,
  metrics = {},
  metadata = {},
  error = null,
  req = null,
} = {}) {
  if (!stage || !message) return null;

  const payload = {
    userId: toObjectId(userId),
    eventId: toObjectId(eventId),
    jobName,
    queueName,
    stage,
    level,
    status,
    message,
    metrics,
    metadata: {
      ...metadata,
      ...(req ? buildRequestTrace(req) : {}),
    },
    error: error
      ? {
          message: error.message,
          stack: error.stack,
        }
      : null,
  };

  const traceId = String(payload.metadata?.traceId || '').trim();
  const requestId = String(payload.metadata?.requestId || '').trim();

  const line = JSON.stringify({
    severity: level.toUpperCase(),
    component: 'yme',
    stage,
    status,
    message,
    userId: payload.userId?.toString?.() || null,
    eventId: payload.eventId?.toString?.() || null,
    traceId: traceId || null,
    requestId: requestId || null,
    ...payload.metadata,
  });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  try {
    return await MemoryLog.create(payload);
  } catch (dbError) {
    console.warn('[YME] Failed to persist memory log:', dbError.message);
    return null;
  }
}

module.exports = {
  writeMemoryLog,
};
