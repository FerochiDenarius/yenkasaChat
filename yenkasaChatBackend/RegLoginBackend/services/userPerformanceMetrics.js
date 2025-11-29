// services/userPerformanceMetrics.js
const Post = require('../models/post.model');
const Comment = require('../models/comment.model');
const Follow = require('../models/follow.model');
const View = require('../models/view.model');

module.exports.getUserPerformanceMetrics = async function(userId) {
  try {
    // 1️⃣ Followers Count
    const followers = await Follow.getFollowersCount(userId);

    // 2️⃣ Posts Created
    const postsCreated = await Post.countDocuments({ userId });

    // 3️⃣ Likes Received on Posts
    const likesAgg = await Post.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$likeCount" }}}
    ]);
    const likesReceived = likesAgg[0]?.total || 0;

    // 4️⃣ Views Received on Posts
    const viewsAgg = await View.aggregate([
      { $match: { userId } }, // viewer ID is userId
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

    // 5️⃣ Comments Received on User’s Posts
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

    // 6️⃣ Replies Received (comments on comments)
    const repliesReceived = await Comment.countDocuments({
      parentCommentId: { $ne: null },
      userId: { $ne: userId }  // replies from other users
    });

    return {
      followers,
      postsCreated,
      likesReceived,
      viewsReceived,
      commentsReceived,
      repliesReceived
    };

  } catch (err) {
    console.error("❌ Error calculating user performance metrics:", err);
    return {
      followers: 0,
      postsCreated: 0,
      likesReceived: 0,
      viewsReceived: 0,
      commentsReceived: 0,
      repliesReceived: 0
    };
  }
};
