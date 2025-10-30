// models/feed.model.js
const Post = require("./post.model");
const User = require("./user.model");

/**
 * Fetches a paginated feed for a specific user.
 * Includes only posts from the user's community (no follower filter yet).
 */
async function getCommunityFeed(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  // Fetch user to identify their community
  const user = await User.findById(userId).populate("community");

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.community) {
    throw new Error("User is not part of any community");
  }

  // Query posts from that community
  const posts = await Post.find({
    communityId: user.community._id,
    isActive: true,
    visibility: { $in: ["public", "followers"] },
  })
    .populate("userId", "username profileImage verified")
    .populate("communityId", "name displayName")
    .sort({ isPinned: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalPosts = await Post.countDocuments({
    communityId: user.community._id,
    isActive: true,
  });

  // Add like flag
  const postsWithLikeStatus = posts.map((post) => ({
    ...post,
    likedByCurrentUser: post.likes.some(
      (id) => id.toString() === userId.toString()
    ),
    likes: undefined,
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
