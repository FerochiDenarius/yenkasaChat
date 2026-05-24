const UserEvent = require('../models/userEvent.model');
const { getYmeConfig } = require('../config/yme.config');
const { incrementCounter, recordDuration } = require('./metrics.service');
const { writeMemoryLog } = require('./log.service');
const { enqueueEventProcessingJob, isQueueEnabled } = require('./queue.service');
const { buildEmbeddingPolicy } = require('./embeddingPolicy.service');
const { applyEventGuards } = require('./eventGuard.service');
const { scoreEventImportance } = require('./importanceScoring.service');
const {
  ensureArray,
  normalizeText,
  pickFirstNumber,
  toDate,
  toObjectId,
  uniqueStrings,
} = require('../utils/yme.utils');

const EVENT_TYPE_ALIASES = new Map([
  ['post_like', 'like'],
  ['comment_created', 'comment'],
  ['video_watch', 'watch'],
  ['watch_duration', 'watch_duration'],
  ['post_view', 'post_view'],
  ['creator_profile_view', 'creator_interaction'],
  ['chat_message_sent', 'chat_message'],
  ['chat_response_received', 'chat_response'],
  ['ai_chat_message', 'ai_chat_message'],
  ['caption_submit', 'caption'],
  ['save_post', 'save_post'],
  ['ad_interaction', 'ad_interaction'],
  ['ad_click', 'ad_engagement'],
  ['ad_view', 'ad_engagement'],
  ['live_comment', 'live_interaction'],
  ['live_stream_join', 'live_stream_join'],
  ['live_join', 'live_interaction'],
  ['reward_claim', 'reward_claim'],
  ['community_join', 'community_join'],
]);

function normalizeEventType(eventType) {
  const normalized = String(eventType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return EVENT_TYPE_ALIASES.get(normalized) || normalized;
}

function buildNormalizedText(rawEvent = {}) {
  return normalizeText(
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
  ).slice(0, getYmeConfig().api.eventTextLimit);
}

function buildInterestCandidates(rawEvent = {}, normalizedText = '') {
  return uniqueStrings([
    ...ensureArray(rawEvent.category),
    ...ensureArray(rawEvent.categories),
    ...ensureArray(rawEvent.tags),
    ...ensureArray(rawEvent.hashtags),
    ...normalizedText.split(/\s+/).filter((token) => token.startsWith('#')),
  ]);
}

function normalizeIncomingEvent(rawEvent = {}, defaults = {}) {
  const normalizedText = buildNormalizedText(rawEvent);
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
      traceId: String(rawEvent.traceId || '').trim(),
    },
    processingStatus: 'pending',
    occurredAt: toDate(rawEvent.occurredAt || rawEvent.timestamp || rawEvent.createdAt, new Date()),
  };
}

function validateEvent(normalizedEvent = {}) {
  if (!normalizedEvent.userId) {
    const error = new Error('YME event userId is required.');
    error.status = 400;
    throw error;
  }

  if (!normalizedEvent.eventType) {
    const error = new Error('YME eventType is required.');
    error.status = 400;
    throw error;
  }
}

async function ingestEvent(rawEvent, options = {}) {
  const startedAt = Date.now();
  const normalizedEvent = normalizeIncomingEvent(rawEvent, options.defaults);
  validateEvent(normalizedEvent);
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
      },
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
      },
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

  let dispatch = {
    queued: false,
    mode: 'inline',
    reason: 'inline_fallback',
  };

  if (isQueueEnabled()) {
    dispatch = await enqueueEventProcessingJob({
      eventId: event._id.toString(),
      userId: event.userId.toString(),
    });
    event.processingStatus = 'queued';
    event.queueJobId = String(dispatch.jobId || '');
    await event.save();
  } else {
    const { processEventPipeline } = require('./consolidation.service');
    await processEventPipeline({
      eventId: event._id.toString(),
      trigger: 'inline_ingest',
    });
  }

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
      importanceScore: event.importanceScore,
      shouldEmbed: event.shouldEmbed,
    },
  });

  return {
    event,
    dispatch,
  };
}

async function ingestEventBatch(events = [], options = {}) {
  const config = getYmeConfig();
  if (events.length > config.api.batchLimit) {
    const error = new Error(`Batch exceeds limit of ${config.api.batchLimit} events.`);
    error.status = 400;
    throw error;
  }

  const results = [];
  for (const event of events) {
    results.push(await ingestEvent(event, options));
  }

  return {
    count: results.length,
    results,
  };
}

module.exports = {
  normalizeIncomingEvent,
  ingestEvent,
  ingestEventBatch,
};
