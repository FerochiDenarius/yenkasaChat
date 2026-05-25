const { publishEvent, publishEventBatch } = require('../core/eventBus');

const CATEGORY_BY_EVENT_TYPE = Object.freeze({
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

function normalizePublishedEvent(event = {}, options = {}) {
  const eventType = String(event?.eventType || event?.type || '').trim().toLowerCase();
  return {
    ...event,
    eventName: eventType || String(event?.eventName || '').trim().toLowerCase(),
    eventType,
    category: event?.category || CATEGORY_BY_EVENT_TYPE[eventType] || 'analytics_event',
    ymeEligible: event?.ymeEligible !== false,
    sourceApp: event?.sourceApp || event?.source || options?.defaults?.sourceApp || 'social_app',
    sourceModule:
      event?.sourceModule || options?.defaults?.sourceModule || event?.source || 'yme.publisher',
    userId: event?.userId || options?.defaults?.userId || '',
  };
}

function publishYmeEvent(event, options = {}) {
  const task = publishEvent(normalizePublishedEvent(event, options), {
    ...options,
    awaitPublish: true,
    defaults: options.defaults,
  }).catch((error) => {
    console.warn('[YME] Failed to publish event:', {
      message: error.message,
      stack: error.stack,
      ...buildPublishLogContext(event, options),
    });
    return null;
  });

  return options.awaitIngest === true ? task : undefined;
}

function publishYmeEventBatch(events, options = {}) {
  const normalizedEvents = Array.isArray(events)
    ? events.map((event) => normalizePublishedEvent(event, options))
    : [];
  const task = publishEventBatch(normalizedEvents, {
    ...options,
    awaitPublish: true,
    defaults: options.defaults,
  }).catch((error) => {
    console.warn('[YME] Failed to publish event batch:', {
      message: error.message,
      stack: error.stack,
      count: Array.isArray(events) ? events.length : 0,
      payload: Array.isArray(events) ? events : [],
    });
    return null;
  });

  return options.awaitIngest === true ? task : undefined;
}

module.exports = {
  publishYmeEvent,
  publishYmeEventBatch,
};
