const crypto = require('node:crypto');

const { ingestEvent } = require('../services/eventIngestion.service');
const { enqueueBridgeEvent, enqueueBridgeLog } = require('../services/intelligenceBridge.service');
const { incrementCounter, recordDuration } = require('../services/metrics.service');
const { EVENT_CATEGORIES, ObservabilityEvent } = require('../models/observabilityEvent.model');
const {
  buildTraceId,
  clamp,
  emitStructuredAppLog,
  getRouteGroupFromPath,
  normalizePath,
  safePreview,
} = require('../observability/observability.utils');

const EVENT_CATEGORY_SET = new Set(EVENT_CATEGORIES);
const DEFAULT_DEDUPE_WINDOW_MS = Math.max(
  5000,
  Number(process.env.YENKASA_EVENT_BUS_DEDUPE_WINDOW_MS || 15000),
);
const recentEventCache = new Map();

const CATEGORY_BASE_IMPORTANCE = Object.freeze({
  user_activity: 0.22,
  engagement: 0.48,
  system_error: 0.88,
  api_failure: 0.82,
  upload_failure: 0.78,
  moderation_event: 0.66,
  auth_event: 0.54,
  payment_event: 0.72,
  ai_event: 0.68,
  recommendation_event: 0.52,
  analytics_event: 0.2,
  infrastructure_event: 0.74,
});

const YME_EVENT_CATEGORY_BY_TYPE = Object.freeze({
  like: 'engagement',
  comment: 'engagement',
  share: 'engagement',
  follow: 'engagement',
  unfollow: 'engagement',
  watch: 'user_activity',
  post_view: 'user_activity',
  video_watch: 'user_activity',
  watch_duration: 'user_activity',
  profile_visit: 'user_activity',
  search: 'user_activity',
  chat_message: 'engagement',
  ai_chat_message: 'ai_event',
  chat_response: 'ai_event',
  caption: 'engagement',
  save_post: 'engagement',
  creator_interaction: 'engagement',
  live_stream_join: 'engagement',
  reward_claim: 'payment_event',
  community_join: 'engagement',
  ad_interaction: 'engagement',
  ad_engagement: 'engagement',
  notification_open: 'engagement',
  live_interaction: 'engagement',
});

function hashValue(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function inferCategory(event = {}) {
  const directCategory = String(event.category || '').trim().toLowerCase();
  if (EVENT_CATEGORY_SET.has(directCategory)) return directCategory;

  const eventType = String(event.eventType || event.type || event.eventName || '').trim().toLowerCase();
  if (YME_EVENT_CATEGORY_BY_TYPE[eventType]) {
    return YME_EVENT_CATEGORY_BY_TYPE[eventType];
  }

  if (String(event.severity || '').toLowerCase() === 'error') return 'system_error';
  if (Number(event.statusCode || 0) >= 500) return 'api_failure';
  return 'analytics_event';
}

function normalizeSeverity(event = {}, category = 'analytics_event') {
  const normalized = String(event.severity || '').trim().toLowerCase();
  if (normalized) return normalized;
  if (category === 'system_error' || category === 'api_failure') return 'error';
  if (category === 'upload_failure' || category === 'moderation_event') return 'warn';
  return 'info';
}

function shouldMirrorToLogs(event = {}) {
  return ['system_error', 'api_failure', 'upload_failure', 'infrastructure_event'].includes(
    event.category,
  );
}

function scorePlatformImportance(event = {}) {
  let score = CATEGORY_BASE_IMPORTANCE[event.category] ?? 0.2;

  if (Number(event.statusCode || 0) >= 500) score += 0.08;
  if (Number(event.statusCode || 0) === 401 || Number(event.statusCode || 0) === 403) score += 0.05;
  if (Number(event.latencyMs || 0) >= 1000) score += 0.05;
  if (Number(event.latencyMs || 0) >= 3000) score += 0.07;
  if (event.ymeEligible) score += 0.05;
  if (event.eventName && /failed|error|crash|timeout|disconnect/i.test(event.eventName)) score += 0.07;
  if (event.eventName && /report|reject|suspend|block/i.test(event.eventName)) score += 0.06;
  if (event.metadata?.watchTimeMs >= 30000) score += 0.05;
  if (event.metadata?.engagementValue >= 1) score += 0.04;

  const importanceScore = clamp(score, 0.01, 0.99);
  const importanceBand =
    importanceScore >= 0.75 ? 'high' : importanceScore >= 0.45 ? 'medium' : 'low';

  return {
    importanceScore,
    importanceBand,
  };
}

function buildDedupeKey(event = {}) {
  if (event.dedupeKey) return String(event.dedupeKey);

  return hashValue(
    JSON.stringify({
      category: event.category,
      eventName: event.eventName,
      eventType: event.eventType,
      userId: event.userId,
      contentId: event.contentId,
      conversationId: event.conversationId,
      routePath: event.routePath,
      statusCode: event.statusCode,
      clientEventId: event.metadata?.clientEventId || '',
      preview: event.metadata?.payloadPreview || '',
    }),
  );
}

function isDuplicate(event = {}) {
  const dedupeWindowMs = Math.max(1000, Number(event.dedupeWindowMs || DEFAULT_DEDUPE_WINDOW_MS));
  const now = Date.now();
  const dedupeKey = buildDedupeKey(event);
  const previous = recentEventCache.get(dedupeKey) || 0;

  for (const [key, timestamp] of recentEventCache.entries()) {
    if (now - timestamp > dedupeWindowMs * 4) {
      recentEventCache.delete(key);
    }
  }

  if (previous && now - previous < dedupeWindowMs) {
    return {
      duplicate: true,
      dedupeKey,
    };
  }

  recentEventCache.set(dedupeKey, now);
  return {
    duplicate: false,
    dedupeKey,
  };
}

function normalizeEvent(rawEvent = {}, options = {}) {
  const payload = rawEvent.payload || rawEvent.data || {};
  const metadata = {
    ...(rawEvent.metadata || {}),
    ...(typeof payload === 'object' && payload !== null ? payload : {}),
  };
  const eventType = String(rawEvent.eventType || rawEvent.type || rawEvent.eventName || '').trim().toLowerCase();
  const category = inferCategory({ ...rawEvent, eventType });
  const severity = normalizeSeverity(rawEvent, category);
  const routePath = normalizePath(rawEvent.routePath || metadata.path || metadata.routePath || '');
  const eventName = String(rawEvent.eventName || eventType || `${category}_event`)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const ymeEligible =
    rawEvent.ymeEligible === true ||
    (Boolean(rawEvent.userId || options.defaults?.userId) && Boolean(YME_EVENT_CATEGORY_BY_TYPE[eventType]));

  const normalized = {
    traceId: buildTraceId(rawEvent.traceId || options.traceId),
    parentTraceId: String(rawEvent.parentTraceId || '').trim(),
    category,
    eventName,
    eventType,
    severity,
    sourceApp: String(rawEvent.sourceApp || rawEvent.source || options.defaults?.sourceApp || 'social_app')
      .trim()
      .toLowerCase(),
    sourceModule: String(rawEvent.sourceModule || rawEvent.source || options.defaults?.sourceModule || 'event_bus').trim(),
    routePath,
    routeGroup: String(rawEvent.routeGroup || getRouteGroupFromPath(routePath)).trim(),
    httpMethod: String(rawEvent.httpMethod || metadata.method || '').trim().toUpperCase(),
    statusCode: Number(rawEvent.statusCode || metadata.statusCode || 0),
    latencyMs: Math.max(0, Number(rawEvent.latencyMs || metadata.latencyMs || 0)),
    userId: String(rawEvent.userId || options.defaults?.userId || '').trim(),
    relatedUserId: String(rawEvent.relatedUserId || metadata.relatedUserId || '').trim(),
    creatorId: String(rawEvent.creatorId || metadata.creatorId || '').trim(),
    communityId: String(rawEvent.communityId || metadata.communityId || '').trim(),
    contentId: String(rawEvent.contentId || rawEvent.postId || metadata.contentId || metadata.postId || '').trim(),
    conversationId: String(rawEvent.conversationId || metadata.conversationId || metadata.roomId || '').trim(),
    sessionId: String(rawEvent.sessionId || rawEvent.session || metadata.sessionId || '').trim(),
    clientPlatform: String(rawEvent.clientPlatform || metadata.clientPlatform || metadata.platform || '').trim(),
    appVersion: String(rawEvent.appVersion || metadata.appVersion || '').trim(),
    occurredAt: rawEvent.occurredAt || rawEvent.timestamp ? new Date(rawEvent.occurredAt || rawEvent.timestamp) : new Date(),
    ymeEligible,
    payload,
    metadata: {
      ...metadata,
      traceId: buildTraceId(rawEvent.traceId || options.traceId),
      payloadPreview: safePreview(payload),
    },
  };

  const { importanceScore, importanceBand } = scorePlatformImportance(normalized);
  normalized.importanceScore = importanceScore;
  normalized.importanceBand = importanceBand;
  normalized.dedupeKey = buildDedupeKey(normalized);
  return normalized;
}

function buildYmePayload(event = {}) {
  return {
    userId: event.userId,
    sourceApp: event.sourceApp,
    eventType: event.eventType || event.eventName,
    sessionId: event.sessionId,
    conversationId: event.conversationId,
    contentId: event.contentId,
    creatorId: event.creatorId,
    relatedUserId: event.relatedUserId,
    communityId: event.communityId,
    text: event.payload?.text || event.payload?.message || event.metadata?.message || '',
    caption: event.payload?.caption || '',
    query: event.payload?.query || event.metadata?.query || '',
    watchTimeMs: event.payload?.watchTimeMs || event.metadata?.watchTimeMs || 0,
    durationMs: event.payload?.durationMs || event.metadata?.durationMs || event.latencyMs || 0,
    engagementValue: event.payload?.engagementValue || event.metadata?.engagementValue || 0,
    clientPlatform: event.clientPlatform,
    appVersion: event.appVersion,
    traceId: event.traceId,
    payload: {
      ...event.payload,
      ...event.metadata,
      traceId: event.traceId,
      routePath: event.routePath,
      routeGroup: event.routeGroup,
      statusCode: event.statusCode,
      latencyMs: event.latencyMs,
    },
    timestamp: event.occurredAt,
  };
}

function buildBridgeEventPayload(event = {}) {
  return {
    event_type: event.eventType || event.eventName,
    user_id: event.userId || null,
    app_source: event.sourceApp,
    category: event.category,
    source_module: event.sourceModule,
    trace_id: event.traceId,
    severity: event.severity,
    importance_score: event.importanceScore,
    importance_band: event.importanceBand,
    yme_eligible: event.ymeEligible,
    timestamp: event.occurredAt,
    metadata: {
      ...event.metadata,
      route_path: event.routePath,
      route_group: event.routeGroup,
      event_name: event.eventName,
      http_method: event.httpMethod,
      status_code: event.statusCode,
      latency_ms: event.latencyMs,
      content_id: event.contentId,
      creator_id: event.creatorId,
      community_id: event.communityId,
      related_user_id: event.relatedUserId,
      conversation_id: event.conversationId,
      session_id: event.sessionId,
      client_platform: event.clientPlatform,
      app_version: event.appVersion,
    },
  };
}

function buildBridgeLogPayload(event = {}) {
  return {
    service: `regloginbackend.${event.sourceModule || 'app'}`.slice(0, 120),
    level: event.severity,
    timestamp: event.occurredAt,
    message: `${event.category}:${event.eventName}`,
    stack_trace: event.payload?.stack || event.metadata?.stack || null,
    metadata: {
      trace_id: event.traceId,
      route_path: event.routePath,
      route_group: event.routeGroup,
      user_id: event.userId || null,
      status_code: event.statusCode,
      latency_ms: event.latencyMs,
      category: event.category,
      source_module: event.sourceModule,
      event_type: event.eventType,
      payload_preview: event.metadata?.payloadPreview || '',
    },
  };
}

async function processEvent(normalizedEvent = {}) {
  const startedAt = Date.now();
  const persistedEvent = await ObservabilityEvent.create({
    ...normalizedEvent,
    status: 'processing',
    sinkStatus: {
      yme: { status: normalizedEvent.ymeEligible ? 'pending' : 'skipped' },
      intelligence: { status: 'pending' },
      logs: { status: shouldMirrorToLogs(normalizedEvent) ? 'pending' : 'skipped' },
    },
  });

  const sinkStatus = {
    yme: { ...(persistedEvent.sinkStatus?.yme?.toObject?.() || persistedEvent.sinkStatus?.yme || {}) },
    intelligence: {
      ...(persistedEvent.sinkStatus?.intelligence?.toObject?.() ||
        persistedEvent.sinkStatus?.intelligence ||
        {}),
    },
    logs: { ...(persistedEvent.sinkStatus?.logs?.toObject?.() || persistedEvent.sinkStatus?.logs || {}) },
  };
  let finalStatus = 'processed';

  if (normalizedEvent.ymeEligible && normalizedEvent.userId) {
    try {
      const ymeResult = await ingestEvent(buildYmePayload(normalizedEvent), {
        defaults: {
          userId: normalizedEvent.userId,
          sourceApp: normalizedEvent.sourceApp,
        },
      });
      sinkStatus.yme = {
        status: ymeResult?.skipped ? 'skipped' : 'processed',
        attempts: 1,
        completedAt: new Date(),
        referenceId: String(ymeResult?.event?._id || ''),
        metadata: {
          skipped: Boolean(ymeResult?.skipped),
          dispatchMode: ymeResult?.dispatch?.mode || '',
          queueName: ymeResult?.dispatch?.queueName || '',
        },
      };
    } catch (error) {
      finalStatus = 'partial_failure';
      sinkStatus.yme = {
        status: 'failed',
        attempts: 1,
        completedAt: new Date(),
        lastError: error.message,
        metadata: {},
      };
    }
  }

  try {
    const bridgeResult = enqueueBridgeEvent(buildBridgeEventPayload(normalizedEvent));
    sinkStatus.intelligence = {
      status: bridgeResult.queued ? 'queued' : 'skipped',
      attempts: bridgeResult.queued ? 1 : 0,
      queuedAt: bridgeResult.queued ? new Date() : null,
      lastError: bridgeResult.queued ? '' : bridgeResult.reason || '',
      metadata: bridgeResult,
    };
  } catch (error) {
    finalStatus = finalStatus === 'processed' ? 'partial_failure' : finalStatus;
    sinkStatus.intelligence = {
      status: 'failed',
      attempts: 1,
      completedAt: new Date(),
      lastError: error.message,
      metadata: {},
    };
  }

  if (shouldMirrorToLogs(normalizedEvent)) {
    try {
      const logResult = enqueueBridgeLog(buildBridgeLogPayload(normalizedEvent));
      sinkStatus.logs = {
        status: logResult.queued ? 'queued' : 'skipped',
        attempts: logResult.queued ? 1 : 0,
        queuedAt: logResult.queued ? new Date() : null,
        lastError: logResult.queued ? '' : logResult.reason || '',
        metadata: logResult,
      };
    } catch (error) {
      finalStatus = finalStatus === 'processed' ? 'partial_failure' : finalStatus;
      sinkStatus.logs = {
        status: 'failed',
        attempts: 1,
        completedAt: new Date(),
        lastError: error.message,
        metadata: {},
      };
    }
  }

  if (
    normalizedEvent.ymeEligible &&
    sinkStatus.yme.status === 'failed' &&
    sinkStatus.intelligence.status !== 'queued' &&
    sinkStatus.logs.status !== 'queued'
  ) {
    finalStatus = 'failed';
  }

  const durationMs = Date.now() - startedAt;
  recordDuration('eventBusProcess', durationMs);
  await ObservabilityEvent.updateOne(
    { _id: persistedEvent._id },
    {
      $set: {
        status: finalStatus,
        completedAt: new Date(),
        sinkStatus,
      },
    },
  );

  if (finalStatus !== 'processed') {
    emitStructuredAppLog({
      severity: finalStatus === 'failed' ? 'ERROR' : 'WARN',
      component: 'yme.event_bus',
      message: 'Central event pipeline completed with degraded status.',
      data: {
        traceId: normalizedEvent.traceId,
        category: normalizedEvent.category,
        eventName: normalizedEvent.eventName,
        userId: normalizedEvent.userId || null,
        status: finalStatus,
      },
    });
  }

  return {
    accepted: true,
    traceId: normalizedEvent.traceId,
    status: finalStatus,
    observabilityEventId: persistedEvent._id.toString(),
    sinkStatus,
  };
}

function publishEvent(rawEvent = {}, options = {}) {
  const normalizedEvent = normalizeEvent(rawEvent, options);
  const duplicateCheck = isDuplicate(normalizedEvent);
  normalizedEvent.dedupeKey = duplicateCheck.dedupeKey;

  if (duplicateCheck.duplicate) {
    incrementCounter('eventBusDuplicates');
    return options.awaitPublish === true
      ? Promise.resolve({
          accepted: false,
          duplicate: true,
          traceId: normalizedEvent.traceId,
          dedupeKey: normalizedEvent.dedupeKey,
        })
      : undefined;
  }

  incrementCounter('eventBusAccepted');
  const task = processEvent(normalizedEvent).catch((error) => {
    incrementCounter('eventBusFailures');
    emitStructuredAppLog({
      severity: 'ERROR',
      component: 'yme.event_bus',
      message: 'Central event pipeline failed.',
      data: {
        traceId: normalizedEvent.traceId,
        category: normalizedEvent.category,
        eventName: normalizedEvent.eventName,
        error: error.message,
      },
    });
    return {
      accepted: false,
      traceId: normalizedEvent.traceId,
      error: error.message,
    };
  });

  return options.awaitPublish === true ? task : undefined;
}

function publishEventBatch(events = [], options = {}) {
  const items = Array.isArray(events) ? events : [];
  const tasks = items.map((event) => publishEvent(event, { ...options, awaitPublish: true }));
  const batchTask = Promise.all(tasks);
  return options.awaitPublish === true ? batchTask : undefined;
}

module.exports = {
  EVENT_CATEGORIES,
  publishEvent,
  publishEventBatch,
  normalizeEvent,
};
