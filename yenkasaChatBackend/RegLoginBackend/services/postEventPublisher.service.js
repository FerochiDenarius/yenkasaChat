const crypto = require('crypto');

const Post = require('../models/post.model');
const { attachAccurateViewCounts } = require('../utils/postViewCounts');

function stableHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function postLogicalKey(post) {
  if (!post) return '';
  if (post.clientRequestId) {
    return `client:${post.userId}:${post.clientRequestId}`;
  }

  const communityId = post.communityId?._id || post.communityId || '';
  const mediaKey = [
    post.imageUrl || '',
    ...(post.imageUrls || []),
    post.videoUrl || '',
    post.audioUrl || '',
  ]
    .filter(Boolean)
    .join('|');
  const textKey = (post.text || '').trim().toLowerCase();
  return `post:${stableHash([post.userId, communityId, textKey, mediaKey].join('|'))}`;
}

function attachLikedByUser(posts, viewerId) {
  if (!viewerId) return posts;

  const decorate = (post) => ({
    ...post,
    likedByUser: Array.isArray(post.likes)
      ? post.likes.some((id) => id?.toString() === viewerId.toString())
      : false,
  });

  return Array.isArray(posts) ? posts.map(decorate) : decorate(posts);
}

async function populateFeedPost(postId, viewerId = null) {
  const post = await Post.findById(postId)
    .populate('userId', 'username profileImage verified roleName')
    .populate('communityId', 'name displayName')
    .lean();

  if (!post) return null;
  await attachAccurateViewCounts(post);
  return attachLikedByUser(post, viewerId);
}

async function emitApprovedPostCreated(postId, source, requestId = '') {
  if (!global.io) return;

  const post = await populateFeedPost(postId);
  if (!post) return;

  const timestamp = new Date().toISOString();
  const eventId = `post_created:${post._id}`;
  const logicalPostKey = postLogicalKey(post);
  const socketPost = {
    ...post,
    eventId,
    requestId,
    logicalPostKey,
    eventSource: source,
    eventTimestamp: timestamp,
  };

  global.io.emit('newPost', socketPost);
  global.io.emit('feedUpdate', {
    eventId,
    requestId,
    logicalPostKey,
    type: 'newPost',
    action: 'new_post',
    source,
    postId: post._id,
    userId: post.userId?._id || post.userId,
    community:
      post.communityName ||
      post.communityId?.displayName ||
      post.communityId?.name ||
      '',
    createdAt: post.createdAt,
    timestamp,
    post: socketPost,
  });
}

module.exports = {
  emitApprovedPostCreated,
  populateFeedPost,
  postLogicalKey,
};
