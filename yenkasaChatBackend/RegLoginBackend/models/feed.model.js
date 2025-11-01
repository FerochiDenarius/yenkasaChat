// models/feed.model.js
const Post = require("./post.model");
const User = require("./user.model");

async function getCommunityFeed(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const user = await User.findById(userId).populate("community");
  if (!user) throw new Error("User not found");

  const communityId = user.community ? user.community._id : null;

  // ✅ Build flexible feed filter
  const filter = {
    isActive: true,
    isApproved: true, // ✅ Show only approved posts
    visibility: { $in: ["public", "followers"] },
  };

  // ✅ Temporary: Include posts without community (so new posts always show)
  if (communityId) {
    filter.$or = [
      { communityId: communityId },
      { communityId: { $exists: false } },
      { communityId: null },
    ];
  } else {
    // If user not in a community, show all active public posts
    filter.$or = [
      { communityId: { $exists: false } },
      { communityId: null },
    ];
  }

  const posts = await Post.find(filter)
    .populate("userId", "username profileImage verified")
    .populate("communityId", "name displayName")
    .sort({ isPinned: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalPosts = await Post.countDocuments(filter);

  const postsWithLikeStatus = posts.map((post) => ({
    ...post,
    likedByCurrentUser: post.likes?.some(
      (id) => id.toString() === userId.toString()
    ),
    likes: undefined, // hide raw likes array
  }));

  return {
    posts: postsWithLikeStatus,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
      hasMore: skip + posts.length < totalPosts,
    },
  };
}

module.exports = { getCommunityFeed };
