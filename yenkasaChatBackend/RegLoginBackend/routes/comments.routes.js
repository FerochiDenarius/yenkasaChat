const express = require('express');
const router = express.Router();
const Comment = require('../models/comment.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const rewardService = require('../services/reward.service');



const REWARD_COMMENT = 5;          // reward to post author 
const REWARD_REPLY = 2;            // reward to replies
const REWARD_COMMENT_ACTION = 2;   // reward to user who comments
const REWARD_COMMENT_LIKE = 1;     // reward for liking / being liked

// ✅ Add comment or reply
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { postId, text, imageUrl, parentCommentId } = req.body;
    const userId = req.user.id;

    if (!postId || !text?.trim()) {
      return res.status(400).json({ error: 'Post ID and comment text are required' });
    }

    const post = await Post.findById(postId).populate('userId', 'username walletId');
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const commenter = await User.findById(userId);

    // Create the comment
    const comment = new Comment({
      postId,
      userId,
      text: text.trim(),
      imageUrl: imageUrl || '',
      parentCommentId: parentCommentId || null
    });
    await comment.save();

    // Reward post author (5 coins) — only if not self-comment
    if (post.userId._id.toString() !== userId) {
      await rewardService.reward(post.userId._id, REWARD_COMMENT, {
        fromUserId: userId,
        type: 'REWARD_COMMENT_RECEIVED',
        description: `Earned ${REWARD_COMMENT} YKC for receiving a comment on post ${post._id}`,
        relatedPostId: post._id,
        relatedCommentId: comment._id,
        activityId: `received_comment_${post._id}_${post.userId._id}`,
      });
    }

    // Increment post comment count
    post.commentCount += 1;
    await post.save();

    // Reward commenter (for commenting)
    await rewardService.reward(userId, REWARD_COMMENT_ACTION, {
      fromUserId: null,
      type: 'REWARD_COMMENT',
      description: `Earned ${REWARD_COMMENT_ACTION} YKC for commenting on post ${post._id}`,
      relatedPostId: post._id,
      relatedCommentId: comment._id,
      activityId: `comment_${post._id}_${userId}`,
    });

    // Reward parent comment author (if this is a reply)
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });

      const parentComment = await Comment.findById(parentCommentId).populate('userId', 'username walletId');
      if (parentComment && parentComment.userId.toString() !== userId) {
        await rewardService.reward(parentComment.userId, REWARD_REPLY, {
          fromUserId: userId,
          type: 'REWARD_REPLY',
          description: `Earned ${REWARD_REPLY} YKC for receiving a reply on comment ${parentCommentId}`,
          relatedPostId: post._id,
          relatedCommentId: comment._id,
          activityId: `reply_${parentCommentId}_${userId}`,
        });
      }
    }

    // Populate final comment for response
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profileImage verified')
      .lean();

    // Optional broadcast (if socket.io is globally defined)
    if (typeof io !== 'undefined') {
      io.emit('feedUpdate', {
        type: parentCommentId ? 'newReply' : 'newComment',
        postId,
        parentCommentId: parentCommentId || null,
        comment: populatedComment
      });
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: populatedComment
    });

  } catch (err) {
    console.error('❌ Failed to add comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ✅ Get comments for a post (with pagination)
router.get('/post/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const comments = await Comment.find({ postId, isActive: true })
      .populate('userId', 'username profileImage verified')
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


// ✅ Like or unlike comment
router.post("/toggle-like", authMiddleware, async (req, res) => {
  try {
    const { commentId, like } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId).populate('userId', 'username walletId');
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

    const alreadyLiked = comment.isLikedBy(userId);
    const commentOwnerId = comment.userId;
    const liker = await User.findById(userId);

    // --- Like Action ---
    if (like && !alreadyLiked) {
      await comment.addLike(userId);

      // ✅ Reward liker (for engaging)
      await rewardService.reward(userId, REWARD_COMMENT_LIKE, {
        type: 'REWARD_COMMENT_LIKE',
        description: `Earned ${REWARD_COMMENT_LIKE} YKC for liking a comment`,
        relatedCommentId: comment._id,
        activityId: `like_comment_${commentId}_${userId}`,
      });

      // ✅ Reward comment owner (for receiving a like)
      if (commentOwnerId.toString() !== userId.toString()) {
        await rewardService.reward(commentOwnerId, REWARD_COMMENT_LIKE, {
          fromUserId: userId,
          type: 'REWARD_COMMENT_LIKE_RECEIVED',
          description: `Earned ${REWARD_COMMENT_LIKE} YKC for receiving a like`,
          relatedCommentId: comment._id,
          activityId: `receive_like_${commentId}_${userId}`,
        });
      }
    }

    // --- Unlike Action ---
    else if (!like && alreadyLiked) {
      await comment.removeLike(userId);
      // ❌ No deduction — we intentionally skip balance reversal
    }

    res.json({ success: true, comment });
  } catch (err) {
    console.error("❌ Error toggling like:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
      .populate('userId', 'username profileImage verified')
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
