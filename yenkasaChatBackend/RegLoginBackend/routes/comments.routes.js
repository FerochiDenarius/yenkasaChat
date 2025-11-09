const express = require('express');
const router = express.Router();
const Comment = require('../models/comment.model');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/cointransaction.model');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const REWARD_COMMENT = 5;          // reward to post author when someone comments
const REWARD_REPLY = 2;            // reward to parent comment author
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

    // Reward the commenter (for making a comment)
    const commenter = await User.findById(userId);
    const beforeBalance = commenter.coinsBalance;
    commenter.coinsBalance += REWARD_COMMENT_ACTION;
    await commenter.save();

    await CoinTransaction.create({
      fromUserId: null,
      toUserId: userId,
      fromUsername: '',
      toUsername: commenter.username,
      fromWalletId: '',
      toWalletId: commenter.walletId,
      amount: REWARD_COMMENT_ACTION,
      type: 'REWARD_COMMENT',
      description: 'Reward for making a comment',
       relatedPostId: await Post.findById(post._id),
      relatedCommentId: comment._id,
      transactionId: uuidv4(),
      toUserBalanceBefore: beforeBalance,
      toUserBalanceAfter: commenter.coinsBalance
    });

    // Reward parent comment author (if reply)
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });

      const parentComment = await Comment.findById(parentCommentId).populate('userId', 'username walletId');
      if (parentComment && parentComment.userId.toString() !== userId) {
        const parentAuthor = await User.findById(parentComment.userId);
        const parentBefore = parentAuthor.coinsBalance;

        parentAuthor.coinsBalance += REWARD_REPLY;
        await parentAuthor.save();

        await CoinTransaction.create({
          fromUserId: userId,
          toUserId: parentAuthor._id,
          fromUsername: commenter.username,
          toUsername: parentAuthor.username,
          fromWalletId: commenter.walletId,
          toWalletId: parentAuthor.walletId,
          amount: REWARD_REPLY,
          type: 'REWARD_COMMENT',
          description: 'Reward for receiving a reply',
           relatedPostId: await Post.findById(post._id),
          relatedCommentId: comment._id,
          transactionId: uuidv4(),
          toUserBalanceBefore: parentBefore,
          toUserBalanceAfter: parentAuthor.coinsBalance
        });
      }
    }

    // Reward post author if not self
    const postAuthor = await User.findById(post.userId);
    if (postAuthor && postAuthor._id.toString() !== userId) {
      const beforePostBalance = postAuthor.coinsBalance;
      postAuthor.coinsBalance += REWARD_COMMENT;
      await postAuthor.save();

      await CoinTransaction.create({
        fromUserId: userId,
        toUserId: post.userId,
        fromUsername: commenter.username,
        toUsername: postAuthor.username,
        fromWalletId: commenter.walletId,
        toWalletId: postAuthor.walletId,
        amount: REWARD_COMMENT,
        type: 'REWARD_COMMENT',
        description: 'Reward for receiving a comment on post',
        relatedPostId: post._id,
        relatedCommentId: comment._id,
        transactionId: uuidv4(),
        toUserBalanceBefore: beforePostBalance,
        toUserBalanceAfter: postAuthor.coinsBalance
      });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'username profileImage verified')
      .lean();

    // Optional broadcast (ensure io is defined globally)
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

    if (like && !alreadyLiked) {
      await comment.addLike(userId);

      // Reward liker
      const beforeLikerBalance = liker.coinsBalance;
      liker.coinsBalance += REWARD_COMMENT_LIKE;
      await liker.save();

      await CoinTransaction.create({
        fromUserId: null,
        toUserId: userId,
        fromUsername: '',
        toUsername: liker.username,
        fromWalletId: '',
        toWalletId: liker.walletId,
        amount: REWARD_COMMENT_LIKE,
        type: 'REWARD_COMMENT_LIKE',
        description: 'Reward for liking a comment',
        relatedCommentId: comment._id,
        transactionId: uuidv4(),
        toUserBalanceBefore: beforeLikerBalance,
        toUserBalanceAfter: liker.coinsBalance
      });

      // Reward comment owner (if not self-like)
      if (commentOwnerId.toString() !== userId.toString()) {
        const owner = await User.findById(commentOwnerId);
        const beforeOwnerBalance = owner.coinsBalance;
        owner.coinsBalance += REWARD_COMMENT_LIKE;
        await owner.save();

        await CoinTransaction.create({
          fromUserId: userId,
          toUserId: commentOwnerId,
          fromUsername: liker.username,
          toUsername: owner.username,
          fromWalletId: liker.walletId,
          toWalletId: owner.walletId,
          amount: REWARD_COMMENT_LIKE,
          type: 'REWARD_COMMENT_LIKE',
          description: 'Reward for receiving a like on comment',
          relatedCommentId: comment._id,
          transactionId: uuidv4(),
          toUserBalanceBefore: beforeOwnerBalance,
          toUserBalanceAfter: owner.coinsBalance
        });
      }
    } 
    else if (!like && alreadyLiked) {
      await comment.removeLike(userId);
      // Skipping coin deduction intentionally
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
