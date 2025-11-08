const express = require('express');
const router = express.Router();
const Comment = require('../models/comment.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');

const REWARD_COMMENT = 5;
const REWARD_REPLY = 2;

// ✅ Add comment or reply to a post
// ✅ Add comment or reply to a post
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { postId, text, imageUrl, parentCommentId } = req.body;
    const userId = req.user.id;

    if (!postId || !text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Post ID and comment text are required' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = new Comment({
      postId,
      userId,
      text: text.trim(),
      imageUrl: imageUrl || '',
      parentCommentId: parentCommentId || null
    });
    await comment.save();

    // Increment post comment count
    post.commentCount += 1;
    await post.save();

    // If reply, increment parent comment reply count
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });

      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment && parentComment.userId.toString() !== userId) {
        const parentAuthor = await User.findById(parentComment.userId);
        if (parentAuthor) {
          parentAuthor.coinsBalance += REWARD_REPLY;
          await parentAuthor.save();

          await CoinTransaction.create({
            fromUserId: userId,
            toUserId: parentAuthor._id,
            amount: REWARD_REPLY,
            type: 'REWARD_REPLY',
            description: 'Reward for receiving a reply',
            relatedPostId: post._id,
            relatedCommentId: comment._id
          });
        }
      }
    }

    // Reward post author if not self
    const postAuthor = await User.findById(post.userId);
    if (postAuthor && postAuthor._id.toString() !== userId) {
      postAuthor.coinsBalance += REWARD_COMMENT;
      post.coinsEarned += REWARD_COMMENT;
      await postAuthor.save();
      await post.save();

      await CoinTransaction.create({
        fromUserId: userId,
        toUserId: post.userId,
        amount: REWARD_COMMENT,
        type: 'REWARD_COMMENT',
        description: 'Reward for receiving a comment',
        relatedPostId: post._id,
        relatedCommentId: comment._id
      });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profileImage verified')
      .lean();

    // ✅ SOCKET.IO EMIT BLOCK — broadcast new comment/reply
    io.emit('feedUpdate', {
      type: parentCommentId ? 'newReply' : 'newComment',
      postId,
      parentCommentId: parentCommentId || null,
      comment: populatedComment
    });

    // 🔔 Send notifications
    const commenter = await User.findById(userId);
    const commentAuthorName = commenter?.username || 'Someone';

    const usersToNotify = new Set();
    if (post.userId.toString() !== userId) usersToNotify.add(post.userId.toString());

    const previousComments = await Comment.find({ postId }).select('userId');
    previousComments.forEach(c => {
      if (c.userId.toString() !== userId) usersToNotify.add(c.userId.toString());
    });

    const users = await User.find({ _id: { $in: Array.from(usersToNotify) } }).select('oneSignalPlayerId');
    const playerIds = users.map(u => u.oneSignalPlayerId).filter(id => id && id.trim().length > 0);

    if (playerIds.length > 0) {
      const notificationData = {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: "New Comment" },
        contents: { en: `${commentAuthorName} commented: "${text.trim()}"` },
        data: { postId: postId },
      };

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Basic ${process.env.ONESIGNAL_KEY}`
        },
        body: JSON.stringify(notificationData)
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

// ✅ Get comments for a post
router.get('/post/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ postId, parentCommentId: null, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .lean();

    const totalComments = await Comment.countDocuments({ postId, parentCommentId: null, isActive: true });

    res.json({
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasMore: skip + comments.length < totalComments
      }
    });
  } catch (err) {
    console.error('❌ Failed to fetch comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ✅ Get replies
router.get('/:commentId/replies', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const replies = await Comment.find({ parentCommentId: commentId, isActive: true })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .lean();

    const totalReplies = await Comment.countDocuments({ parentCommentId: commentId, isActive: true });

    res.json({
      replies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReplies / limit),
        totalReplies,
        hasMore: skip + replies.length < totalReplies
      }
    });
  } catch (err) {
    console.error('❌ Failed to fetch replies:', err);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }

  // after saving the reply
if (parentComment.user.toString() !== userId.toString()) {
  await User.findByIdAndUpdate(parentComment.user, { $inc: { coins: 1 } });

  await CoinTransaction.create({
    user: parentComment.user,
    type: "reply_reward",
    amount: 1,
    fromUser: userId,
    description: "Received 1 coin from comment reply"
  });
}

});

// ✅ Like comment
// routes/commentRoutes.js
// ✅ Like comment with coin rewards
router.post("/toggle-like", authMiddleware, async (req, res) => {
  try {
    const { commentId, like } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const alreadyLiked = comment.likes.includes(userId);
    const commentOwnerId = comment.user; // assuming Comment has 'user' or 'userId'

    if (like && !alreadyLiked) {
      // 👍 User likes the comment
      comment.likes.push(userId);
      comment.likeCount = comment.likes.length;

      // 💰 Reward: give 2 coins to comment owner (if not self-like)
      if (commentOwnerId.toString() !== userId.toString()) {
        await User.findByIdAndUpdate(commentOwnerId, { $inc: { coins: 2 } });

        // Optional: log transaction
        await CoinTransaction.create({
          user: commentOwnerId,
          type: "comment_like",
          amount: 2,
          fromUser: userId,
          description: "Received 2 coins from comment like"
        });
      }
    } else if (!like && alreadyLiked) {
      // 👎 User unlikes the comment
      comment.likes.pull(userId);
      comment.likeCount = comment.likes.length;

      // 💰 Reverse reward: remove 2 coins from owner (if not self-like)
      if (commentOwnerId.toString() !== userId.toString()) {
        await User.findByIdAndUpdate(commentOwnerId, { $inc: { coins: -2 } });

        // Optional: log transaction
        await CoinTransaction.create({
          user: commentOwnerId,
          type: "comment_unlike",
          amount: -2,
          fromUser: userId,
          description: "Lost 2 coins due to comment unlike"
        });
      }
    }

    await comment.save();

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
// ✅ SIMPLE EDIT COMMENT ROUTE (for debugging)
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

    // ✅ populate before returning
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
    if (comment.userId.toString() !== userId) return res.status(403).json({ error: 'You can only delete your own comments' });

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
