const DeadLetterEvent = require('../models/deadLetterEvent.model');
const { incrementCounter } = require('./metrics.service');

function toEventSnapshot(event = {}) {
  if (!event) return {};
  if (typeof event.toObject === 'function') {
    return event.toObject({ depopulate: true });
  }
  return { ...event };
}

async function recordDeadLetterEvent({
  event,
  queueName = '',
  jobName = '',
  stage = '',
  error = null,
  metadata = {},
  status = 'open',
} = {}) {
  if (!event?._id) return null;

  const now = new Date();
  const traceId =
    String(event.traceId || event.eventMetadata?.traceId || metadata.traceId || '').trim();
  const snapshot = toEventSnapshot(event);

  const record = await DeadLetterEvent.findOneAndUpdate(
    { eventId: event._id },
    {
      $set: {
        userId: event.userId || null,
        sourceApp: event.sourceApp || '',
        eventType: event.eventType || '',
        traceId,
        jobName,
        queueName,
        stage,
        status,
        fingerprint: event.fingerprint || '',
        dedupeKey: event.dedupeKey || '',
        payload: event.payload || {},
        eventSnapshot: snapshot,
        metadata,
        lastError: error
          ? {
              message: error.message || 'Unknown processing error',
              stack: error.stack || '',
              name: error.name || 'Error',
            }
          : null,
        lastFailedAt: now,
      },
      $setOnInsert: {
        firstFailedAt: now,
      },
      $inc: {
        attempts: 1,
      },
    },
    { new: true, upsert: true },
  );

  incrementCounter('deadLetterEventsCreated');
  return record;
}

async function resolveDeadLetterEvent(eventId, resolutionNote = 'processed_successfully') {
  if (!eventId) return null;

  return DeadLetterEvent.findOneAndUpdate(
    { eventId },
    {
      $set: {
        status: 'resolved',
        lastResolvedAt: new Date(),
        resolutionNote: String(resolutionNote || 'processed_successfully'),
      },
    },
    { new: true },
  );
}

async function getDeadLetterStats(windowHours = 24) {
  const boundedWindow = Math.min(168, Math.max(1, Number(windowHours) || 24));
  const since = new Date(Date.now() - boundedWindow * 60 * 60 * 1000);

  const [openCount, recentCount, byEventType] = await Promise.all([
    DeadLetterEvent.countDocuments({ status: { $ne: 'resolved' } }),
    DeadLetterEvent.countDocuments({ lastFailedAt: { $gte: since } }),
    DeadLetterEvent.aggregate([
      {
        $match: {
          lastFailedAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);

  return {
    windowHours: boundedWindow,
    openCount,
    recentCount,
    byEventType: byEventType.map((item) => ({
      eventType: item._id || 'unknown',
      count: item.count,
    })),
  };
}

module.exports = {
  recordDeadLetterEvent,
  resolveDeadLetterEvent,
  getDeadLetterStats,
};
