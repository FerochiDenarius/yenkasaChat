const ChatSummary = require('../models/chatSummary.model');
const UserEvent = require('../models/userEvent.model');
const { getYmeConfig } = require('../config/yme.config');
const { buildEventNarrative, summarizeBehaviorEvents, summarizeChatEvents } = require('./activitySummarizer.service');
const { extractInterestSignals } = require('./interestExtraction.service');
const { writeMemoryLog } = require('./log.service');
const { applyEventToMemory, refreshMemorySummary } = require('./memoryProfile.service');
const { incrementCounter, recordDuration } = require('./metrics.service');
const { enqueueChatSummaryJob, enqueueConsolidationJob, enqueueEmbeddingJob, isQueueEnabled } = require('./queue.service');
const { applyRecommendationSignals } = require('./recommendationSignals.service');
const { upsertMemoryEmbedding } = require('./vectorSearch.service');

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
    'reward_claim',
    'community_join',
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

async function processEventPipeline({ eventId, trigger = 'worker' } = {}) {
  const startedAt = Date.now();
  const event = await UserEvent.findById(eventId);
  if (!event) {
    throw new Error(`YME event ${eventId} not found.`);
  }

  if (event.processingStatus === 'processed') {
    return {
      skipped: true,
      reason: 'already_processed',
    };
  }

  try {
    const derivedSignals = extractInterestSignals(event.toObject());
    const behaviorSummary = summarizeBehaviorEvents([event.toObject()], derivedSignals);

    await applyEventToMemory({
      event,
      derivedSignals,
    });

    await applyRecommendationSignals({
      event,
      derivedSignals,
    });

    const narrative = buildEventNarrative(event, derivedSignals);
    if (event.shouldEmbed && narrative) {
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
      await maybeHandleChatSummaryJob({
        userId: event.userId.toString(),
        conversationId: event.conversationId,
        sourceApp: event.sourceApp,
      });
    }

    if (shouldTriggerConsolidation(event) && getYmeConfig().consolidation.enabled) {
      await maybeHandleConsolidationJob({
        userId: event.userId.toString(),
        reason: `event:${event.eventType}`,
      });
    }

    event.processingStatus = 'processed';
    event.processedAt = new Date();
    event.processingError = '';
    await event.save();

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
    event.processingStatus = 'failed';
    event.processingError = error.message;
    await event.save();

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
      },
    });
    throw error;
  }
}

async function processEmbeddingRefreshJob(payload = {}) {
  const startedAt = Date.now();
  const document = await upsertMemoryEmbedding(payload);
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
  if (!summaryResult.summary) {
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
        summary: summaryResult.summary,
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
    text: summaryResult.summary,
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

  const behaviorSummary = summarizeBehaviorEvents(recentEvents, {
    interests: recentEvents.flatMap((event) => (event.interestCandidates || []).map((label) => ({ label, score: 0.4 }))),
  }).summary;
  const chatSummary = recentChatSummaries.map((entry) => entry.summary).filter(Boolean)[0] || '';
  const summary = await refreshMemorySummary(userId, {
    reason,
    behaviorSummary,
    chatSummary,
  });

  if (summary) {
    await maybeHandleEmbeddingJob({
      userId: userId.toString(),
      sourceType: 'memory_summary',
      sourceId: `user:${userId}:long_term`,
      sourceApp: 'system',
      memoryTier: 'long_term',
      title: 'Unified long-term memory summary',
      text: summary,
      importance: 0.95,
      metadata: {
        reason,
      },
    });
  }

  incrementCounter('memoryConsolidationsCompleted');
  return {
    summary,
  };
}

module.exports = {
  processEventPipeline,
  processEmbeddingRefreshJob,
  processChatSummaryJob,
  runMemoryConsolidation,
};
