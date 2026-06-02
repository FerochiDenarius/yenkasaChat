const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMMUNITY_POST_TYPE,
  buildCommunityPostNotificationData,
} = require('../services/communityPostNotification.service');
const {
  STREAM_STARTED_TYPE,
  buildLivestreamStartNotificationData,
} = require('../services/livestreamStartNotification.service');

test('community post notification payload opens community and carries required event context', () => {
  const payload = buildCommunityPostNotificationData({
    post: {
      _id: 'post-1',
      imageUrls: ['https://cdn.example/post.jpg'],
    },
    community: {
      _id: 'community-1',
      displayName: 'ATU Students',
    },
    creator: {
      _id: 'author-1',
      username: 'Bright Kofi',
    },
    recipient: {
      _id: 'viewer-1',
    },
  });

  assert.equal(payload.type, COMMUNITY_POST_TYPE);
  assert.equal(payload.type, 'COMMUNITY_POST_CREATED');
  assert.equal(payload.senderId, 'author-1');
  assert.equal(payload.receiverId, 'viewer-1');
  assert.equal(payload.targetType, 'community');
  assert.equal(payload.targetId, 'community-1');
  assert.equal(payload.targetUrl, '/communities?communityId=community-1&postId=post-1');
  assert.equal(payload.message, 'Bright Kofi shared a new post.');
  assert.equal(payload.push, true);
  assert.equal(payload.emitSocket, true);
  assert.equal(payload.pushTitle, 'New post in ATU Students');
  assert.equal(payload.pushData.communityId, 'community-1');
  assert.equal(payload.pushData.communityName, 'ATU Students');
  assert.equal(payload.pushData.postId, 'post-1');
  assert.equal(payload.pushData.authorId, 'author-1');
  assert.equal(payload.pushData.authorName, 'Bright Kofi');
});

test('livestream start notification payload uses community copy when stream belongs to community', () => {
  const payload = buildLivestreamStartNotificationData({
    stream: {
      _id: 'stream-1',
      hostUsername: 'bright',
      title: 'Campus update',
      community: 'ATU Students',
    },
    host: {
      _id: 'host-1',
      username: 'Bright Kofi',
    },
    recipient: {
      _id: 'viewer-1',
    },
    community: {
      _id: 'community-1',
      displayName: 'ATU Students',
    },
  });

  assert.equal(payload.type, STREAM_STARTED_TYPE);
  assert.equal(payload.type, 'STREAM_STARTED');
  assert.equal(payload.senderId, 'host-1');
  assert.equal(payload.receiverId, 'viewer-1');
  assert.equal(payload.targetType, 'live');
  assert.equal(payload.targetId, 'stream-1');
  assert.equal(payload.targetUrl, '/live/stream-1');
  assert.equal(payload.pushTitle, 'A livestream has started in ATU Students.');
  assert.equal(payload.pushBody, 'Watch now.');
  assert.equal(payload.pushData.streamId, 'stream-1');
  assert.equal(payload.pushData.hostId, 'host-1');
  assert.equal(payload.pushData.communityId, 'community-1');
  assert.equal(payload.pushData.communityName, 'ATU Students');
});

test('livestream start notification payload falls back to follower copy without community', () => {
  const payload = buildLivestreamStartNotificationData({
    stream: {
      _id: 'stream-2',
      hostUsername: 'bright',
      title: 'Creator live',
      community: '',
    },
    host: {
      _id: 'host-1',
      username: 'Bright Kofi',
    },
    recipient: {
      _id: 'viewer-2',
    },
    community: null,
  });

  assert.equal(payload.type, 'STREAM_STARTED');
  assert.equal(payload.pushTitle, 'Bright Kofi is now live.');
  assert.equal(payload.pushBody, 'Join livestream now.');
  assert.equal(payload.pushData.communityId, '');
  assert.equal(payload.pushAndroidGroup, 'creator_host-1');
});
