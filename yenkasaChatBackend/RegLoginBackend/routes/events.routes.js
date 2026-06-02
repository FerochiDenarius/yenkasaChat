const crypto = require('node:crypto');
const express = require('express');

const auth = require('../middleware/auth');
const { ingestEvent, ingestEventBatch } = require('../src/yme/services/eventIngestion.service');

const router = express.Router();

function getConfiguredIngestKey() {
  return String(
    process.env.YENKASA_EVENTS_INGEST_API_KEY ||
      process.env.INTERNAL_PLATFORM_API_KEY ||
      process.env.LOG_INGEST_API_KEY ||
      '',
  ).trim();
}

function timingSafeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function authorizeOperationalIngest(req, res, next) {
  const configuredKey = getConfiguredIngestKey();
  const suppliedKey = String(
    req.header('x-api-key') ||
      req.header('x-yenkasa-event-key') ||
      '',
  ).trim();

  if (configuredKey && timingSafeEquals(suppliedKey, configuredKey)) {
    req.operationalIngestActor = {
      type: 'internal_key',
      userId: req.body?.userId || req.body?.events?.[0]?.userId || null,
    };
    return next();
  }

  return auth(req, res, next);
}

function normalizeOperationalEvent(rawEvent = {}) {
  const metadata = rawEvent.metadata && typeof rawEvent.metadata === 'object'
    ? rawEvent.metadata
    : {};
  const streamId = String(rawEvent.streamId || metadata.streamId || '').trim();
  const hostId = String(rawEvent.hostId || metadata.hostId || '').trim();

  return {
    ...rawEvent,
    sourceApp: rawEvent.sourceApp || rawEvent.source || 'operational_events_layer',
    contentId: rawEvent.contentId || streamId,
    creatorId: rawEvent.creatorId || hostId,
    relatedUserId: rawEvent.relatedUserId || hostId,
    occurredAt: rawEvent.occurredAt || rawEvent.timestamp || new Date().toISOString(),
    payload: {
      ...metadata,
      operationalEvent: rawEvent,
      streamId,
      hostId,
    },
  };
}

function serializeIngestResult(result) {
  return {
    eventId: result?.event?._id?.toString?.() || '',
    eventType: result?.event?.eventType || '',
    userId: result?.event?.userId?.toString?.() || '',
    queued: result?.dispatch?.queued === true,
    dispatchMode: result?.dispatch?.mode || '',
  };
}

router.post('/ingest', authorizeOperationalIngest, async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events)
      ? req.body.events
      : Array.isArray(req.body)
        ? req.body
        : [req.body];

    const normalizedEvents = events
      .filter((event) => event && typeof event === 'object')
      .map(normalizeOperationalEvent);

    if (!normalizedEvents.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one event payload is required.',
      });
    }

    if (normalizedEvents.length === 1) {
      const result = await ingestEvent(normalizedEvents[0], {
        req,
        defaults: {
          sourceApp: 'operational_events_layer',
          userId: req.user?._id || req.operationalIngestActor?.userId,
        },
      });

      return res.status(202).json({
        success: true,
        accepted: 1,
        event: serializeIngestResult(result),
      });
    }

    const batch = await ingestEventBatch(normalizedEvents, {
      req,
      defaults: {
        sourceApp: 'operational_events_layer',
        userId: req.user?._id || req.operationalIngestActor?.userId,
      },
    });

    return res.status(202).json({
      success: true,
      accepted: batch.count,
      failed: batch.failedCount,
      failures: batch.failures,
      events: batch.results.map(serializeIngestResult),
    });
  } catch (error) {
    console.error('[OperationalEvents][ingest_failed]', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Failed to ingest operational event.',
    });
  }
});

module.exports = router;
module.exports.normalizeOperationalEvent = normalizeOperationalEvent;
module.exports.timingSafeEquals = timingSafeEquals;
