// models/feed.model.js
const Post = require("./post.model");
const User = require("./user.model");

async function getCommunityFeed(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  // fetch user and their community (if any)
  const user = await User.findById(userId).populate("community");
  if (!user) throw new Error("User not found");

  const communityId = user.community ? user.community._id : null;

  // Build flexible approval check:
  // - Support legacy boolean `isApproved`
  // - Support string `status: "approved"`
  const approvalClause = { $or: [{ isApproved: true }, { status: "approved" }] };

  // Build base filter
  const filter = {
    isActive: true,
    visibility: { $in: ["public", "followers"] },
    // include posts that are either explicitly approved or flagged approved by status
    ...approvalClause,
  };

  // Include community-based logic but allow posts without a community
  if (communityId) {
    filter.$or = [
      { communityId: communityId },
      { communityId: { $exists: false } },
      { communityId: null },
    ];
  } else {
    filter.$or = [
      { communityId: { $exists: false } },
      { communityId: null },
    ];
  }

  // DEBUG logs to trace what we are querying
  console.log("📡 getCommunityFeed called");
  console.log(" - userId:", userId);
  console.log(" - user.community:", user.community ? user.community._id : null);
  console.log(" - page, limit, skip:", page, limit, skip);
  console.log(" - mongo filter:", JSON.stringify(filter));

  // Query posts
  const posts = await Post.find(filter)
    .populate("userId", "username profileImage verified roleName")
    .populate("communityId", "name displayName")
    .sort({ isPinned: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // DEBUG: show what we found
  console.log(` 🔎 Found ${posts.length} posts (page ${page}).`);
  if (posts.length > 0) {
    console.log(" - post ids:", posts.map((p) => p._id));
    // show a sample post (trim large fields)
    const sample = posts[0];
    console.log(" - sample post summary:", {
      _id: sample._id,
      communityId: sample.communityId,
      status: sample.status,
      isApproved: sample.isApproved,
      visibility: sample.visibility,
      createdAt: sample.createdAt,
    });
  }

  // Use the same filter for total count
  const totalPosts = await Post.countDocuments(filter);
  console.log(" - totalPosts matching filter:", totalPosts);

  // Add likedByCurrentUser and remove raw likes array before returning
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
