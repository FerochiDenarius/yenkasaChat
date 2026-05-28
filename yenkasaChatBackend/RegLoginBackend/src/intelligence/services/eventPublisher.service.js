const crypto = require('node:crypto');

const AIOutboundEvent = require('../../../models/aiOutboundEvent.model');

const DEFAULT_ENGINE_URL =
  process.env.YENKASA_AI_ENGINE_URL ||
  'https://yenkasa-ai-496173204476.europe-west1.run.app';
const DEFAULT_EVENT_PATH = process.env.YENKASA_AI_EVENT_INGEST_PATH || '/api/events/ingest';
const REQUEST_TIMEOUT_MS = Number(process.env.YENKASA_AI_EVENT_TIMEOUT_MS || 5000);
const INITIAL_RETRY_DELAY_MS = Number(process.env.YENKASA_AI_EVENT_RETRY_DELAY_MS || 15000);
const MAX_RETRY_DELAY_MS = Number(process.env.YENKASA_AI_EVENT_MAX_RETRY_DELAY_MS || 300000);
const FLUSH_BATCH_SIZE = Number(process.env.YENKASA_AI_EVENT_FLUSH_BATCH_SIZE || 25);
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = Number(
  process.env.YENKASA_AI_EVENT_CIRCUIT_BREAKER_FAILURE_THRESHOLD || 5,
);
const CIRCUIT_BREAKER_COOLDOWN_MS = Number(
  process.env.YENKASA_AI_EVENT_CIRCUIT_BREAKER_COOLDOWN_MS || 60000,
);

// TODO(kafka-migration): Replace the Mongo-backed local retry queue with a durable producer/consumer transport
// once the event volume outgrows this startup-stage relay.

const SUPPORTED_EVENT_TYPES = new Set([
  'post_created',
  'post_deleted',
  'post_liked',
  'post_shared',
  'post_view',
  'video_watch',
  'comment_created',
  'comment_deleted',
  'message_sent',
  'message_read',
  'message_deleted',
  'follow_user',
  'unfollow_user',
  'profile_viewed',
  'gift_sent',
  'wallet_transfer',
  'live_started',
  'live_joined',
  'live_left',
  'live_comment',
  'live_reaction',
  'guest_request',
  'guest_approved',
  'guest_declined',
  'live_ended',
  'viewer_count_updated',
  'report_created',
  'suspicious_activity',
  'login_attempt',
  'order_created',
  'payment_verified',
  'seller_registered',
  'product_uploaded',
  'moderation_flagged',
  'moderation_report_created',
  'moderation_post_reviewed',
  'moderation_user_reported',
  'moderation_post_hidden',
]);

let flushTimer = null;
let flushInFlight = false;
let relayStarted = false;
const relayCircuit = {
  consecutiveFailures: 0,
  openUntil: 0,
};

function relayEnabled() {
  return process.env.YENKASA_AI_EVENT_RELAY_ENABLED !== 'false';
}

function buildEventIngestUrl() {
  const explicitUrl = String(process.env.YENKASA_AI_EVENT_INGEST_URL || '').trim();
  if (explicitUrl) return explicitUrl;

  const base = String(DEFAULT_ENGINE_URL || '').trim().replace(/\/$/, '');
  const path = String(DEFAULT_EVENT_PATH || '/api/events/ingest').startsWith('/')
    ? String(DEFAULT_EVENT_PATH || '/api/events/ingest')
    : `/${String(DEFAULT_EVENT_PATH || 'api/events/ingest')}`;

  return `${base}${path}`;
}

function getEventApiKey() {
  return String(
    process.env.YENKASA_AI_EVENT_API_KEY ||
      process.env.INTERNAL_PLATFORM_API_KEY ||
      process.env.LOG_INGEST_API_KEY ||
      '',
  ).trim();
}

function normalizeEventType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeSource(value) {
  return String(value || 'yenkasa_app')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function safeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...value };
}

function normalizeTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function computeRetryDelayMs(attemptCount = 1) {
  const attempt = Math.max(1, Number(attemptCount) || 1);
  return Math.min(MAX_RETRY_DELAY_MS, INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1));
}

function isRelayCircuitOpen() {
  return relayCircuit.openUntil > Date.now();
}

function resetRelayCircuit() {
  relayCircuit.consecutiveFailures = 0;
  relayCircuit.openUntil = 0;
}

function registerRelayFailure(error) {
  relayCircuit.consecutiveFailures += 1;

  if (relayCircuit.consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    relayCircuit.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    logRelay('warn', 'AI event relay circuit opened.', {
      consecutiveFailures: relayCircuit.consecutiveFailures,
      cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
      message: error?.message || 'relay_failure',
    });
  }
}

function normalizeIntelligenceEvent(event = {}) {
  const eventType = normalizeEventType(event.eventType || event.type);
  if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
    throw new Error(`Unsupported intelligence event type: ${eventType || 'unknown'}`);
  }

  const source = normalizeSource(event.source || event.sourceApp);
  const metadata = safeObject(event.metadata);

  if (event.postId && !metadata.postId) metadata.postId = String(event.postId);
  if (event.communityId && !metadata.communityId) metadata.communityId = String(event.communityId);
  if (event.messageId && !metadata.messageId) metadata.messageId = String(event.messageId);
  if (event.commentId && !metadata.commentId) metadata.commentId = String(event.commentId);
  if (event.contentId && !metadata.contentId) metadata.contentId = String(event.contentId);
  if (event.relatedUserId && !metadata.relatedUserId) metadata.relatedUserId = String(event.relatedUserId);
  if (event.creatorId && !metadata.creatorId) metadata.creatorId = String(event.creatorId);
  if (event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) && !metadata.payload) {
    metadata.payload = { ...event.payload };
  }

  return {
    eventId: String(event.eventId || event.clientEventId || crypto.randomUUID()),
    eventType,
    source,
    userId: event.userId ? String(event.userId) : null,
    sessionId: event.sessionId ? String(event.sessionId) : null,
    requestId: event.requestId ? String(event.requestId) : null,
    traceId: event.traceId ? String(event.traceId) : null,
    timestamp: normalizeTimestamp(event.timestamp || event.occurredAt || event.createdAt),
    metadata,
  };
}

function mapYmeEventToIntelligenceEvent(event = {}) {
  const type = normalizeEventType(event.eventType || event.type);
  if (!type) return null;

  const base = {
    userId: event.userId || null,
    source: 'yenkasa_app',
    sessionId: event.sessionId || event.session || null,
    requestId: event.requestId || null,
    traceId: event.traceId || null,
    timestamp: event.timestamp || event.occurredAt || event.createdAt || null,
  };

  if (type === 'post_created') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'post_created',
      postId: event.postId,
      communityId: event.communityId,
      metadata: {
        postId: event.postId || null,
        communityId: event.communityId || null,
        contentId: event.contentId || null,
        caption: event.caption || '',
        categories: event.categories || [],
        postType: event.payload?.postType || 'text',
        moderationStatus: event.payload?.moderationStatus || '',
      },
    });
  }

  if (type === 'post_deleted') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'post_deleted',
      postId: event.postId,
      communityId: event.communityId,
      metadata: {
        postId: event.postId || null,
        communityId: event.communityId || null,
        contentId: event.contentId || null,
      },
    });
  }

  if (type === 'like' || type === 'post_like' || type === 'post_liked') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'post_liked',
      postId: event.postId,
      communityId: event.communityId,
      metadata: {
        postId: event.postId || null,
        communityId: event.communityId || null,
        contentId: event.contentId || null,
        creatorId: event.creatorId || null,
      },
    });
  }

  if (type === 'share' || type === 'post_shared') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'post_shared',
      postId: event.postId,
      communityId: event.communityId,
      metadata: {
        postId: event.postId || null,
        communityId: event.communityId || null,
        contentId: event.contentId || null,
        shareCount: Number(event.payload?.shareCount || 0),
      },
    });
  }

  if (type === 'watch' || type === 'post_view' || type === 'post_viewed' || type === 'video_watch') {
    const mediaType = String(event.payload?.mediaType || '').toLowerCase();
    const eventType = type === 'video_watch' || mediaType === 'video' ? 'video_watch' : 'post_view';
    return normalizeIntelligenceEvent({
      ...base,
      eventType,
      postId: event.postId,
      communityId: event.communityId,
      metadata: {
        postId: event.postId || null,
        communityId: event.communityId || null,
        contentId: event.contentId || null,
        mediaType,
        watchTimeMs: Number(event.watchTimeMs || event.payload?.watchTimeMs || 0),
        qualifiedView: Boolean(event.payload?.qualifiedView),
        monetizableOpportunity: Boolean(event.payload?.monetizableOpportunity),
      },
    });
  }

  if (type === 'comment' || type === 'comment_created') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'comment_created',
      postId: event.postId,
      communityId: event.communityId,
      metadata: {
        postId: event.postId || null,
        communityId: event.communityId || null,
        commentId: event.payload?.commentId || null,
        parentCommentId: event.payload?.parentCommentId || null,
        isReply: Boolean(event.payload?.isReply),
      },
    });
  }

  if (type === 'comment_deleted') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'comment_deleted',
      postId: event.postId,
      communityId: event.communityId,
      metadata: {
        postId: event.postId || null,
        communityId: event.communityId || null,
        commentId: event.payload?.commentId || null,
        parentCommentId: event.payload?.parentCommentId || null,
      },
    });
  }

  if (type === 'chat_message' || type === 'chat_message_sent' || type === 'chat_sent' || type === 'message_sent') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'message_sent',
      metadata: {
        roomId: event.conversationId || event.chatId || null,
        messageId: event.messageId || null,
        relatedUserId: event.relatedUserId || null,
        roomType: event.payload?.roomType || 'direct',
        messageType: event.payload?.messageType || 'message',
        hasImage: Boolean(event.payload?.hasImage),
        hasAudio: Boolean(event.payload?.hasAudio),
        hasVideo: Boolean(event.payload?.hasVideo),
        hasFile: Boolean(event.payload?.hasFile),
      },
    });
  }

  if (type === 'chat_read') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'message_read',
      metadata: {
        roomId: event.conversationId || event.chatId || null,
        relatedUserId: event.relatedUserId || null,
      },
    });
  }

  if (type === 'chat_deleted') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'message_deleted',
      metadata: {
        roomId: event.conversationId || event.chatId || null,
        messageId: event.messageId || event.payload?.messageId || null,
        relatedUserId: event.relatedUserId || null,
      },
    });
  }

  if (type === 'follow' || type === 'follow_user') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'follow_user',
      metadata: {
        relatedUserId: event.relatedUserId || event.creatorId || null,
        contentId: event.contentId || null,
      },
    });
  }

  if (type === 'unfollow' || type === 'unfollow_user') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'unfollow_user',
      metadata: {
        relatedUserId: event.relatedUserId || event.creatorId || null,
        contentId: event.contentId || null,
      },
    });
  }

  if (type === 'profile_visit' || type === 'profile_viewed') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'profile_viewed',
      metadata: {
        relatedUserId: event.relatedUserId || event.creatorId || null,
        contentId: event.contentId || null,
      },
    });
  }

  if (type === 'gift_sent' || type === 'wallet_transfer') {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: type,
      metadata: {
        relatedUserId: event.relatedUserId || null,
        roomId: event.payload?.roomId || null,
        amount: Number(event.payload?.amount || 0),
        giftType: event.payload?.giftType || '',
      },
    });
  }

  if (
    [
      'live_started',
      'live_joined',
      'live_left',
      'live_comment',
      'live_reaction',
      'guest_request',
      'guest_approved',
      'guest_declined',
      'live_ended',
      'viewer_count_updated',
    ].includes(type)
  ) {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: type,
      metadata: {
        roomId: event.payload?.roomId || event.payload?.streamId || null,
        streamId: event.payload?.streamId || null,
        relatedUserId: event.relatedUserId || null,
        viewerCount: Number(event.payload?.viewerCount || 0),
        text: event.payload?.text || '',
      },
    });
  }

  if (
    [
      'moderation_report_created',
      'moderation_user_reported',
      'moderation_post_reviewed',
      'moderation_post_hidden',
      'moderation_flagged',
    ].includes(type)
  ) {
    return normalizeIntelligenceEvent({
      ...base,
      eventType: type,
      postId: event.postId,
      metadata: {
        postId: event.postId || null,
        relatedUserId: event.relatedUserId || null,
        moderationItemId: event.payload?.moderationItemId || null,
        action: event.payload?.action || '',
        reason: event.payload?.reason || '',
        targetType: event.payload?.targetType || '',
        status: event.payload?.status || '',
      },
    });
  }

  return null;
}

async function parseResponse(response) {
  const rawText = await response.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    return { rawText };
  }
}

async function postEvent(payload) {
  if (!relayEnabled()) {
    return { skipped: true, reason: 'relay_disabled' };
  }

  if (isRelayCircuitOpen()) {
    const error = new Error('AI event relay circuit is open.');
    error.code = 'relay_circuit_open';
    error.status = 503;
    throw error;
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  const apiKey = getEventApiKey();
  if (apiKey) {
    headers['X-Event-Api-Key'] = apiKey;
  }

  const response = await fetch(buildEventIngestUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(body?.detail || body?.message || `Event ingest failed with status ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

function logRelay(level, message, extra = {}) {
  const logger = console[level] || console.log;
  logger(`[YenkasaAIEventRelay] ${message}`, extra);
}

function scheduleFlush(delayMs = INITIAL_RETRY_DELAY_MS) {
  if (!relayEnabled() || flushTimer) return;

  flushTimer = setTimeout(async () => {
    flushTimer = null;
    try {
      await flushPendingIntelligenceEvents();
    } catch (error) {
      logRelay('error', 'Queued intelligence event flush failed.', {
        message: error.message,
        stack: error.stack,
      });
      scheduleFlush(INITIAL_RETRY_DELAY_MS);
    }
  }, Math.max(250, Number(delayMs) || INITIAL_RETRY_DELAY_MS));

  if (typeof flushTimer.unref === 'function') {
    flushTimer.unref();
  }
}

async function queueFailedEvent(payload, error) {
  const queued = (await AIOutboundEvent.findOne({ eventId: payload.eventId })) || new AIOutboundEvent({
    eventId: payload.eventId,
    eventType: payload.eventType,
    source: payload.source,
  });

  queued.payload = payload;
  queued.status = 'pending';
  queued.attemptCount = Number(queued.attemptCount || 0) + 1;
  queued.lastAttemptAt = new Date();
  queued.lastErrorMessage = error.message || 'Unknown relay error';
  queued.lastErrorStatus = Number(error.status || 0) || undefined;
  queued.nextAttemptAt = new Date(Date.now() + computeRetryDelayMs(queued.attemptCount));
  await queued.save();

  logRelay('warn', 'Queued intelligence event for retry.', {
    eventId: payload.eventId,
    eventType: payload.eventType,
    source: payload.source,
    attemptCount: queued.attemptCount,
    nextAttemptAt: queued.nextAttemptAt.toISOString(),
    status: error.status || null,
    message: error.message,
  });
  scheduleFlush(computeRetryDelayMs(queued.attemptCount));
  return queued;
}

async function markDelivered(eventId) {
  await AIOutboundEvent.findOneAndUpdate(
    { eventId },
    {
      $set: {
        status: 'delivered',
        lastDeliveredAt: new Date(),
        nextAttemptAt: new Date(),
      },
      $unset: {
        lastErrorMessage: 1,
        lastErrorStatus: 1,
      },
    },
  );
}

async function deliverIntelligenceEvent(payload) {
  const response = await postEvent(payload);
  resetRelayCircuit();
  await markDelivered(payload.eventId);
  logRelay('info', 'Delivered intelligence event.', {
    eventId: payload.eventId,
    eventType: payload.eventType,
    source: payload.source,
    status: response?.status || 'accepted',
  });
  return response;
}

async function publishIntelligenceEvent(event, options = {}) {
  let payload;
  try {
    payload = normalizeIntelligenceEvent(event);
  } catch (error) {
    logRelay('warn', 'Ignored unsupported intelligence event.', {
      message: error.message,
      rawEventType: event?.eventType || event?.type || null,
    });
    return null;
  }

  const task = (async () => {
    try {
      return await deliverIntelligenceEvent(payload);
    } catch (error) {
      registerRelayFailure(error);
      await queueFailedEvent(payload, error);
      return null;
    }
  })();

  if (options.awaitPublish === true) {
    return task;
  }

  task.catch((error) => {
    logRelay('error', 'Unexpected intelligence publish failure.', {
      eventId: payload.eventId,
      message: error.message,
      stack: error.stack,
    });
  });
  return undefined;
}

async function flushPendingIntelligenceEvents(limit = FLUSH_BATCH_SIZE) {
  if (!relayEnabled() || flushInFlight) {
    return { skipped: true };
  }

  flushInFlight = true;
  try {
    const now = new Date();
    const records = await AIOutboundEvent.find({
      status: { $in: ['pending', 'retrying'] },
      nextAttemptAt: { $lte: now },
    })
      .sort({ nextAttemptAt: 1, createdAt: 1 })
      .limit(Math.max(1, Number(limit) || FLUSH_BATCH_SIZE));

    for (const record of records) {
      record.status = 'retrying';
      await record.save();

      try {
        await deliverIntelligenceEvent(record.payload || {});
      } catch (error) {
        registerRelayFailure(error);
        record.status = 'pending';
        record.attemptCount = Number(record.attemptCount || 0) + 1;
        record.lastAttemptAt = new Date();
        record.lastErrorMessage = error.message || 'Unknown relay error';
        record.lastErrorStatus = Number(error.status || 0) || undefined;
        record.nextAttemptAt = new Date(Date.now() + computeRetryDelayMs(record.attemptCount));
        await record.save();

        logRelay('warn', 'Retry delivery failed; event remains queued.', {
          eventId: record.eventId,
          eventType: record.eventType,
          attemptCount: record.attemptCount,
          nextAttemptAt: record.nextAttemptAt.toISOString(),
          status: error.status || null,
          message: error.message,
        });
      }
    }

    const remaining = await AIOutboundEvent.countDocuments({
      status: { $in: ['pending', 'retrying'] },
    });
    if (remaining > 0) {
      scheduleFlush(INITIAL_RETRY_DELAY_MS);
    }

    return {
      remaining,
      processed: records.length,
    };
  } finally {
    flushInFlight = false;
  }
}

function startIntelligenceEventRelay() {
  if (relayStarted) {
    return {
      started: true,
      url: buildEventIngestUrl(),
      apiKeyConfigured: Boolean(getEventApiKey()),
      duplicateStart: true,
    };
  }

  relayStarted = true;
  const status = {
    started: relayEnabled(),
    url: buildEventIngestUrl(),
    apiKeyConfigured: Boolean(getEventApiKey()),
  };

  if (relayEnabled()) {
    logRelay('info', 'Intelligence event relay started.', status);
    scheduleFlush(5000);
  } else {
    logRelay('warn', 'Intelligence event relay disabled by configuration.', status);
  }

  return status;
}

module.exports = {
  buildEventIngestUrl,
  computeRetryDelayMs,
  flushPendingIntelligenceEvents,
  mapYmeEventToIntelligenceEvent,
  normalizeIntelligenceEvent,
  publishIntelligenceEvent,
  startIntelligenceEventRelay,
};
