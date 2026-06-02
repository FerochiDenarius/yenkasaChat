const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRelayRequestPayload,
  computeRetryDelayMs,
  mapYmeEventToIntelligenceEvent,
  normalizeIntelligenceEvent,
} = require('../src/intelligence/services/eventPublisher.service');

test('normalizeIntelligenceEvent keeps structured metadata and camel-safe shape', () => {
  const payload = normalizeIntelligenceEvent({
    eventType: 'post_created',
    source: 'Yenkasa App',
    userId: 'user-1',
    postId: 'post-1',
    metadata: { communityId: 'community-1' },
  });

  assert.equal(payload.eventType, 'post_created');
  assert.equal(payload.source, 'yenkasa_app');
  assert.equal(payload.userId, 'user-1');
  assert.equal(payload.metadata.postId, 'post-1');
  assert.equal(payload.metadata.communityId, 'community-1');
});

test('mapYmeEventToIntelligenceEvent converts watch events to video_watch for video payloads', () => {
  const payload = mapYmeEventToIntelligenceEvent({
    eventType: 'watch',
    userId: 'user-1',
    postId: 'post-1',
    payload: {
      mediaType: 'video',
      watchTimeMs: 9000,
    },
  });

  assert.equal(payload.eventType, 'video_watch');
  assert.equal(payload.metadata.postId, 'post-1');
  assert.equal(payload.metadata.watchTimeMs, 9000);
});

test('mapYmeEventToIntelligenceEvent converts chat_message to message_sent', () => {
  const payload = mapYmeEventToIntelligenceEvent({
    eventType: 'chat_message',
    userId: 'user-1',
    conversationId: 'room-1',
    messageId: 'message-1',
    payload: {
      roomType: 'direct',
      messageType: 'message',
      hasImage: false,
      hasAudio: false,
      hasVideo: false,
      hasFile: false,
    },
  });

  assert.equal(payload.eventType, 'message_sent');
  assert.equal(payload.metadata.roomId, 'room-1');
  assert.equal(payload.metadata.messageId, 'message-1');
});

test('computeRetryDelayMs applies bounded exponential backoff', () => {
  assert.equal(computeRetryDelayMs(1), 15000);
  assert.equal(computeRetryDelayMs(2), 30000);
  assert.equal(computeRetryDelayMs(8), 300000);
});

test('buildRelayRequestPayload maps internal events to ai backend schema', () => {
  const payload = buildRelayRequestPayload({
    eventId: 'evt-1',
    eventType: 'post_view',
    source: 'yenkasa_app',
    userId: 'user-1',
    timestamp: '2026-05-28T14:00:00Z',
    metadata: {
      postId: 'post-1',
    },
  });

  assert.deepEqual(payload, {
    event_type: 'post_view',
    user_id: 'user-1',
    app_source: 'yenkasa_app',
    timestamp: '2026-05-28T14:00:00.000Z',
    metadata: {
      postId: 'post-1',
      eventId: 'evt-1',
      sourceEventType: 'post_view',
    },
  });
});

test('mapYmeEventToIntelligenceEvent converts STREAM_GIFT to livestream operational event', () => {
  const payload = mapYmeEventToIntelligenceEvent({
    eventType: 'STREAM_GIFT',
    userId: 'viewer-1',
    relatedUserId: 'host-1',
    contentId: 'stream-1',
    timestamp: '2026-06-02T12:00:00Z',
    payload: {
      streamId: 'stream-1',
      hostId: 'host-1',
      amount: 50,
      giftKey: 'crown',
      metrics: {
        giftRevenue: 50,
      },
      moderationSignals: [],
      recommendationSignals: ['creator_gifting'],
    },
  });

  assert.equal(payload.eventType, 'stream_gift');
  assert.equal(payload.userId, 'viewer-1');
  assert.equal(payload.metadata.streamId, 'stream-1');
  assert.equal(payload.metadata.hostId, 'host-1');
  assert.equal(payload.metadata.amount, 50);
  assert.deepEqual(payload.metadata.recommendationSignals, ['creator_gifting']);
  assert.equal(payload.metadata.operationalEvent.eventType, 'STREAM_GIFT');
});

test('mapYmeEventToIntelligenceEvent converts community post notification events', () => {
  const payload = mapYmeEventToIntelligenceEvent({
    eventType: 'COMMUNITY_POST_CREATED',
    userId: 'author-1',
    communityId: 'community-1',
    postId: 'post-1',
    timestamp: '2026-06-02T12:00:00Z',
    payload: {
      communityId: 'community-1',
      communityName: 'ATU Students',
      postId: 'post-1',
      authorId: 'author-1',
      authorName: 'Bright Kofi',
      message: 'Bright Kofi shared a new post.',
    },
  });

  assert.equal(payload.eventType, 'community_post_created');
  assert.equal(payload.userId, 'author-1');
  assert.equal(payload.metadata.communityId, 'community-1');
  assert.equal(payload.metadata.postId, 'post-1');
  assert.equal(payload.metadata.authorName, 'Bright Kofi');
  assert.equal(payload.metadata.operationalEvent.eventType, 'COMMUNITY_POST_CREATED');
});

test('mapYmeEventToIntelligenceEvent converts notification lifecycle events', () => {
  const payload = mapYmeEventToIntelligenceEvent({
    eventType: 'NOTIFICATION_OPENED',
    userId: 'viewer-1',
    relatedUserId: 'author-1',
    contentId: 'notification-1',
    timestamp: '2026-06-02T12:00:00Z',
    payload: {
      notificationId: 'notification-1',
      notificationType: 'COMMUNITY_POST_CREATED',
      receiverId: 'viewer-1',
      senderId: 'author-1',
      targetType: 'community',
      targetId: 'community-1',
      targetUrl: '/communities?communityId=community-1',
    },
  });

  assert.equal(payload.eventType, 'notification_opened');
  assert.equal(payload.userId, 'viewer-1');
  assert.equal(payload.metadata.notificationId, 'notification-1');
  assert.equal(payload.metadata.notificationType, 'COMMUNITY_POST_CREATED');
  assert.equal(payload.metadata.receiverId, 'viewer-1');
  assert.equal(payload.metadata.operationalEvent.eventType, 'NOTIFICATION_OPENED');
});
