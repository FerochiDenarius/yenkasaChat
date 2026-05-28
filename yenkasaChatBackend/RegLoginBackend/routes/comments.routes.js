const express = require('express');
const router = express.Router();
const Comment = require('../models/comment.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const UserPrivacy = require('../models/userPrivacy.model');
const rewardService = require('../services/reward.service');
const { sendNotification } = require('../services/notification.service');
const { areUsersBlocked, getBlockedRelationshipUserIds } = require('../services/privacy.service');
const { publishYmeEvent } = require('../src/yme/services/eventPublisher.service');




const REWARD_COMMENT = 1;
const REWARD_REPLY = 1;
const REWARD_COMMENT_ACTION = 1;
const REWARD_COMMENT_LIKE = 0.5;


async function notifyPostOwnerOfComment({ post, comment, commenter, senderId }) {
  const receiverId = post.userId._id.toString();
  if (receiverId === senderId.toString()) {
    console.log("[CommentsRoute] Skipping post_comment notification for self-comment", {
      postId: post._id.toString(),
      senderId: senderId.toString(),
    });
    return null;
  }

  const commenterName = commenter?.username || "Someone";
  const postId = post._id.toString();

  const notification = await sendNotification({
    type: "post_comment",
    senderId,
    receiverId,
    activityId: postId,
    message: `${commenterName} commented on your post`,
    targetType: "post",
    targetId: postId,
    targetUrl: `/post/${postId}?openComments=true`,
    push: true,
    pushTitle: "New comment on your post",
    pushBody: `${commenterName} commented on your post`,
    pushData: {
      type: "post_comment",
      postId,
      commentId: comment._id.toString(),
      targetType: "post",
      targetId: postId
    }
  });

  console.log("[CommentsRoute] Shared post_comment notification processed", {
    postId,
    commentId: comment._id.toString(),
    senderId: senderId.toString(),
    receiverId,
    delivered: Boolean(notification)
  });

  return notification;
}


/* ---------------------------------------------------
 * BLOCK CHECK helper
 * --------------------------------------------------- */
async function isBlocked(userA, userB) {
  return areUsersBlocked(userA, userB);
}

async function syncTopLevelCommentCount(postId) {
  const commentCount = await Comment.countDocuments({
    postId,
    isActive: true,
    parentCommentId: null
  });

  await Post.findByIdAndUpdate(postId, { $set: { commentCount } });
  return commentCount;
}

function emitCommentCountUpdate(postId, commentCount) {
  if (!global.io) return;
  global.io.emit("commentCountUpdate", {
    postId: postId.toString(),
    commentCount,
    commentsCount: commentCount,
    timestamp: new Date()
  });
}


/* ---------------------------------------------------
 * ADD COMMENT or REPLY
 * --------------------------------------------------- */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { postId, text, imageUrl, parentCommentId } = req.body;
    const userId = req.user.id;

    if (!postId || !text?.trim())
      return res.status(400).json({ error: "Post ID and text are required" });

    const post = await Post.findById(postId).populate('userId', 'username playerId');
    if (!post) return res.status(404).json({ error: "Post not found" });

    // BLOCK CHECK (viewer vs post owner)
    if (await isBlocked(userId, post.userId._id.toString()))
      return res.status(403).json({ error: "Blocked by user privacy settings" });

    // Fetch Commenter
    const commenter = await User.findById(userId);

    // Create Comment
    const comment = await Comment.create({
      postId,
      userId,
      text: text.trim(),
      imageUrl: imageUrl || "",
      parentCommentId: parentCommentId || null,
    });

let updatedCommentCount = null;

if (!parentCommentId) {
  updatedCommentCount = await syncTopLevelCommentCount(postId);

  var commentRewardTx = await rewardService.reward(userId, REWARD_COMMENT, {
    type: "REWARD_COMMENT",
    description: `Earned ${REWARD_COMMENT} YKC for commenting on a post`,
    relatedPostId: post._id,
    relatedCommentId: comment._id,
    activityId: `comment_${comment._id}_${userId}`,
  });

  if (post.userId._id.toString() !== userId) {
    await rewardService.reward(post.userId._id, 1, {
      type: "REWARD_POST_COMMENT_RECEIVED",
      description: "Earned 1 YKC because your post received a comment",
      relatedPostId: post._id,
      relatedCommentId: comment._id,
      activityId: `post_comment_received_${post._id}_${comment._id}`,
    });
  }
}

    if (!parentCommentId) {
      await notifyPostOwnerOfComment({
        post,
        comment,
        commenter: commenter || { username: req.user.username },
        senderId: userId,
      });
    }


/* ---------------------------------------------------
 * REPLY LOGIC (FULLY FIXED)
 * --------------------------------------------------- */
let parentComment = null;

if (parentCommentId) {

  // 1️⃣ Load parent comment FIRST
  parentComment = await Comment.findById(parentCommentId)
    .populate("userId", "username playerId");

  if (!parentComment) {
    return res.status(404).json({ error: "Parent comment not found" });
  }

  const parentOwnerId = parentComment.userId._id.toString();

  // 2️⃣ FULL BLOCK RESTRICTION — cannot reply
  if (await isBlocked(userId, parentOwnerId)) {
    return res.status(403).json({ error: "You cannot reply due to privacy settings" });
  }

  // 3️⃣ Increase reply count
  await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });

await rewardService.reward(parentOwnerId, REWARD_REPLY, {
  fromUserId: userId,
  type: "REWARD_REPLY",
  description: `Earned ${REWARD_REPLY} YKC for receiving a reply`,
  relatedPostId: post._id,
  relatedCommentId: comment._id,
  activityId: `reply_${parentCommentId}_${userId}`,
});

await sendNotification({
  type: "comment_reply",
  senderId: userId,
  receiverId: parentOwnerId,
  activityId: parentCommentId, // ✅ FIX
  message: `${commenter?.username || req.user.username || "Someone"} replied to your comment`,
  targetType: "comment",
  targetId: parentCommentId,
  targetUrl: `/post/${post._id.toString()}?openComments=true`,
  push: true,
  pushTitle: "New reply to your comment",
  pushBody: `${commenter?.username || req.user.username || "Someone"} replied to your comment`,
  pushData: {
    type: "comment_reply",
    postId: post._id.toString(),
    commentId: parentCommentId,
    replyId: comment._id.toString(),
    targetType: "comment",
    targetId: parentCommentId
  }
});

}

/* ---------------------------------------------------
 * POPULATE + SOCKET EMIT (this remains outside the reply block)
 * --------------------------------------------------- */
const populatedComment = await Comment.findById(comment._id)
  .populate('userId', 'username profileImage verified roleName')
  .lean();

if (global.io) {
  global.io.emit('feedUpdate', {
    type: parentCommentId ? "newReply" : "newComment",
    postId,
    parentCommentId: parentCommentId || null,
    comment: populatedComment,
  });
}

if (!parentCommentId && updatedCommentCount != null) {
  emitCommentCountUpdate(postId, updatedCommentCount);
}

publishYmeEvent({
  userId,
  sourceApp: "social_app",
  eventType: "comment_created",
  postId,
  creatorId: post.userId?._id,
  relatedUserId: parentComment?.userId?._id || post.userId?._id,
  contentId: parentCommentId ? `comment:${parentCommentId}` : `post:${postId}`,
  communityId: post.communityId,
  message: text.trim(),
  categories: post.tags || [],
  payload: {
    isReply: Boolean(parentCommentId),
    parentCommentId: parentCommentId || null,
    commentId: comment._id.toString(),
    communityName: post.communityName || "",
  },
});

return res.status(201).json({
  success: true,
  message: "Comment added",
  comment: populatedComment,
  rewardAmount: commentRewardTx?.amount || 0,
  newBalance: commentRewardTx?.toUserBalanceAfter ?? null,
});


  } catch (err) {
    console.error("❌ Comment failed:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});


// ✅ Get comments for a post (with pagination)
router.get('/post/:postId', authMiddleware, async (req, res) => {
  try {

    const { postId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const viewerId = req.user.id;

    // Load the post first
    const post = await Post.findById(postId).populate("userId");
    if (!post) return res.status(404).json({ error: "Post not found" });

    // 🛑 BLOCK CHECK: viewer vs post owner
    if (await isBlocked(viewerId, post.userId._id.toString())) {
      return res.status(403).json({ error: "You cannot view comments due to privacy settings" });
    }

    const blockedUserIds = await getBlockedRelationshipUserIds(viewerId);

    // Fetch comments only AFTER block validation, excluding users either side blocked.
    const comments = await Comment.find({
      postId,
      isActive: true,
      userId: { $nin: blockedUserIds }
    })
      .populate('userId', 'username profileImage verified roleName')
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      comments
    });

  } catch (err) {
    console.error('❌ Error loading comments:', err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});



/* ---------------------------------------------------
 * LIKE / UNLIKE COMMENT
 * --------------------------------------------------- */
router.post("/toggle-like", authMiddleware, async (req, res) => {
  try {
    const { commentId, like } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId).populate(
      "userId",
      "username playerId"
    );

    if (!comment)
      return res.status(404).json({ message: "Comment not found" });

    const commentOwnerId = comment.userId._id.toString();
    const liker = await User.findById(userId);

    // Blocked relationships should not be able to interact directly, even if
    // a stale client still has a comment id.
    if (await isBlocked(userId, commentOwnerId)) {
      return res.status(403).json({
        message: "Blocked due to privacy settings",
      });
    }

    const alreadyLiked = comment.isLikedBy(userId);

    /* ----------------------------------------------
     * LIKE
     * ---------------------------------------------- */
    if (like && !alreadyLiked) {
      await comment.addLike(userId);

      // Reload updated likeCount
      const updated = await Comment.findById(commentId).select("likeCount");

const likerRewardTx = await rewardService.reward(userId, REWARD_COMMENT_LIKE, {
  type: "REWARD_COMMENT_LIKE",
  description: `Earned ${REWARD_COMMENT_LIKE} YKC for liking a comment`,
  relatedCommentId: comment._id,
  activityId: `comment_like_${commentId}_${userId}_${Date.now()}`,
});


      // Reward comment owner
  await rewardService.reward(commentOwnerId, REWARD_COMMENT_LIKE, {
  fromUserId: userId,
  type: "REWARD_COMMENT_LIKE",
  description: `Earned ${REWARD_COMMENT_LIKE} YKC for receiving a like`,
  relatedCommentId: comment._id,
  activityId: `comment_like_received_${commentId}_${userId}_${Date.now()}`,
});

await sendNotification({
  type: "comment_like",
  senderId: userId,
  receiverId: commentOwnerId,
  activityId: commentId,
  message: `${liker?.username || req.user.username || "Someone"} liked your comment`,
  targetType: "comment",
  targetId: commentId,
  targetUrl: `/post/${comment.postId.toString()}?openComments=true`,
  push: true,
  pushTitle: "New like on your comment",
  pushBody: `${liker?.username || req.user.username || "Someone"} liked your comment`,
  pushData: {
    type: "comment_like",
    postId: comment.postId.toString(),
    commentId,
    targetType: "comment",
    targetId: commentId
  }
});


      return res.json({
        success: true,
        likeCount: updated.likeCount,
        liked: true,
        rewardAmount: likerRewardTx?.amount || 0,
        newBalance: likerRewardTx?.toUserBalanceAfter ?? null,
      });
    }

    /* ----------------------------------------------
     * UNLIKE
     * ---------------------------------------------- */
    if (!like && alreadyLiked) {
      await comment.removeLike(userId);

      const updated = await Comment.findById(commentId).select("likeCount");

      return res.json({
        success: true,
        likeCount: updated.likeCount,
        liked: false,
      });
    }

    // No change
    const updated = await Comment.findById(commentId).select("likeCount");

    return res.json({
      success: true,
      likeCount: updated.likeCount,
      liked: alreadyLiked,
    });

  } catch (err) {
    console.error("❌ Toggle-like error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// ✅ Unlike comment
router.delete('/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const wasUnliked = await comment.removeLike(userId);

    res.json({ success: true, unliked: wasUnliked, likeCount: comment.likeCount });
  } catch (err) {
    console.error('❌ Failed to unlike comment:', err);
    res.status(500).json({ error: 'Failed to unlike comment' });
  }
});

// ✅ Edit comment
router.put('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId.toString() !== userId)
      return res.status(403).json({ error: 'You can only edit your own comments' });

    comment.text = text.trim();
    await comment.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profileImage verified roleName')
      .lean();

    res.json({
      success: true,
      message: 'Comment updated successfully',
      comment: populatedComment
    });
  } catch (err) {
    console.error('❌ Edit comment failed:', err);
    res.status(500).json({ error: 'Server error while editing comment' });
  }
});

// ✅ Delete comment
router.delete('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId.toString() !== userId)
      return res.status(403).json({ error: 'You can only delete your own comments' });

    comment.isActive = false;
    await comment.save();

    let updatedCommentCount = null;
    if (!comment.parentCommentId) {
      updatedCommentCount = await syncTopLevelCommentCount(comment.postId);
    } else {
      await Comment.findByIdAndUpdate(comment.parentCommentId, { $inc: { replyCount: -1 } });
    }

    if (updatedCommentCount != null) {
      emitCommentCountUpdate(comment.postId, updatedCommentCount);
    }

    publishYmeEvent({
      userId,
      sourceApp: "social_app",
      eventType: "comment_deleted",
      postId: comment.postId,
      contentId: comment.parentCommentId ? `comment:${comment.parentCommentId}` : `post:${comment.postId}`,
      payload: {
        commentId: comment._id.toString(),
        parentCommentId: comment.parentCommentId?.toString?.() || null,
      },
    });

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
