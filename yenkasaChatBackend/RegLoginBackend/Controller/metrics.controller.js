// Controller/metrics.controller.js
const mongoose = require('mongoose');
const Post = require('../models/post.model');        // posts collection
const Comment = require('../models/comment.model');  // comments collection
const View = require('../models/view.model');        // optional: views collection (if exists)
const User = require('../models/user.model');        // users collection

// Helper: convert string id to ObjectId
const toId = id => mongoose.Types.ObjectId(id);

// GET /api/users/:userId/performance-metrics
exports.getUserPerformanceMetrics = async (req, res) => {
  try {
    const userId = req.params.userId;

    // 1) Aggregate posts by user to get per-post sums and totals in one pipeline
    const postsAgg = await Post.aggregate([
      { $match: { 'userId': toId(userId) } }, // if userId stored as ObjectId
      {
        $group: {
          _id: null,
          postsCreated: { $sum: 1 },
          totalLikesReceived: { $sum: '$likeCount' },
          totalCommentsReceived: { $sum: '$commentCount' },
          totalShares: { $sum: '$shareCount' },
          totalViewsFromPostField: { $sum: '$viewCount' },
          coinsEarned: { $sum: '$coinsEarned' }
        }
      }
    ]);

    const postSums = postsAgg[0] || {
      postsCreated: 0,
      totalLikesReceived: 0,
      totalCommentsReceived: 0,
      totalShares: 0,
      totalViewsFromPostField: 0,
      coinsEarned: 0
    };

    // 2) Aggregate comments that belong to this user's posts to get reply counts & comment likes
    // First get user's post ids (we could reuse the same aggregation if we stored ids)
    const userPosts = await Post.find({ userId }, { _id: 1 }).lean();
    const postIds = userPosts.map(p => p._id);
    let totalRepliesReceived = 0;
    let commentLikesReceived = 0;
    if (postIds.length > 0) {
      const commentsAgg = await Comment.aggregate([
        { $match: { postId: { $in: postIds.map(toId) } } },
        {
          $group: {
            _id: null,
            totalReplies: { $sum: '$replyCount' },
            totalCommentLikes: { $sum: '$likeCount' }
          }
        }
      ]);
      const cAgg = commentsAgg[0] || { totalReplies: 0, totalCommentLikes: 0 };
      totalRepliesReceived = cAgg.totalReplies || 0;
      commentLikesReceived = cAgg.totalCommentLikes || 0;
    }

    // 3) Views: prefer aggregated 'views' collection if you track individual views
    // If you have a views collection where each doc has postId, we count them, else fallback to Post.viewCount sum
    let totalViewsReceived = postSums.totalViewsFromPostField;
    if (await View.collection.countDocuments() > 0) {
      // aggregate views collection
      const viewsAgg = await View.aggregate([
        { $match: { postId: { $in: postIds.map(toId) } } },
        { $group: { _id: null, viewsCount: { $sum: 1 } } }
      ]);
      totalViewsReceived = (viewsAgg[0] && viewsAgg[0].viewsCount) || totalViewsReceived;
    }

    // 4) Followers: use user.followersCount if present, else count followers array
    const userDoc = await User.findById(userId).select('followersCount followers').lean();
    const totalFollowers = userDoc ? (userDoc.followersCount || (userDoc.followers && userDoc.followers.length) || 0) : 0;

    // Build response shape that matches your Verification/UserPerformance models
    const response = {
      followers: totalFollowers,
      postsCreated: postSums.postsCreated || 0,
      likesReceived: postSums.totalLikesReceived || 0,
      viewsReceived: totalViewsReceived || 0,
      commentsReceived: postSums.totalCommentsReceived || 0,
      repliesReceived: totalRepliesReceived || 0,
      commentLikesReceived: commentLikesReceived || 0,
      totalShares: postSums.totalShares || 0,
      coinsEarned: postSums.coinsEarned || 0
    };

    return res.json({ success: true, performanceMetrics: response });
  } catch (err) {
    console.error('Error computing performance metrics', err);
    return res.status(500).json({ success: false, error: 'Failed to compute metrics' });
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
