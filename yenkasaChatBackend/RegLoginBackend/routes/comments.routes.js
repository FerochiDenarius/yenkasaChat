// routes/comment.routes.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/comment.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');

const REWARD_COMMENT = 3;

// ✅ Add comment to a post
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { postId, text, imageUrl, parentCommentId } = req.body;
    const userId = req.user.id;
    
    if (!postId || !text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Post ID and comment text are required' });
    }
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Create comment
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
    
    // If this is a reply, increment parent comment reply count
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(
        parentCommentId,
        { $inc: { replyCount: 1 } }
      );
    }
    
    // Reward post author with coins
    const postAuthor = await User.findById(post.userId);
    if (postAuthor && postAuthor._id.toString() !== userId) {
      postAuthor.coinsBalance += REWARD_COMMENT;
      post.coinsEarned += REWARD_COMMENT;
      await postAuthor.save();
      await post.save();
      
      // Record transaction
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
    
    // Populate user info
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profileImage verified')
      .lean();
    
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
    
    // Get top-level comments (not replies)
    const comments = await Comment.find({
      postId,
      parentCommentId: null,
      isActive: true
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .lean();
    
    const totalComments = await Comment.countDocuments({
      postId,
      parentCommentId: null,
      isActive: true
    });
    
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

// ✅ Get replies to a comment
router.get('/:commentId/replies', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const replies = await Comment.find({
      parentCommentId: commentId,
      isActive: true
    })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .lean();
    
    const totalReplies = await Comment.countDocuments({
      parentCommentId: commentId,
      isActive: true
    });
    
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
});

// ✅ Like a comment
router.post('/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const wasLiked = await comment.addLike(userId);
    
    res.json({
      success: true,
      liked: wasLiked,
      likeCount: comment.likeCount
    });
  } catch (err) {
    console.error('❌ Failed to like comment:', err);
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

// ✅ Unlike a comment
router.delete('/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const wasUnliked = await comment.removeLike(userId);
    
    res.json({
      success: true,
      unliked: wasUnliked,
      likeCount: comment.likeCount
    });
  } catch (err) {
    console.error('❌ Failed to unlike comment:', err);
    res.status(500).json({ error: 'Failed to unlike comment' });
  }
});

// ✅ Delete a comment
router.delete('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Check if user owns the comment
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    
    comment.isActive = false;
    await comment.save();
    
    // Decrement post comment count
    await Post.findByIdAndUpdate(
      comment.postId,
      { $inc: { commentCount: -1 } }
    );
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (err) {
    console.error('❌ Failed to delete comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;