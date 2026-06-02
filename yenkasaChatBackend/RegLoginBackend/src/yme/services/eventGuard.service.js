const crypto = require('crypto');

const UserEvent = require('../models/userEvent.model');
const { getYmeConfig } = require('../config/yme.config');

const LOW_VALUE_EVENT_TYPES = new Set([
  'watch',
  'post_view',
  'video_watch',
  'watch_duration',
  'profile_visit',
  'notification_open',
  'notification_sent',
  'notification_dismissed',
  'ad_interaction',
  'ad_engagement',
]);

function hashValue(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function buildEventFingerprint(event = {}) {
  return hashValue(
    JSON.stringify({
      userId: String(event.userId || ''),
      sourceApp: event.sourceApp || '',
      eventType: event.eventType || '',
      sessionId: event.sessionId || '',
      clientEventId: event.clientEventId || '',
      conversationId: event.conversationId || '',
      contentId: event.contentId || '',
      creatorId: String(event.creatorId || ''),
      relatedUserId: String(event.relatedUserId || ''),
      communityId: String(event.communityId || ''),
      postId: String(event.postId || ''),
      messageId: event.messageId || '',
      normalizedText: String(event.normalizedText || '').slice(0, 240),
      occurredAt: event.occurredAt ? new Date(event.occurredAt).toISOString() : '',
    }),
  );
}

function buildDedupeKey(event = {}) {
  if (event.clientEventId) {
    return hashValue(`${event.sourceApp}:${event.eventType}:${event.clientEventId}`);
  }

  return hashValue(
    JSON.stringify({
      userId: String(event.userId || ''),
      sourceApp: event.sourceApp || '',
      eventType: event.eventType || '',
      sessionId: event.sessionId || '',
      conversationId: event.conversationId || '',
      contentId: event.contentId || '',
      creatorId: String(event.creatorId || ''),
      relatedUserId: String(event.relatedUserId || ''),
      communityId: String(event.communityId || ''),
      postId: String(event.postId || ''),
      normalizedText: String(event.normalizedText || '').slice(0, 120),
      impressionId: event.eventMetadata?.impressionId || '',
    }),
  );
}

function getDuplicateWindowMs(eventType) {
  const config = getYmeConfig();
  if (LOW_VALUE_EVENT_TYPES.has(eventType)) {
    return config.guard.lowSignalDuplicateWindowMs;
  }
  return config.guard.duplicateWindowMs;
}

async function applyEventGuards(normalizedEvent = {}) {
  const config = getYmeConfig();
  const fingerprint = buildEventFingerprint(normalizedEvent);
  const dedupeKey = buildDedupeKey(normalizedEvent);
  const duplicateWindowMs = getDuplicateWindowMs(normalizedEvent.eventType);
  const duplicateSince = new Date(
    new Date(normalizedEvent.occurredAt || Date.now()).getTime() - duplicateWindowMs,
  );

  const duplicateEvent = await UserEvent.findOne({
    userId: normalizedEvent.userId,
    dedupeKey,
    occurredAt: { $gte: duplicateSince },
  }).sort({ occurredAt: -1 });

  let throttled = false;
  if (!duplicateEvent && LOW_VALUE_EVENT_TYPES.has(normalizedEvent.eventType)) {
    const throttleSince = new Date(Date.now() - config.guard.lowValueThrottleWindowMs);
    const recentCount = await UserEvent.countDocuments({
      userId: normalizedEvent.userId,
      eventType: normalizedEvent.eventType,
      occurredAt: { $gte: throttleSince },
    });
    throttled = recentCount >= config.guard.lowValueThrottleMax;
  }

  return {
    fingerprint,
    dedupeKey,
    duplicateEvent,
    throttled,
    skipReason: duplicateEvent ? 'duplicate_event' : throttled ? 'low_value_throttled' : '',
  };
}

module.exports = {
  buildEventFingerprint,
  buildDedupeKey,
  applyEventGuards,
};
