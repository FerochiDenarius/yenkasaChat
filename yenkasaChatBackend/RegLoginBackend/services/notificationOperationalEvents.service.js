const { publishYmeEvent } = require("../src/yme/services/eventPublisher.service");

const NOTIFICATION_EVENT_TYPES = Object.freeze({
  COMMUNITY_POST_CREATED: "COMMUNITY_POST_CREATED",
  STREAM_STARTED: "STREAM_STARTED",
  NOTIFICATION_SENT: "NOTIFICATION_SENT",
  NOTIFICATION_OPENED: "NOTIFICATION_OPENED",
  NOTIFICATION_DISMISSED: "NOTIFICATION_DISMISSED"
});

function normalizeId(value) {
  return value?.toString?.() || String(value || "");
}

function nowIso(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function emitNotificationOperationalEvent(eventType, payload = {}, options = {}) {
  const timestamp = nowIso(payload.timestamp || payload.createdAt);
  const userId = normalizeId(payload.userId || payload.receiverId || payload.authorId || payload.hostId);
  if (!eventType || !userId) return undefined;

  const metadata = {
    ...payload,
    eventType,
    timestamp,
    operationalSchema: "notifications.v1"
  };

  return publishYmeEvent(
    {
      eventType,
      userId,
      relatedUserId: normalizeId(payload.authorId || payload.hostId || payload.senderId),
      creatorId: normalizeId(payload.authorId || payload.hostId || payload.senderId),
      sourceApp: options.sourceApp || "notifications",
      platform: options.platform || "server",
      sessionId: options.sessionId || "",
      clientEventId: payload.clientEventId || "",
      contentId: normalizeId(payload.notificationId || payload.postId || payload.streamId || payload.communityId),
      postId: normalizeId(payload.postId || payload.streamId || ""),
      communityId: normalizeId(payload.communityId),
      timestamp,
      occurredAt: timestamp,
      text: payload.message || payload.title || "",
      payload: metadata,
      metadata
    },
    options.publishOptions || {}
  );
}

module.exports = {
  NOTIFICATION_EVENT_TYPES,
  emitNotificationOperationalEvent
};
