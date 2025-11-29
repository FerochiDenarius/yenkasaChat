const Post = require('../models/post.model');
const Comment = require('../models/comment.model');
const Follow = require('../models/follow.model');
const View = require('../models/view.model');

module.exports.getUserPerformanceMetrics = async function(userId) {
  try {
    // Followers Count
    const followers = await Follow.getFollowersCount(userId);

    // Posts Created
    const postsCreated = await Post.countDocuments({ userId });

    // Likes Received on Posts
    const likesAgg = await Post.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$likeCount" }}}
    ]);
    const likesReceived = likesAgg[0]?.total || 0;

    // Views Received on Posts
    const viewsAgg = await View.aggregate([
      { $lookup: {
          from: "posts",
          localField: "postId",
          foreignField: "_id",
          as: "post"
      }},
      { $unwind: "$post" },
      { $match: { "post.userId": userId }},
      { $group: { _id: null, total: { $sum: 1 }}}
    ]);
    const viewsReceived = viewsAgg[0]?.total || 0;

    // Comments RECEIVED on Posts
    const commentsReceivedAgg = await Comment.aggregate([
      { $lookup: {
          from: "posts",
          localField: "postId",
          foreignField: "_id",
          as: "post"
      }},
      { $unwind: "$post" },
      { $match: { "post.userId": userId }},
      { $group: { _id: null, total: { $sum: 1 }}}
    ]);
    const commentsReceived = commentsReceivedAgg[0]?.total || 0;

    // Replies RECEIVED (comments on comments)
    const repliesReceived = await Comment.countDocuments({
      parentCommentId: { $ne: null },
      userId: { $ne: userId }
    });

    // Likes RECEIVED on Comments
    const commentLikesAgg = await Comment.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$likeCount" }}}
    ]);
    const commentLikesReceived = commentLikesAgg[0]?.total || 0;

    // Shares (if exists)
    // NOTE: Add this only if post schema has shareCount
    const shareAgg = await Post.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$shareCount" }}}
    ]).catch(() => []);
    const totalShares = shareAgg[0]?.total || 0;

    return {
      followers,
      postsCreated,
      likesReceived,
      viewsReceived,
      commentsReceived,
      repliesReceived,
      commentLikesReceived,
      totalShares
    };

  } catch (err) {
    console.error("❌ Error calculating user performance metrics:", err);
    return {
      followers: 0,
      postsCreated: 0,
      likesReceived: 0,
      viewsReceived: 0,
      commentsReceived: 0,
      repliesReceived: 0,
      commentLikesReceived: 0,
      totalShares: 0
    };
  }
};
