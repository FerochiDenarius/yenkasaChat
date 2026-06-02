const UserEvent = require('../models/userEvent.model');
const { getYmeConfig } = require('../config/yme.config');
const { incrementCounter, recordDuration } = require('./metrics.service');
const { writeMemoryLog } = require('./log.service');
const { enqueueEventProcessingJob, isQueueEnabled } = require('./queue.service');
const { buildEmbeddingPolicy } = require('./embeddingPolicy.service');
const { applyEventGuards } = require('./eventGuard.service');
const { scoreEventImportance } = require('./importanceScoring.service');
const { validateEventContract } = require('../contracts/event.contract');
const { normalizeText } = require('../utils/textNormalizer');
const {
  ensureArray,
  pickFirstNumber,
  toDate,
  toObjectId,
  uniqueStrings,
} = require('../utils/yme.utils');

const EVENT_TYPE_ALIASES = new Map([
  ['post_like', 'like'],
  ['post_liked', 'like'],
  ['comment_created', 'comment'],
  ['comment_deleted', 'comment_deleted'],
  ['post_created', 'caption'],
  ['post_deleted', 'post_deleted'],
  ['video_watch', 'watch'],
  ['watch_duration', 'watch_duration'],
  ['post_view', 'post_view'],
  ['post_viewed', 'post_view'],
  ['post_shared', 'share'],
  ['creator_profile_view', 'creator_interaction'],
  ['profile_viewed', 'profile_visit'],
  ['chat_message_sent', 'chat_message'],
  ['chat_sent', 'chat_message'],
  ['chat_response_received', 'chat_response'],
  ['ai_chat_message', 'ai_chat_message'],
  ['chat_read', 'chat_read'],
  ['chat_deleted', 'chat_deleted'],
  ['caption_submit', 'caption'],
  ['save_post', 'save_post'],
  ['ad_interaction', 'ad_interaction'],
  ['ad_click', 'ad_engagement'],
  ['ad_view', 'ad_engagement'],
  ['live_comment', 'stream_comment'],
  ['live_stream_join', 'stream_joined'],
  ['live_join', 'stream_joined'],
  ['live_joined', 'stream_joined'],
  ['live_started', 'stream_started'],
  ['live_left', 'stream_left'],
  ['live_reaction', 'stream_like'],
  ['live_ended', 'stream_ended'],
  ['viewer_count_updated', 'stream_peak_viewers'],
  ['guest_request', 'guest_request'],
  ['guest_approved', 'guest_approved'],
  ['guest_declined', 'guest_declined'],
  ['reward_claim', 'reward_claim'],
  ['community_join', 'community_join'],
  ['community_post_created', 'community_post_created'],
  ['notification_sent', 'notification_sent'],
  ['notification_opened', 'notification_opened'],
  ['notification_dismissed', 'notification_dismissed'],
  ['follow_user', 'follow'],
  ['unfollow_user', 'unfollow'],
  ['gift_sent', 'gift_sent'],
  ['wallet_transfer', 'wallet_transfer'],
]);

const LOCAL_BACKGROUND_QUEUE = 'ymeLocalBackgroundQueue';

function logNormalizationError(error) {
  console.error('[YME_NORMALIZATION_ERROR]', {
    message: error.message,
    stack: error.stack,
  });
}

function safeJsonPreview(value, limit = 4096) {
  try {
    return JSON.stringify(value).slice(0, limit);
  } catch (_error) {
    return '[unserializable_payload]';
  }
}

function normalizeEventType(eventType) {
  const normalized = String(eventType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return EVENT_TYPE_ALIASES.get(normalized) || normalized;
}

function resolveTraceId(rawEvent = {}, defaults = {}) {
  return String(
    rawEvent.traceId ||
      rawEvent.requestId ||
      rawEvent.payload?.traceId ||
      rawEvent.payload?.requestId ||
      rawEvent.metadata?.traceId ||
      rawEvent.metadata?.requestId ||
      defaults.traceId ||
      defaults.requestId ||
      '',
  )
    .trim()
    .slice(0, 160);
}

function buildNormalizedText(rawEvent = {}) {
  const safeText = normalizeText(
    [
      rawEvent.text,
      rawEvent.message,
      rawEvent.caption,
      rawEvent.query,
      rawEvent.searchQuery,
      rawEvent.searchTerm,
      rawEvent.prompt,
      rawEvent.title,
      rawEvent.payload?.text,
      rawEvent.payload?.message,
      rawEvent.payload?.caption,
      rawEvent.payload?.query,
      rawEvent.payload?.searchTerm,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return safeText.slice(0, getYmeConfig().api.eventTextLimit);
}

function buildInterestCandidates(rawEvent = {}, normalizedText = '') {
  const safeText = normalizeText(normalizedText || '');
  return uniqueStrings([
    ...ensureArray(rawEvent.category),
    ...ensureArray(rawEvent.categories),
    ...ensureArray(rawEvent.tags),
    ...ensureArray(rawEvent.hashtags),
    ...safeText.split(/\s+/).filter((token) => token.startsWith('#')),
  ]);
}

function normalizeIncomingEvent(rawEvent = {}, defaults = {}) {
  const normalizedText = buildNormalizedText(rawEvent);
  const traceId = resolveTraceId(rawEvent, defaults);
  return {
    userId: toObjectId(rawEvent.userId || defaults.userId),
    sourceApp: String(rawEvent.sourceApp || rawEvent.source || defaults.sourceApp || 'social_app')
      .trim()
      .toLowerCase(),
    eventType: normalizeEventType(rawEvent.eventType || rawEvent.type),
    sessionId: String(rawEvent.sessionId || rawEvent.session || '').trim(),
    clientEventId: String(rawEvent.clientEventId || rawEvent.eventId || '').trim(),
    conversationId: String(rawEvent.conversationId || rawEvent.chatId || '').trim(),
    contentId: String(rawEvent.contentId || rawEvent.videoId || rawEvent.assetId || '').trim(),
    creatorId: toObjectId(rawEvent.creatorId || rawEvent.authorId || rawEvent.profileUserId),
    relatedUserId: toObjectId(rawEvent.relatedUserId || rawEvent.targetUserId || rawEvent.receiverId),
    communityId: toObjectId(rawEvent.communityId),
    postId: toObjectId(rawEvent.postId),
    messageId: String(rawEvent.messageId || '').trim(),
    traceId,
    normalizedText,
    interestCandidates: buildInterestCandidates(rawEvent, normalizedText),
    payload: rawEvent.payload || rawEvent.data || rawEvent.metadata || rawEvent,
    eventMetadata: {
      durationMs: pickFirstNumber(rawEvent.durationMs, rawEvent.payload?.durationMs, 0),
      watchTimeMs: pickFirstNumber(rawEvent.watchTimeMs, rawEvent.payload?.watchTimeMs, 0),
      scrollDurationMs: pickFirstNumber(rawEvent.scrollDurationMs, rawEvent.payload?.scrollDurationMs, 0),
      feedDwellMs: pickFirstNumber(rawEvent.feedDwellMs, rawEvent.payload?.feedDwellMs, 0),
      engagementValue: pickFirstNumber(rawEvent.engagementValue, rawEvent.payload?.engagementValue, 0),
      scrollSpeed: pickFirstNumber(rawEvent.scrollSpeed, rawEvent.payload?.scrollSpeed, 0),
      skipSpeed: pickFirstNumber(rawEvent.skipSpeed, rawEvent.payload?.skipSpeed, 0),
      rewatchCount: pickFirstNumber(rawEvent.rewatchCount, rawEvent.payload?.rewatchCount, 0),
      impressionId: String(rawEvent.impressionId || rawEvent.payload?.impressionId || '').trim(),
      appVersion: String(rawEvent.appVersion || rawEvent.payload?.appVersion || '').trim(),
      clientPlatform: String(rawEvent.clientPlatform || rawEvent.platform || '').trim(),
      traceId,
    },
    processingStatus: 'pending',
    occurredAt: toDate(rawEvent.occurredAt || rawEvent.timestamp || rawEvent.createdAt, new Date()),
  };
}

function validateEvent(normalizedEvent = {}, rawEvent = {}, defaults = {}) {
  const contractValidation = validateEventContract(rawEvent, { defaults });
  if (!contractValidation.valid) {
    const error = new Error(`Invalid YME event contract: ${contractValidation.errors.join(' ')}`);
    error.status = 400;
    error.details = contractValidation.errors;
    incrementCounter('eventsRejected');
    throw error;
  }

  if (!normalizedEvent.userId) {
    const error = new Error('YME event userId is required.');
    error.status = 400;
    incrementCounter('eventsRejected');
    throw error;
  }

  if (!normalizedEvent.eventType) {
    const error = new Error('YME eventType is required.');
    error.status = 400;
    incrementCounter('eventsRejected');
    throw error;
  }
}

function shouldSkipRecursiveEvent(rawEvent = {}, normalizedEvent = {}) {
  const payload = rawEvent.payload || rawEvent.data || {};
  const metadata = rawEvent.metadata || rawEvent.eventMetadata || {};
  const skipYme = [
    rawEvent.skipYME,
    rawEvent.skipYme,
    payload.skipYME,
    payload.skipYme,
    metadata.skipYME,
    metadata.skipYme,
  ].some(Boolean);

  return skipYme || normalizedEvent.sourceApp === 'yme';
}

function buildEventLogContext(rawEvent = {}, normalizedEvent = {}) {
  return {
    sourceApp: normalizedEvent.sourceApp || null,
    eventType: normalizedEvent.eventType || null,
    traceId: normalizedEvent.traceId || normalizedEvent.eventMetadata?.traceId || null,
    sessionId: normalizedEvent.sessionId || null,
    clientEventId: normalizedEvent.clientEventId || null,
    conversationId: normalizedEvent.conversationId || null,
    contentId: normalizedEvent.contentId || null,
    occurredAt: normalizedEvent.occurredAt || null,
    eventMetadata: normalizedEvent.eventMetadata || {},
    payloadPreview: safeJsonPreview(normalizedEvent.payload || rawEvent.payload || rawEvent),
  };
}

async function dispatchEventProcessing(event, { req = null } = {}) {
  if (isQueueEnabled()) {
    const dispatch = await enqueueEventProcessingJob({
      eventId: event._id.toString(),
      userId: event.userId.toString(),
      traceId: event.traceId || event.eventMetadata?.traceId || '',
    });
    event.processingStatus = 'queued';
    event.queueJobId = String(dispatch.jobId || '');
    event.processingNotes = uniqueStrings([
      ...(event.processingNotes || []),
      'dispatch:bullmq',
    ], 10);
    await event.save();
    return dispatch;
  }

  if (getYmeConfig().features.inlineWorkers) {
    event.processingStatus = 'queued';
    event.queueJobId = `local:${event._id.toString()}`;
    event.processingNotes = uniqueStrings([
      ...(event.processingNotes || []),
      'dispatch:local_background',
    ], 10);
    await event.save();

    setImmediate(async () => {
      try {
        const { processEventPipeline } = require('./consolidation.service');
        await processEventPipeline({
          eventId: event._id.toString(),
          trigger: 'local_background',
        });
      } catch (error) {
        await writeMemoryLog({
          userId: event.userId,
          eventId: event._id,
          jobName: 'yme_process_event',
          queueName: LOCAL_BACKGROUND_QUEUE,
          stage: 'event_dispatch',
          level: 'error',
          status: 'failed',
          message: 'Local background YME event processing failed.',
          error,
          metadata: {
            trigger: 'local_background',
            eventType: event.eventType,
            sourceApp: event.sourceApp,
            traceId: event.traceId || event.eventMetadata?.traceId || '',
          },
          req,
        });
      }
    });

    return {
      queued: true,
      mode: 'local_background',
      queueName: LOCAL_BACKGROUND_QUEUE,
      reason: 'queue_not_configured_local_background',
      jobId: event.queueJobId,
    };
  }

  event.processingStatus = 'pending';
  event.processingNotes = uniqueStrings([
    ...(event.processingNotes || []),
    'dispatch:deferred_queue_unavailable',
  ], 10);
  await event.save();

  await writeMemoryLog({
    userId: event.userId,
    eventId: event._id,
    jobName: 'yme_process_event',
    queueName: LOCAL_BACKGROUND_QUEUE,
    stage: 'event_dispatch',
    level: 'warn',
    status: 'queued',
    message: 'YME event stored without background worker dispatch.',
    metadata: {
      trigger: 'deferred',
      eventType: event.eventType,
      sourceApp: event.sourceApp,
      reason: 'queue_not_configured',
      traceId: event.traceId || event.eventMetadata?.traceId || '',
    },
    req,
  });

  return {
    queued: false,
    mode: 'deferred',
    queueName: LOCAL_BACKGROUND_QUEUE,
    reason: 'queue_not_configured',
  };
}

async function ingestEvent(rawEvent, options = {}) {
  try {
    const startedAt = Date.now();
    const normalizedEvent = normalizeIncomingEvent(rawEvent, options.defaults);
    validateEvent(normalizedEvent, rawEvent, options.defaults);

    if (shouldSkipRecursiveEvent(rawEvent, normalizedEvent)) {
      await writeMemoryLog({
        userId: normalizedEvent.userId,
        stage: 'event_guard',
        status: 'skipped',
        message: 'Skipped recursive YME event.',
        metadata: {
          ...buildEventLogContext(rawEvent, normalizedEvent),
          reason: 'recursive_event',
        },
        req: options.req || null,
      });

      return {
        event: null,
        skipped: true,
        dispatch: {
          queued: false,
          mode: 'guard',
          reason: 'recursive_event',
        },
      };
    }

    const guard = await applyEventGuards(normalizedEvent);

    if (guard.duplicateEvent) {
      guard.duplicateEvent.duplicateCount = Number(guard.duplicateEvent.duplicateCount || 0) + 1;
      guard.duplicateEvent.lastDuplicateAt = new Date();
      guard.duplicateEvent.processingNotes = uniqueStrings([
        ...(guard.duplicateEvent.processingNotes || []),
        'duplicate_event',
      ], 10);
      await guard.duplicateEvent.save();

      incrementCounter('eventsDeduped');
      await writeMemoryLog({
        userId: normalizedEvent.userId,
        eventId: guard.duplicateEvent._id,
        stage: 'event_guard',
        status: 'skipped',
        message: 'Skipped duplicate YME event.',
        metadata: {
          eventType: normalizedEvent.eventType,
          dedupeKey: guard.dedupeKey,
          traceId: normalizedEvent.traceId || normalizedEvent.eventMetadata?.traceId || '',
        },
        req: options.req || null,
      });

      return {
        event: guard.duplicateEvent,
        skipped: true,
        dispatch: {
          queued: false,
          mode: 'guard',
          reason: 'duplicate_event',
        },
      };
    }

    if (guard.throttled) {
      incrementCounter('eventsThrottled');
      await writeMemoryLog({
        userId: normalizedEvent.userId,
        stage: 'event_guard',
        status: 'skipped',
        message: 'Skipped throttled low-value YME event.',
        metadata: {
          eventType: normalizedEvent.eventType,
          dedupeKey: guard.dedupeKey,
          traceId: normalizedEvent.traceId || normalizedEvent.eventMetadata?.traceId || '',
        },
        req: options.req || null,
      });

      return {
        event: null,
        skipped: true,
        dispatch: {
          queued: false,
          mode: 'guard',
          reason: 'low_value_throttled',
        },
      };
    }

    const scoring = scoreEventImportance(normalizedEvent);
    const embeddingPolicy = buildEmbeddingPolicy(normalizedEvent, scoring);

    const event = await UserEvent.create({
      ...normalizedEvent,
      fingerprint: guard.fingerprint,
      dedupeKey: guard.dedupeKey,
      importanceScore: scoring.importanceScore,
      importanceReason: scoring.importanceReason,
      shouldEmbed: embeddingPolicy.shouldEmbed,
      embeddingPriority: embeddingPolicy.embeddingPriority,
      summaryEligible: embeddingPolicy.summaryEligible,
      processingNotes: [embeddingPolicy.reason, `importance:${scoring.importanceBand}`],
    });
    incrementCounter('eventsIngested');

    const dispatch = await dispatchEventProcessing(event, {
      req: options.req || null,
    });

    recordDuration('eventIngestRequest', Date.now() - startedAt);
    await writeMemoryLog({
      userId: event.userId,
      eventId: event._id,
      stage: 'event_ingest',
      message: 'Accepted YME event.',
      metrics: {
        durationMs: Date.now() - startedAt,
      },
      metadata: {
        eventType: event.eventType,
        sourceApp: event.sourceApp,
        queued: dispatch.queued === true,
        dispatchMode: dispatch.mode || '',
        dispatchReason: dispatch.reason || '',
        queueName: dispatch.queueName || '',
        queueJobId: dispatch.jobId || event.queueJobId || '',
        importanceScore: event.importanceScore,
        shouldEmbed: event.shouldEmbed,
        traceId: event.traceId || event.eventMetadata?.traceId || '',
      },
      req: options.req || null,
    });

    return {
      event,
      dispatch,
    };
  } catch (error) {
    logNormalizationError(error);
    throw error;
  }
}

async function ingestEventBatch(events = [], options = {}) {
  const config = getYmeConfig();
  if (events.length > config.api.batchLimit) {
    const error = new Error(`Batch exceeds limit of ${config.api.batchLimit} events.`);
    error.status = 400;
    throw error;
  }

  const results = [];
  const failures = [];
  for (const event of events) {
    try {
      results.push(await ingestEvent(event, options));
    } catch (error) {
      let normalizedContext = {};

      try {
        normalizedContext = buildEventLogContext(event, normalizeIncomingEvent(event, options.defaults));
      } catch (_nestedError) {}

      failures.push({
        eventType: event?.eventType || event?.type || '',
        userId: String(event?.userId || options?.defaults?.userId || ''),
        message: error.message || 'Failed to ingest event.',
      });

      console.error('[YME] Batch ingest item failed:', {
        message: error.message,
        stack: error.stack,
        ...normalizedContext,
      });
    }
  }

  return {
    count: results.length,
    results,
    failedCount: failures.length,
    failures,
  };
}

module.exports = {
  normalizeIncomingEvent,
  ingestEvent,
  ingestEventBatch,
};
