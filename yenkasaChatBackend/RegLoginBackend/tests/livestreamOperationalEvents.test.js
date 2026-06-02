const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LIVESTREAM_EVENT_TYPES,
  buildLivestreamOperationalEvent,
  getLivestreamMetrics,
  updateLivestreamMetrics,
} = require('../src/services/livestream/operationalEvents.service');

test('buildLivestreamOperationalEvent creates canonical stream event schema', () => {
  const event = buildLivestreamOperationalEvent({
    eventType: LIVESTREAM_EVENT_TYPES.STREAM_COMMENT,
    streamId: 'stream-1',
    userId: 'user-1',
    hostId: 'host-1',
    timestamp: '2026-06-02T12:00:00Z',
    metadata: {
      message: 'hello live',
    },
  });

  assert.equal(event.eventType, 'STREAM_COMMENT');
  assert.equal(event.streamId, 'stream-1');
  assert.equal(event.userId, 'user-1');
  assert.equal(event.hostId, 'host-1');
  assert.equal(event.timestamp, '2026-06-02T12:00:00.000Z');
  assert.equal(event.metadata.message, 'hello live');
  assert.equal(event.metadata.streamId, 'stream-1');
  assert.equal(event.metadata.hostId, 'host-1');
});

test('updateLivestreamMetrics populates viewer, engagement, gift, and watch metrics', () => {
  const streamId = `stream-${Date.now()}`;

  updateLivestreamMetrics(buildLivestreamOperationalEvent({
    eventType: LIVESTREAM_EVENT_TYPES.STREAM_JOINED,
    streamId,
    userId: 'viewer-1',
    hostId: 'host-1',
    metadata: { concurrentViewers: 1 },
  }));
  updateLivestreamMetrics(buildLivestreamOperationalEvent({
    eventType: LIVESTREAM_EVENT_TYPES.STREAM_COMMENT,
    streamId,
    userId: 'viewer-1',
    hostId: 'host-1',
    metadata: { message: 'great stream' },
  }));
  updateLivestreamMetrics(buildLivestreamOperationalEvent({
    eventType: LIVESTREAM_EVENT_TYPES.STREAM_GIFT,
    streamId,
    userId: 'viewer-1',
    hostId: 'host-1',
    metadata: { amount: 50, giftKey: 'crown' },
  }));
  updateLivestreamMetrics(buildLivestreamOperationalEvent({
    eventType: LIVESTREAM_EVENT_TYPES.STREAM_VIEW_DURATION,
    streamId,
    userId: 'viewer-1',
    hostId: 'host-1',
    metadata: { durationMs: 120000 },
  }));

  const metrics = getLivestreamMetrics(streamId);
  assert.equal(metrics.totalViewers, 1);
  assert.equal(metrics.concurrentViewers, 1);
  assert.equal(metrics.peakViewers, 1);
  assert.equal(metrics.commentsPerMinute, 1);
  assert.equal(metrics.giftsPerMinute, 1);
  assert.equal(metrics.watchTime, 120000);
  assert.equal(metrics.averageWatchTime, 120000);
  assert.equal(metrics.retentionRate, 1);
  assert.equal(metrics.giftRevenue, 50);
  assert.deepEqual(metrics.topGifters, [{ userId: 'viewer-1', amount: 50 }]);
});
