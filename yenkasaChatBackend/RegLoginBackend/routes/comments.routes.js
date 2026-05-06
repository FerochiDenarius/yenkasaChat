const express = require('express');
const router = express.Router();
const Comment = require('../models/comment.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const UserPrivacy = require('../models/userPrivacy.model');
const rewardService = require('../services/reward.service');
const { areUsersBlocked, getBlockedRelationshipUserIds } = require('../services/privacy.service');




const REWARD_COMMENT = 1;
const REWARD_REPLY = 1;
const REWARD_COMMENT_ACTION = 1;
const REWARD_COMMENT_LIKE = 1;


/* ---------------------------------------------------
 * BLOCK CHECK helper
 * --------------------------------------------------- */
async function isBlocked(userA, userB) {
  return areUsersBlocked(userA, userB);
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

if (!parentCommentId) {
  await Post.updateOne(
    { _id: postId },
    { $inc: { commentCount: 1 } }
  );

  await rewardService.reward(userId, REWARD_COMMENT, {
    type: "REWARD_COMMENT",
    description: `Earned ${REWARD_COMMENT} YKC for commenting on a post`,
    relatedPostId: post._id,
    relatedCommentId: comment._id,
    activityId: `comment_${comment._id}_${userId}`,
  });
}

    if (!parentCommentId && post.userId._id.toString() !== userId) {
  const { sendNotification } =
    await import('../services/notification.service.js');

  await sendNotification({
    type: "post_comment",
    senderId: userId,
    receiverId: post.userId._id,
    activityId: post._id.toString(),
    message: `${commenter.username} commented on your post`,
    targetType: "post",
    targetId: post._id.toString()
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

 const { reward } = await import('../services/reward.service.js');
const { sendNotification } =
  await import('../services/notification.service.js');

await reward(parentOwnerId, REWARD_REPLY, {
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
  message: `${commenter.username} replied to your comment`,
  targetType: "comment",
  targetId: parentCommentId,
  targetUrl: `/post/${post._id.toString()}?openComments=true`
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

return res.status(201).json({
  success: true,
  message: "Comment added",
  comment: populatedComment,
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

   const { reward } = await import('../services/reward.service.js');
const { sendNotification } =
  await import('../services/notification.service.js');

await reward(userId, REWARD_COMMENT_LIKE, {
  type: "REWARD_COMMENT_LIKE",
  description: `Earned ${REWARD_COMMENT_LIKE} YKC for liking a comment`,
  relatedCommentId: comment._id,
  activityId: `comment_like_${commentId}_${userId}_${Date.now()}`,
});


      // Reward comment owner
  await reward(commentOwnerId, REWARD_COMMENT_LIKE, {
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
  message: `${liker.username} liked your comment`,
  targetType: "comment",
  targetId: commentId
});


      return res.json({
        success: true,
        likeCount: updated.likeCount,
        liked: true,
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

    if (!comment.parentCommentId) {
      await Post.findByIdAndUpdate(comment.postId, { $inc: { commentCount: -1 } });
    } else {
      await Comment.findByIdAndUpdate(comment.parentCommentId, { $inc: { replyCount: -1 } });
    }

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
