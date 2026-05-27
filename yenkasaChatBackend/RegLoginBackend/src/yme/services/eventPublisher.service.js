const { ingestEvent, ingestEventBatch } = require('./eventIngestion.service');
const {
  mapYmeEventToIntelligenceEvent,
  publishIntelligenceEvent,
} = require('../../intelligence/services/eventPublisher.service');

function buildPublishLogContext(event = {}, options = {}) {
  return {
    eventType: event?.eventType || event?.type || null,
    userId: event?.userId || options?.defaults?.userId || null,
    sourceApp: event?.sourceApp || event?.source || options?.defaults?.sourceApp || null,
    sessionId: event?.sessionId || event?.session || null,
    conversationId: event?.conversationId || event?.chatId || null,
    contentId: event?.contentId || event?.postId || event?.videoId || null,
    payload: event,
  };
}

function publishYmeEvent(event, options = {}) {
  const task = ingestEvent(event, options).catch((error) => {
    console.warn('[YME] Failed to publish event:', {
      message: error.message,
      stack: error.stack,
      ...buildPublishLogContext(event, options),
    });
    return null;
  });

  const intelligenceEvent = mapYmeEventToIntelligenceEvent(event);
  if (intelligenceEvent) {
    publishIntelligenceEvent(intelligenceEvent);
  }

  return options.awaitIngest === true ? task : undefined;
}

function publishYmeEventBatch(events, options = {}) {
  const task = ingestEventBatch(events, options).catch((error) => {
    console.warn('[YME] Failed to publish event batch:', {
      message: error.message,
      stack: error.stack,
      count: Array.isArray(events) ? events.length : 0,
      payload: Array.isArray(events) ? events : [],
    });
    return null;
  });

  if (Array.isArray(events)) {
    events.forEach((event) => {
      const intelligenceEvent = mapYmeEventToIntelligenceEvent(event);
      if (intelligenceEvent) {
        publishIntelligenceEvent(intelligenceEvent);
      }
    });
  }

  return options.awaitIngest === true ? task : undefined;
}

module.exports = {
  publishYmeEvent,
  publishYmeEventBatch,
};
