const { randomUUID } = require('node:crypto');

const ChatSummary = require('../models/chatSummary.model');
const UserEvent = require('../models/userEvent.model');
const { getYmeConfig } = require('../config/yme.config');
const { normalizeText } = require('../utils/textNormalizer');
const { buildEventNarrative, summarizeBehaviorEvents, summarizeChatEvents } = require('./activitySummarizer.service');
const { recordDeadLetterEvent, resolveDeadLetterEvent } = require('./deadLetterQueue.service');
const { extractInterestSignals } = require('./interestExtraction.service');
const { writeMemoryLog } = require('./log.service');
const { applyEventToMemory, refreshMemorySummary } = require('./memoryProfile.service');
const { incrementCounter, recordDuration } = require('./metrics.service');
const { enqueueChatSummaryJob, enqueueConsolidationJob, enqueueEmbeddingJob, isQueueEnabled } = require('./queue.service');
const { applyRecommendationSignals } = require('./recommendationSignals.service');
const { upsertMemoryEmbedding } = require('./vectorSearch.service');

function logNormalizationError(error) {
  console.error('[YME_NORMALIZATION_ERROR]', {
    message: error.message,
    stack: error.stack,
  });
}

function isChatEvent(eventType) {
  return ['chat_message', 'ai_chat_message', 'chat_response'].includes(eventType);
}

function shouldTriggerConsolidation(event) {
  return [
    'follow',
    'unfollow',
    'share',
    'search',
    'chat_message',
    'ai_chat_message',
    'watch',
    'video_watch',
    'watch_duration',
    'save_post',
    'creator_interaction',
    'live_stream_join',
    'stream_started',
    'stream_ended',
    'stream_joined',
    'stream_left',
    'stream_comment',
    'stream_gift',
    'stream_share',
    'stream_report',
    'stream_follow_host',
    'stream_moderation_action',
    'stream_ban_user',
    'stream_warning',
    'stream_view_duration',
    'stream_peak_viewers',
    'reward_claim',
    'community_join',
    'community_post_created',
    'notification_opened',
    'notification_dismissed',
    'gift_sent',
    'wallet_transfer',
    'live_started',
    'live_ended',
    'live_left',
    'guest_request',
    'guest_approved',
    'guest_declined',
  ].includes(event.eventType);
}

async function maybeHandleEmbeddingJob(payload) {
  if (isQueueEnabled()) {
    return enqueueEmbeddingJob(payload);
  }
  await processEmbeddingRefreshJob(payload);
  return { queued: false, mode: 'inline' };
}

async function maybeHandleChatSummaryJob(payload) {
  if (isQueueEnabled()) {
    return enqueueChatSummaryJob(payload);
  }
  await processChatSummaryJob(payload);
  return { queued: false, mode: 'inline' };
}

async function maybeHandleConsolidationJob(payload) {
  if (isQueueEnabled()) {
    return enqueueConsolidationJob(payload);
  }
  await runMemoryConsolidation(payload);
  return { queued: false, mode: 'inline' };
}

async function claimEventForProcessing(eventId) {
  if (!eventId) {
    throw new Error('Event id is required to process a YME event.');
  }

  const lockId = randomUUID();
  const event = await UserEvent.findOneAndUpdate(
    {
      _id: eventId,
      processingStatus: { $in: ['pending', 'queued', 'failed'] },
    },
    {
      $set: {
        processingStatus: 'processing',
        processingLockId: lockId,
        lastProcessingStartedAt: new Date(),
      },
      $inc: {
        processingAttempts: 1,
      },
    },
    { new: true },
  );

  if (event) {
    return { event, lockId };
  }

  const existing = await UserEvent.findById(eventId);
  if (!existing) {
    throw new Error(`YME event ${eventId} not found.`);
  }

  if (existing.processingStatus === 'processed') {
    return {
      event: existing,
      lockId: '',
      skipped: true,
      reason: 'already_processed',
    };
  }

  if (existing.processingStatus === 'processing') {
    return {
      event: existing,
      lockId: '',
      skipped: true,
      reason: 'already_processing',
    };
  }

  if (existing.processingStatus === 'dead_lettered') {
    return {
      event: existing,
      lockId: '',
      skipped: true,
      reason: 'dead_lettered',
    };
  }

  return {
    event: existing,
    lockId: '',
    skipped: true,
    reason: `not_claimable:${existing.processingStatus || 'unknown'}`,
  };
}

async function processEventPipeline({ eventId, trigger = 'worker' } = {}) {
  const startedAt = Date.now();
  const claim = await claimEventForProcessing(eventId);
  if (claim.skipped) {
    return {
      skipped: true,
      reason: claim.reason,
    };
  }

  const event = claim.event;
  const lockId = claim.lockId;
  let currentStage = 'extract_interest_signals';

  try {
    const derivedSignals = extractInterestSignals(event.toObject());
    currentStage = 'summarize_behavior';
    const behaviorSummary = summarizeBehaviorEvents([event.toObject()], derivedSignals);

    currentStage = 'apply_memory';
    await applyEventToMemory({
      event,
      derivedSignals,
    });

    currentStage = 'apply_recommendation_signals';
    await applyRecommendationSignals({
      event,
      derivedSignals,
    });

    currentStage = 'build_event_narrative';
    let narrative = '';
    try {
      narrative = normalizeText(buildEventNarrative(event, derivedSignals) || '');
    } catch (error) {
      logNormalizationError(error);
      throw error;
    }
    if (event.shouldEmbed && narrative) {
      currentStage = 'enqueue_embedding_refresh';
      await maybeHandleEmbeddingJob({
        userId: event.userId.toString(),
        sourceType: 'user_event',
        sourceId: event._id.toString(),
        sourceApp: event.sourceApp,
        memoryTier: isChatEvent(event.eventType) ? 'short_term' : 'mid_term',
        text: narrative,
        title: `${event.sourceApp}:${event.eventType}`,
        importance: event.importanceScore,
        metadata: {
          eventType: event.eventType,
          behaviorSummary: behaviorSummary.summary,
          importanceScore: event.importanceScore,
        },
      });
    }

    if (event.conversationId && isChatEvent(event.eventType)) {
      currentStage = 'enqueue_chat_summary';
      await maybeHandleChatSummaryJob({
        userId: event.userId.toString(),
        conversationId: event.conversationId,
        sourceApp: event.sourceApp,
      });
    }

    if (shouldTriggerConsolidation(event) && getYmeConfig().consolidation.enabled) {
      currentStage = 'enqueue_memory_consolidation';
      await maybeHandleConsolidationJob({
        userId: event.userId.toString(),
        reason: `event:${event.eventType}`,
      });
    }

    event.processingStatus = 'processed';
    event.processedAt = new Date();
    event.processingLockId = '';
    event.processingError = '';
    event.lastFailedAt = null;
    event.lastDeadLetteredAt = null;
    await event.save();
    await resolveDeadLetterEvent(event._id, 'processed_successfully');

    incrementCounter('eventsProcessed');
    recordDuration('eventProcessing', Date.now() - startedAt);

    await writeMemoryLog({
      userId: event.userId,
      eventId: event._id,
      jobName: 'yme_process_event',
      queueName: 'ymeEventIngestionQueue',
      stage: 'event_processing',
      message: 'Processed YME event.',
      metrics: {
        durationMs: Date.now() - startedAt,
      },
      metadata: {
        trigger,
        eventType: event.eventType,
        traceId: event.traceId || event.eventMetadata?.traceId || '',
        processingAttempts: event.processingAttempts,
      },
    });

    return {
      processed: true,
      eventId: event._id.toString(),
      metrics: {
        processDurationMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const maxAttempts = Math.max(1, Number(getYmeConfig().queue.eventAttempts || 1));
    const isTerminalFailure = Number(event.processingAttempts || 0) >= maxAttempts;

    event.processingStatus = isTerminalFailure ? 'dead_lettered' : 'failed';
    event.processingLockId = event.processingLockId === lockId ? '' : event.processingLockId;
    event.processingError = error.message;
    event.lastFailedAt = new Date();
    if (isTerminalFailure) {
      event.lastDeadLetteredAt = new Date();
    }
    event.processingNotes = [
      ...(event.processingNotes || []).filter(Boolean),
      `failed_stage:${currentStage}`,
    ].slice(-12);
    await event.save();
    await recordDeadLetterEvent({
      event,
      queueName: 'ymeEventIngestionQueue',
      jobName: 'yme_process_event',
      stage: currentStage,
      error,
      status: isTerminalFailure ? 'open' : 'retrying',
      metadata: {
        trigger,
        traceId: event.traceId || event.eventMetadata?.traceId || '',
        processingAttempts: event.processingAttempts,
        maxAttempts,
      },
    });

    await writeMemoryLog({
      userId: event.userId,
      eventId: event._id,
      jobName: 'yme_process_event',
      queueName: 'ymeEventIngestionQueue',
      stage: 'event_processing',
      level: 'error',
      status: 'failed',
      message: 'YME event processing failed.',
      error,
      metadata: {
        trigger,
        eventType: event.eventType,
        stage: currentStage,
        traceId: event.traceId || event.eventMetadata?.traceId || '',
        processingAttempts: event.processingAttempts,
        deadLettered: isTerminalFailure,
      },
    });
    incrementCounter(isTerminalFailure ? 'eventsDeadLettered' : 'eventsProcessingFailed');
    throw error;
  }
}

async function processEmbeddingRefreshJob(payload = {}) {
  const startedAt = Date.now();
  let normalizedPayload;

  try {
    normalizedPayload = {
      ...payload,
      text: normalizeText(payload?.text || ''),
      title: normalizeText(payload?.title || ''),
    };
  } catch (error) {
    logNormalizationError(error);
    throw error;
  }

  if (!normalizedPayload.text) {
    return {
      skipped: true,
      reason: 'empty_text',
      metrics: {
        processDurationMs: Date.now() - startedAt,
      },
    };
  }

  const document = await upsertMemoryEmbedding(normalizedPayload);
  recordDuration('embeddingRefreshJob', Date.now() - startedAt);
  return {
    documentId: document?._id?.toString?.() || null,
    metrics: {
      processDurationMs: Date.now() - startedAt,
    },
  };
}

async function processChatSummaryJob({ userId, conversationId, sourceApp = 'yenkasa_ai' } = {}) {
  const config = getYmeConfig();
  const events = await UserEvent.find({
    userId,
    conversationId,
    eventType: { $in: ['chat_message', 'ai_chat_message', 'chat_response'] },
  })
    .sort({ occurredAt: -1 })
    .limit(config.consolidation.recentChatWindow)
    .lean();

  if (!events.length) {
    return {
      skipped: true,
      reason: 'no_chat_events',
    };
  }

  const orderedEvents = [...events].reverse();
  const summaryResult = summarizeChatEvents(orderedEvents);
  let normalizedSummary = '';

  try {
    normalizedSummary = normalizeText(summaryResult.summary || '');
  } catch (error) {
    logNormalizationError(error);
    throw error;
  }

  if (!normalizedSummary) {
    return {
      skipped: true,
      reason: 'empty_summary',
    };
  }

  const summaryDoc = await ChatSummary.findOneAndUpdate(
    {
      userId,
      conversationId,
      summaryType: 'rolling_window',
    },
    {
      $set: {
        userId,
        conversationId,
        sourceApp,
        summaryType: 'rolling_window',
        messageCount: orderedEvents.length,
        windowStart: orderedEvents[0]?.occurredAt || null,
        windowEnd: orderedEvents[orderedEvents.length - 1]?.occurredAt || null,
        topics: [],
        entities: [],
        sentiment: summaryResult.sentiment,
        summary: normalizedSummary,
        embeddingStatus: 'pending',
      },
    },
    { upsert: true, new: true },
  );

  const embeddingDispatch = await maybeHandleEmbeddingJob({
    userId: userId.toString(),
    sourceType: 'chat_summary',
    sourceId: summaryDoc._id.toString(),
    sourceApp,
    memoryTier: 'mid_term',
    title: `Chat summary ${conversationId}`,
    text: normalizedSummary,
    importance: 0.85,
    metadata: {
      conversationId,
      sentiment: summaryResult.sentiment,
    },
  });

  summaryDoc.embeddingStatus = embeddingDispatch?.queued ? 'queued' : 'ready';
  summaryDoc.lastEmbeddedAt = embeddingDispatch?.queued ? null : new Date();
  await summaryDoc.save();

  return {
    summaryId: summaryDoc._id.toString(),
  };
}

async function runMemoryConsolidation({ userId, reason = 'scheduled' } = {}) {
  const config = getYmeConfig();
  const [recentEvents, recentChatSummaries] = await Promise.all([
    UserEvent.find({ userId })
      .sort({ occurredAt: -1 })
      .limit(config.consolidation.recentEventWindow)
      .lean(),
    ChatSummary.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(4)
      .lean(),
  ]);

  let behaviorSummary = '';
  let chatSummary = '';

  try {
    behaviorSummary = normalizeText(
      summarizeBehaviorEvents(recentEvents, {
        interests: recentEvents.flatMap((event) => (event.interestCandidates || []).map((label) => ({ label, score: 0.4 }))),
      }).summary || '',
    );
    chatSummary = normalizeText(recentChatSummaries.map((entry) => entry.summary).filter(Boolean)[0] || '');
  } catch (error) {
    logNormalizationError(error);
    throw error;
  }

  const summary = await refreshMemorySummary(userId, {
    reason,
    behaviorSummary,
    chatSummary,
  });
  const normalizedSummary = normalizeText(summary || '');

  if (normalizedSummary) {
    await maybeHandleEmbeddingJob({
      userId: userId.toString(),
      sourceType: 'memory_summary',
      sourceId: `user:${userId}:long_term`,
      sourceApp: 'system',
      memoryTier: 'long_term',
      title: 'Unified long-term memory summary',
      text: normalizedSummary,
      importance: 0.95,
      metadata: {
        reason,
        failSoft: true,
      },
    });
  }

  incrementCounter('memoryConsolidationsCompleted');
  return {
    summary: normalizedSummary,
  };
}

module.exports = {
  processEventPipeline,
  processEmbeddingRefreshJob,
  processChatSummaryJob,
  runMemoryConsolidation,
};
