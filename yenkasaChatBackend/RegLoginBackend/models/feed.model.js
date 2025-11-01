const Post = require("./post.model");
const User = require("./user.model");

async function getCommunityFeed(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const user = await User.findById(userId).populate("community");
  if (!user) throw new Error("User not found");

  const communityId = user.community ? user.community._id : null;

  // ✅ Build dynamic filter
  const filter = {
    isActive: true,
    isApproved: true, // ✅ Only show approved posts
    visibility: { $in: ["public", "followers"] },
  };

  // ✅ If user is in a community, show its posts; else show all approved public posts
  if (communityId) {
    filter.$or = [
      { communityId: communityId },
      { communityId: { $exists: false } }, // in case of posts without community
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
