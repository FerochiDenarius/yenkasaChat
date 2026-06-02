const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ACCESS_TOKEN_SECRET ||= 'test-access-secret';

const {
  normalizeOperationalEvent,
  timingSafeEquals,
} = require('../routes/events.routes');

test('normalizeOperationalEvent maps canonical livestream event into YME ingest fields', () => {
  const event = normalizeOperationalEvent({
    eventType: 'STREAM_COMMENT',
    streamId: 'stream-1',
    userId: '64f000000000000000000001',
    hostId: '64f000000000000000000002',
    timestamp: '2026-06-02T12:00:00Z',
    metadata: {
      message: 'hello from live',
      community: 'technology',
    },
  });

  assert.equal(event.eventType, 'STREAM_COMMENT');
  assert.equal(event.sourceApp, 'operational_events_layer');
  assert.equal(event.contentId, 'stream-1');
  assert.equal(event.creatorId, '64f000000000000000000002');
  assert.equal(event.relatedUserId, '64f000000000000000000002');
  assert.equal(event.occurredAt, '2026-06-02T12:00:00Z');
  assert.equal(event.payload.streamId, 'stream-1');
  assert.equal(event.payload.hostId, '64f000000000000000000002');
  assert.equal(event.payload.message, 'hello from live');
  assert.equal(event.payload.operationalEvent.eventType, 'STREAM_COMMENT');
});

test('timingSafeEquals only accepts exact ingest keys', () => {
  assert.equal(timingSafeEquals('secret-key', 'secret-key'), true);
  assert.equal(timingSafeEquals('secret-key', 'wrong-key'), false);
  assert.equal(timingSafeEquals('', 'secret-key'), false);
});
