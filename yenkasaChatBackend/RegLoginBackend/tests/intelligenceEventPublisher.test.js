const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
