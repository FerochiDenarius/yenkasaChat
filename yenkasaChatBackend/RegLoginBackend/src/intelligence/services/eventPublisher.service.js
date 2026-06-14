const crypto = require('node:crypto');

const AIOutboundEvent = require('../../../models/aiOutboundEvent.model');

const DEFAULT_ENGINE_URL =
  process.env.YENKASA_AI_ENGINE_URL ||
  'https://yenkasa-ai-backend-496173204476.europe-west1.run.app';
const DEFAULT_EVENT_PATH = process.env.YENKASA_AI_EVENT_INGEST_PATH || '/api/events/ingest';
const DEFAULT_HEALTH_PATH = process.env.YENKASA_AI_EVENT_HEALTH_PATH || '/health';
const REQUEST_TIMEOUT_MS = Number(process.env.YENKASA_AI_EVENT_TIMEOUT_MS || 65000);
const HEALTH_TIMEOUT_MS = Number(
  process.env.YENKASA_AI_EVENT_HEALTH_TIMEOUT_MS || Math.min(REQUEST_TIMEOUT_MS, 10000),
);
const INITIAL_RETRY_DELAY_MS = Number(process.env.YENKASA_AI_EVENT_RETRY_DELAY_MS || 15000);
const MAX_RETRY_DELAY_MS = Number(process.env.YENKASA_AI_EVENT_MAX_RETRY_DELAY_MS || 300000);
const FLUSH_BATCH_SIZE = Number(process.env.YENKASA_AI_EVENT_FLUSH_BATCH_SIZE || 25);
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = Number(
  process.env.YENKASA_AI_EVENT_CIRCUIT_BREAKER_FAILURE_THRESHOLD || 8,
);
const CIRCUIT_BREAKER_COOLDOWN_MS = Number(
  process.env.YENKASA_AI_EVENT_CIRCUIT_BREAKER_COOLDOWN_MS || 120000,
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
  'stream_started',
  'stream_ended',
  'stream_joined',
  'stream_left',
  'stream_comment',
  'stream_like',
  'stream_gift',
  'stream_share',
  'stream_report',
  'stream_follow_host',
  'stream_pin_comment',
  'stream_moderation_action',
  'stream_ban_user',
  'stream_warning',
  'stream_view_duration',
  'stream_peak_viewers',
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
  'community_post_created',
  'notification_sent',
  'notification_opened',
  'notification_dismissed',
  'server_incident',
  'client_created',
  'client_updated',
  'client_status_updated',
  'lead_created',
  'lead_updated',
  'lead_converted_to_client',
  'project_request_submitted',
  'project_request_status_updated',
  'project_request_approved',
  'project_created',
  'project_updated',
  'project_team_assigned',
  'project_milestones_updated',
  'requirements_generation_deferred',
  'requirements_generated',
  'requirement_ownership_applied',
  'requirement_created',
  'requirement_updated',
  'requirement_comment_added',
  'requirement_change_request_created',
  'requirement_attachment_uploaded',
  'quotation_sent',
  'quotation_response',
  'proposal_generated',
  'invoice_created',
  'payment_recorded',
  'document_uploaded',
  'portfolio_project_upserted',
  'project_ai_assistant_used',
]);

let flushTimer = null;
let flushInFlight = false;
let relayStarted = false;
const relayCircuit = {
  state: 'closed',
  consecutiveFailures: 0,
  openUntil: 0,
  halfOpenProbeInFlight: false,
  lastOpenedAt: 0,
  lastHalfOpenAt: 0,
  lastSuccessAt: 0,
  lastFailureAt: 0,
  lastFailureStatus: null,
  lastFailureMessage: null,
  lastTargetUrl: '',
  lastRequestDurationMs: 0,
};

function relayEnabled() {
  return process.env.YENKASA_AI_EVENT_RELAY_ENABLED !== 'false';
}

function buildEventIngestUrl() {
  const explicitUrl = String(process.env.YENKASA_AI_EVENT_INGEST_URL || '').trim();
  if (explicitUrl) return explicitUrl;

  const base = String(DEFAULT_ENGINE_URL || '').trim().replace(/\/$/, '');
  const path = String(DEFAULT_EVENT_PATH || '/api/events').startsWith('/')
    ? String(DEFAULT_EVENT_PATH || '/api/events')
    : `/${String(DEFAULT_EVENT_PATH || 'api/events')}`;

  return `${base}${path}`;
}

function buildRelayHealthUrl() {
  const explicitUrl = String(process.env.YENKASA_AI_EVENT_HEALTH_URL || '').trim();
  if (explicitUrl) return explicitUrl;

  const base = String(DEFAULT_ENGINE_URL || '').trim().replace(/\/$/, '');
  const path = String(DEFAULT_HEALTH_PATH || '/health').startsWith('/')
    ? String(DEFAULT_HEALTH_PATH || '/health')
    : `/${String(DEFAULT_HEALTH_PATH || 'health')}`;

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

function isoTimestamp(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function getRelayStatus() {
  return {
    enabled: relayEnabled(),
    targetUrl: buildEventIngestUrl(),
    targetHealthUrl: buildRelayHealthUrl(),
    apiKeyConfigured: Boolean(getEventApiKey()),
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    healthTimeoutMs: HEALTH_TIMEOUT_MS,
    retryDelayMs: {
      initial: INITIAL_RETRY_DELAY_MS,
      max: MAX_RETRY_DELAY_MS,
    },
    circuit: {
      state: relayCircuit.state,
      consecutiveFailures: relayCircuit.consecutiveFailures,
      failureThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
      openUntil: isoTimestamp(relayCircuit.openUntil),
      halfOpenProbeInFlight: relayCircuit.halfOpenProbeInFlight,
      lastOpenedAt: isoTimestamp(relayCircuit.lastOpenedAt),
      lastHalfOpenAt: isoTimestamp(relayCircuit.lastHalfOpenAt),
      lastSuccessAt: isoTimestamp(relayCircuit.lastSuccessAt),
      lastFailureAt: isoTimestamp(relayCircuit.lastFailureAt),
      lastFailureStatus: relayCircuit.lastFailureStatus,
      lastFailureMessage: relayCircuit.lastFailureMessage,
      lastTargetUrl: relayCircuit.lastTargetUrl || null,
      lastRequestDurationMs: relayCircuit.lastRequestDurationMs || 0,
    },
  };
}

function isRelayCircuitOpen() {
  if (relayCircuit.state !== 'open') return false;
  if (relayCircuit.openUntil <= Date.now()) {
    relayCircuit.state = 'half_open';
    relayCircuit.halfOpenProbeInFlight = false;
    relayCircuit.lastHalfOpenAt = Date.now();
    logRelay('info', 'AI event relay circuit moved to half-open.', getRelayStatus());
    return false;
  }
  return relayCircuit.openUntil > Date.now();
}

function resetRelayCircuit() {
  const previousState = relayCircuit.state;
  const previousFailures = relayCircuit.consecutiveFailures;
  relayCircuit.state = 'closed';
  relayCircuit.consecutiveFailures = 0;
  relayCircuit.openUntil = 0;
  relayCircuit.halfOpenProbeInFlight = false;
  relayCircuit.lastSuccessAt = Date.now();
  relayCircuit.lastFailureStatus = null;
  relayCircuit.lastFailureMessage = null;

  if (previousState !== 'closed') {
    logRelay('info', 'AI event relay circuit recovered.', getRelayStatus());
    return;
  }

  if (previousFailures > 0) {
    logRelay('info', 'AI event relay failure streak cleared after successful delivery.', {
      consecutiveFailuresCleared: previousFailures,
      targetUrl: relayCircuit.lastTargetUrl || buildEventIngestUrl(),
      durationMs: relayCircuit.lastRequestDurationMs || 0,
    });
  }
}

function buildRelayRequestPayload(payload = {}) {
  const metadata = safeObject(payload.metadata);

  if (payload.eventId && !metadata.eventId) metadata.eventId = String(payload.eventId);
  if (payload.sessionId && !metadata.sessionId) metadata.sessionId = String(payload.sessionId);
  if (payload.requestId && !metadata.requestId) metadata.requestId = String(payload.requestId);
  if (payload.traceId && !metadata.traceId) metadata.traceId = String(payload.traceId);
  if (payload.eventType && !metadata.sourceEventType) metadata.sourceEventType = String(payload.eventType);

  return {
    event_type: String(payload.eventType || '').trim(),
    user_id: String(payload.userId || metadata.userId || 'anonymous').trim() || 'anonymous',
    app_source: String(payload.source || 'yenkasa_app').trim() || 'yenkasa_app',
    timestamp: normalizeTimestamp(payload.timestamp),
    metadata,
  };
}

function markRelayAttempt(targetUrl, durationMs) {
  relayCircuit.lastTargetUrl = targetUrl;
  relayCircuit.lastRequestDurationMs = durationMs;
}

function allowRelayAttempt() {
  if (isRelayCircuitOpen()) {
    const error = new Error('AI event relay circuit is open.');
    error.code = 'relay_circuit_open';
    error.status = 503;
    throw error;
  }

  if (relayCircuit.state === 'half_open') {
    if (relayCircuit.halfOpenProbeInFlight) {
      const error = new Error('AI event relay half-open probe is already in flight.');
      error.code = 'relay_circuit_half_open';
      error.status = 503;
      throw error;
    }
    relayCircuit.halfOpenProbeInFlight = true;
  }
}

function shouldCountRelayFailure(error) {
  return !['relay_circuit_open', 'relay_circuit_half_open'].includes(String(error?.code || ''));
}

function registerRelayFailure(error, diagnostics = {}) {
  relayCircuit.consecutiveFailures += 1;
  relayCircuit.lastFailureAt = Date.now();
  relayCircuit.lastFailureStatus = Number(error?.status || 0) || null;
  relayCircuit.lastFailureMessage = error?.message || 'relay_failure';
  relayCircuit.halfOpenProbeInFlight = false;

  if (diagnostics.targetUrl) relayCircuit.lastTargetUrl = diagnostics.targetUrl;
  if (diagnostics.durationMs != null) {
    relayCircuit.lastRequestDurationMs = Number(diagnostics.durationMs) || 0;
  }

  if (
    relayCircuit.state === 'half_open' ||
    relayCircuit.consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD
  ) {
    relayCircuit.state = 'open';
    relayCircuit.lastOpenedAt = Date.now();
    relayCircuit.openUntil = relayCircuit.lastOpenedAt + CIRCUIT_BREAKER_COOLDOWN_MS;
    logRelay('warn', 'AI event relay circuit opened.', {
      ...getRelayStatus(),
      consecutiveFailures: relayCircuit.consecutiveFailures,
      cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
      durationMs: diagnostics.durationMs || 0,
      status: error?.status || null,
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

  if (eventType === 'server_incident') {
    metadata.component = metadata.component || event.component || 'server';
    metadata.severity = metadata.severity || event.severity || 'error';
    metadata.incidentType = metadata.incidentType || event.incidentType || 'log';
    metadata.message = metadata.message || event.message || '';
    metadata.stack = metadata.stack || event.stack || '';
    metadata.sourceFile = metadata.sourceFile || event.sourceFile || '';
    metadata.operationalEvent = metadata.operationalEvent || {
      eventType: 'SERVER_INCIDENT',
      timestamp: normalizeTimestamp(event.timestamp || event.occurredAt || event.createdAt),
      metadata: {
        component: metadata.component,
        severity: metadata.severity,
        incidentType: metadata.incidentType,
        message: metadata.message,
        sourceFile: metadata.sourceFile,
      },
    };
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
      'stream_started',
      'stream_ended',
      'stream_joined',
      'stream_left',
      'stream_comment',
      'stream_like',
      'stream_gift',
      'stream_share',
      'stream_report',
      'stream_follow_host',
      'stream_pin_comment',
      'stream_moderation_action',
      'stream_ban_user',
      'stream_warning',
      'stream_view_duration',
      'stream_peak_viewers',
    ].includes(type)
  ) {
    const metadata = event.payload || event.metadata || {};
    return normalizeIntelligenceEvent({
      ...base,
      eventType: type,
      metadata: {
        roomId: metadata.roomId || metadata.streamId || event.contentId || null,
        streamId: metadata.streamId || event.contentId || null,
        hostId: metadata.hostId || event.relatedUserId || event.creatorId || null,
        relatedUserId: event.relatedUserId || null,
        viewerCount: Number(metadata.viewerCount || 0),
        peakViewerCount: Number(metadata.peakViewerCount || metadata.peakViewers || 0),
        durationMs: Number(metadata.durationMs || metadata.watchTimeMs || 0),
        amount: Number(metadata.amount || 0),
        giftKey: metadata.giftKey || '',
        action: metadata.action || '',
        reason: metadata.reason || '',
        metrics: metadata.metrics || {},
        moderationSignals: metadata.moderationSignals || [],
        recommendationSignals: metadata.recommendationSignals || [],
        text: metadata.text || metadata.message || '',
        operationalEvent: {
          eventType: String(type || '').toUpperCase(),
          streamId: metadata.streamId || event.contentId || null,
          userId: event.userId || null,
          hostId: metadata.hostId || event.relatedUserId || event.creatorId || null,
          timestamp: base.timestamp,
          metadata,
        },
      },
    });
  }

  if (
    [
      'community_post_created',
      'notification_sent',
      'notification_opened',
      'notification_dismissed',
    ].includes(type)
  ) {
    const metadata = event.payload || event.metadata || {};
    return normalizeIntelligenceEvent({
      ...base,
      eventType: type,
      postId: metadata.postId || event.postId,
      communityId: metadata.communityId || event.communityId,
      metadata: {
        notificationId: metadata.notificationId || event.contentId || null,
        notificationType: metadata.notificationType || metadata.eventType || type,
        postId: metadata.postId || event.postId || null,
        streamId: metadata.streamId || null,
        communityId: metadata.communityId || event.communityId || null,
        communityName: metadata.communityName || '',
        authorId: metadata.authorId || null,
        authorName: metadata.authorName || '',
        hostId: metadata.hostId || null,
        hostName: metadata.hostName || '',
        receiverId: metadata.receiverId || event.userId || null,
        senderId: metadata.senderId || event.relatedUserId || event.creatorId || null,
        targetType: metadata.targetType || '',
        targetId: metadata.targetId || '',
        targetUrl: metadata.targetUrl || '',
        deliveryChannels: metadata.deliveryChannels || {},
        text: metadata.message || metadata.title || event.text || '',
        operationalEvent: {
          eventType: String(type || '').toUpperCase(),
          userId: event.userId || null,
          timestamp: base.timestamp,
          metadata,
        },
      },
    });
  }

  if (type === 'server_incident') {
    const metadata = event.payload || event.metadata || {};
    return normalizeIntelligenceEvent({
      ...base,
      eventType: 'server_incident',
      metadata: {
        component: metadata.component || event.component || 'server',
        severity: metadata.severity || event.severity || 'error',
        incidentType: metadata.incidentType || event.incidentType || 'log',
        message: metadata.message || event.message || '',
        logArguments: metadata.logArguments || [],
        stack: metadata.stack || event.stack || '',
        pid: Number(metadata.pid || process.pid || 0),
        hostname: metadata.hostname || '',
        nodeEnv: metadata.nodeEnv || process.env.NODE_ENV || '',
        sourceFile: metadata.sourceFile || event.sourceFile || '',
        operationalEvent: {
          eventType: 'SERVER_INCIDENT',
          timestamp: base.timestamp,
          metadata,
        },
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

async function probeRelayTargetHealth() {
  const targetUrl = buildRelayHealthUrl();
  const startedAt = Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const durationMs = Date.now() - startedAt;
    const body = await parseResponse(response);

    return {
      ok: response.ok,
      status: response.status,
      targetUrl,
      durationMs,
      body,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';

    return {
      ok: false,
      status: timeout ? 504 : null,
      targetUrl,
      durationMs,
      body: null,
      message: timeout
        ? `Relay target health probe timed out after ${HEALTH_TIMEOUT_MS}ms`
        : error?.message || 'Relay target health probe failed.',
    };
  }
}

async function postEvent(payload) {
  if (!relayEnabled()) {
    return { skipped: true, reason: 'relay_disabled' };
  }

  allowRelayAttempt();

  const headers = {
    'Content-Type': 'application/json',
  };
  const apiKey = getEventApiKey();
  if (apiKey) {
    headers['X-Event-Api-Key'] = apiKey;
  }

  const targetUrl = buildEventIngestUrl();
  const relayPayload = buildRelayRequestPayload(payload);
  const startedAt = Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(relayPayload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const durationMs = Date.now() - startedAt;
    markRelayAttempt(targetUrl, durationMs);
    const body = await parseResponse(response);

    if (!response.ok) {
      logRelay('warn', 'AI event relay request failed.', {
        targetUrl,
        durationMs,
        timeoutMs: REQUEST_TIMEOUT_MS,
        authHeaderPresent: Boolean(apiKey),
        status: response.status,
        responseBody: body,
      });
      const error = new Error(
        body?.detail || body?.message || `Event ingest failed with status ${response.status}`,
      );
      error.status = response.status;
      error.body = body;
      throw error;
    }

    logRelay('info', 'AI event relay request succeeded.', {
      targetUrl,
      durationMs,
      authHeaderPresent: Boolean(apiKey),
      status: response.status,
    });

    return {
      ...body,
      relayStatusCode: response.status,
      relayDurationMs: durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    markRelayAttempt(targetUrl, durationMs);
    relayCircuit.halfOpenProbeInFlight = false;

    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    if (timeout) {
      error.message = `Relay request timed out after ${REQUEST_TIMEOUT_MS}ms`;
      error.status = error.status || 504;
    }

    logRelay('error', 'AI event relay request errored.', {
      targetUrl,
      durationMs,
      timeoutMs: REQUEST_TIMEOUT_MS,
      timeout,
      authHeaderPresent: Boolean(apiKey),
      status: error?.status || null,
      reason: error?.code || error?.name || 'relay_error',
      responseBody: error?.body || null,
      message: error?.message || 'Unknown relay error',
    });
    throw error;
  }
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
      if (shouldCountRelayFailure(error)) {
        registerRelayFailure(error, {
          targetUrl: buildEventIngestUrl(),
          durationMs: relayCircuit.lastRequestDurationMs,
        });
      }
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
        if (shouldCountRelayFailure(error)) {
          registerRelayFailure(error, {
            targetUrl: buildEventIngestUrl(),
            durationMs: relayCircuit.lastRequestDurationMs,
          });
        }
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
      ...getRelayStatus(),
      started: true,
      duplicateStart: true,
    };
  }

  relayStarted = true;
  const status = {
    ...getRelayStatus(),
    started: relayEnabled(),
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
  buildRelayHealthUrl,
  buildRelayRequestPayload,
  computeRetryDelayMs,
  flushPendingIntelligenceEvents,
  getRelayStatus,
  mapYmeEventToIntelligenceEvent,
  normalizeIntelligenceEvent,
  probeRelayTargetHealth,
  publishIntelligenceEvent,
  startIntelligenceEventRelay,
};
