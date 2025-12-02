// Controller/metrics.controller.js
const mongoose = require('mongoose');
const Post = require('../models/post.model');        // posts collection
const Comment = require('../models/comment.model');  // comments collection
const View = require('../models/view.model');        // optional: views collection (if exists)
const User = require('../models/user.model');        // users collection

// Helper: convert string id to ObjectId
const { ObjectId } = require("mongoose").Types;
const toId = (id) => new ObjectId(id);

// GET /api/users/:userId/performance-metrics
// GET /api/metrics/:userId/performance-metrics
exports.getUserPerformanceMetrics = async (req, res) => {
  try {
    const userId = req.params.userId;
    const objectId = toId(userId);

    // ==============================
    // 1) RECEIVED METRICS (from user's posts)
    // ==============================
    const posts = await Post.find({ userId: objectId })
      .select("_id likeCount commentCount shareCount viewCount")
      .lean();

    const postIds = posts.map(p => p._id);
    const totalPostCount = posts.length;

    // Summed from Post model
    const totalLikesReceived = posts.reduce((s, p) => s + (p.likeCount || 0), 0);
    const totalCommentsReceived = posts.reduce((s, p) => s + (p.commentCount || 0), 0);
    const totalShares = posts.reduce((s, p) => s + (p.shareCount || 0), 0);
    const totalViewsReceived = posts.reduce((s, p) => s + (p.viewCount || 0), 0);

    // Comments + replies + comment likes
    let totalRepliesReceived = 0;
    let commentLikesReceived = 0;
    if (postIds.length > 0) {
      const commentAgg = await Comment.aggregate([
        { $match: { postId: { $in: postIds } } },
        {
          $group: {
            _id: null,
            totalReplies: { $sum: "$replyCount" },
            commentLikes: { $sum: "$likeCount" }
          }
        }
      ]);

      if (commentAgg.length > 0) {
        totalRepliesReceived = commentAgg[0].totalReplies || 0;
        commentLikesReceived = commentAgg[0].commentLikes || 0;
      }
    }

    // ==============================
    // 2) ACTIVITY METRICS (what user did)
    // ==============================

    // Views user has made
    const totalViewsCount = await View.countDocuments({ userId: objectId });

    // Comments user made
    const totalCommentsMade = await Comment.countDocuments({ userId: objectId });

    // Likes user has made (posts where userId exists in likes[])
    const totalLikesCount = await Post.countDocuments({ likes: objectId });

    // Posts user has created
    const postsCreated = totalPostCount;

    // ==============================
    // 3) SOCIAL METRICS
    // ==============================
    const totalFollowers = await Follow.getFollowersCount(objectId);
    const totalFollowing = await Follow.getFollowingCount(objectId);

    // ==============================
    // 4) Build response (matches Android model)
    // ==============================
    const response = {
      // ACTIVITY
      postsCreated,
      totalPostCount,
      totalViewsCount,
      totalLikesCount,
      totalCommentsMade,
      totalFollowers,
      totalFollowing,

      // RECEIVED
      totalViewsReceived,
      totalLikesReceived,
      totalCommentsReceived,
      totalRepliesReceived,
      commentLikesReceived,
      totalShares
    };

    return res.json({
      success: true,
      performanceMetrics: response
    });

  } catch (err) {
    console.error("❌ Error computing performance metrics:", err);
    return res.status(500).json({ success: false, error: "Failed to compute performance metrics" });
  }
};

// GET /api/users/:userId/post-metrics
exports.getUserPostsMetrics = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Return each post with its metrics (so UI can click into any)
    const posts = await Post.find({ userId })
      .select('_id caption likeCount commentCount shareCount viewCount coinsEarned createdAt') // include fields you need
      .lean();

    // Optionally enrich with commentLikes or replyCount per post (aggregate per post)
    const postIds = posts.map(p => p._id);
    let commentsAggMap = {};
    if (postIds.length > 0) {
      const commentsAgg = await Comment.aggregate([
        { $match: { postId: { $in: postIds.map(toId) } } },
        {
          $group: {
            _id: '$postId',
            totalReplies: { $sum: '$replyCount' },
            commentLikes: { $sum: '$likeCount' },
            commentsCount: { $sum: 1 }
          }
        }
      ]);
      commentsAgg.forEach(ca => { commentsAggMap[ca._id.toString()] = ca; });
    }

    const enrichedPosts = posts.map(p => {
      const map = commentsAggMap[p._id.toString()] || {};
      return {
        _id: p._id,
        caption: p.caption,
        likeCount: p.likeCount || 0,
        commentCount: p.commentCount || 0,
        shareCount: p.shareCount || 0,
        viewCount: p.viewCount || 0,
        coinsEarned: p.coinsEarned || 0,
        totalReplies: map.totalReplies || 0,
        commentLikes: map.commentLikes || 0,
        createdAt: p.createdAt
      };
    });

    return res.json({ success: true, posts: enrichedPosts });
  } catch (err) {
    console.error('Error getting post metrics', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch post metrics' });
  }
};

// GET /api/users/:userId/post-metrics/:postId
exports.getSinglePostMetrics = async (req, res) => {
  try {
    const { userId, postId } = req.params;

    const post = await Post.findOne({ _id: postId, userId }).lean();
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    // comments for this post
    const comments = await Comment.find({ postId }).select('replyCount likeCount').lean();
    const totalReplies = comments.reduce((s, c) => s + (c.replyCount || 0), 0);
    const commentLikes = comments.reduce((s, c) => s + (c.likeCount || 0), 0);

    // views: either Post.viewCount or views collection
    let viewCount = post.viewCount || 0;
    if (await View.collection.countDocuments() > 0) {
      viewCount = await View.countDocuments({ postId: toId(postId) });
    }

    const detailed = {
      _id: post._id,
      caption: post.caption,
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      shareCount: post.shareCount || 0,
      viewCount,
      coinsEarned: post.coinsEarned || 0,
      totalReplies,
      commentLikes
    };

    return res.json({ success: true, postMetrics: detailed });
  } catch (err) {
    console.error('Error fetching single post metrics', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch post metrics' });
  }
};
