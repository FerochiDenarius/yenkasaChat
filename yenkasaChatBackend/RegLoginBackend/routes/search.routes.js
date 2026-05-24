const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const Community = require("../models/community.model");
const { attachAccurateViewCounts } = require("../utils/postViewCounts");
const { publishYmeEvent } = require("../src/yme/services/eventPublisher.service");

function cleanQuery(value) {
  return (value || "").toString().trim().slice(0, 80);
}

function regexFor(query) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

const PUBLIC_ROLE_NAMES = new Set([
  "verified_creator",
  "rising_star",
  "legend",
  "top_vendor",
  "business_account",
  "premium_seller",
  "campus_influencer",
  "brand_ambassador"
]);

function safePublicRoleName(user) {
  const roleName = String(user.roleName || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (PUBLIC_ROLE_NAMES.has(roleName)) return roleName;
  return user.verified ? "verified" : "user";
}

async function searchPosts(query, viewerId, limit = 12) {
  const regex = regexFor(query);
  const posts = await Post.find({
    isActive: true,
    status: "approved",
    $or: [
      { text: regex },
      { tags: regex },
      { communityName: regex }
    ]
  })
    .populate("userId", "username profileImage verified roleName")
    .populate("communityId", "name displayName")
    .sort({ viewCount: -1, likeCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  await attachAccurateViewCounts(posts);
  return posts.map((post) => ({
    ...post,
    likedByUser: Array.isArray(post.likes)
      ? post.likes.some((id) => id?.toString() === viewerId.toString())
      : false
  }));
}

async function searchUsers(query, limit = 12) {
  const regex = regexFor(query);
  return User.find({
    $or: [
      { username: regex },
      { bio: regex },
      { location: regex }
    ]
  })
    .select("username profileImage verified roleName bio followersCount followingCount")
    .sort({ verified: -1, createdAt: -1 })
    .limit(limit)
    .lean()
    .then((users) => users.map((user, index) => ({
      _id: user._id,
      username: user.username,
      profileImage: user.profileImage,
      verified: user.verified,
      roleName: safePublicRoleName(user),
      bio: user.bio || "",
      rank: index + 1,
      followersCount: Number(user.followersCount || 0),
      followingCount: Number(user.followingCount || 0)
    })));
}

async function searchCommunities(query, limit = 12) {
  const regex = regexFor(query);
  return Community.find({
    isActive: true,
    isApproved: true,
    $or: [
      { name: regex },
      { displayName: regex },
      { description: regex },
      { categories: regex },
      { city: regex },
      { town: regex },
      { state: regex }
    ]
  })
    .sort({ memberCount: -1, postCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

router.get("/", auth, async (req, res) => {
  try {
    const q = cleanQuery(req.query.q);
    if (q.length < 2) {
      return res.json({ success: true, query: q, posts: [], users: [], communities: [] });
    }

    const [posts, users, communities] = await Promise.all([
      searchPosts(q, req.user.id),
      searchUsers(q),
      searchCommunities(q)
    ]);

    console.log("[Search] query", {
      userId: req.user.id,
      q,
      posts: posts.length,
      users: users.length,
      communities: communities.length
    });

    publishYmeEvent({
      userId: req.user.id,
      sourceApp: "social_app",
      eventType: "search",
      query: q,
      payload: {
        postsCount: posts.length,
        usersCount: users.length,
        communitiesCount: communities.length,
        scope: "all",
      },
    });

    res.json({ success: true, query: q, posts, users, communities });
  } catch (err) {
    console.error("Search failed:", err);
    res.status(500).json({ success: false, message: "Search failed" });
  }
});

router.get("/posts", auth, async (req, res) => {
  try {
    const q = cleanQuery(req.query.q);
    const posts = q.length < 2 ? [] : await searchPosts(q, req.user.id);
    if (q.length >= 2) {
      publishYmeEvent({
        userId: req.user.id,
        sourceApp: "social_app",
        eventType: "search",
        query: q,
        payload: {
          postsCount: posts.length,
          scope: "posts",
        },
      });
    }
    res.json({ success: true, query: q, posts });
  } catch (err) {
    console.error("Post search failed:", err);
    res.status(500).json({ success: false, message: "Post search failed" });
  }
});

router.get("/users", auth, async (req, res) => {
  try {
    const q = cleanQuery(req.query.q);
    const users = q.length < 2 ? [] : await searchUsers(q);
    if (q.length >= 2) {
      publishYmeEvent({
        userId: req.user.id,
        sourceApp: "social_app",
        eventType: "search",
        query: q,
        payload: {
          usersCount: users.length,
          scope: "users",
        },
      });
    }
    res.json({ success: true, query: q, users });
  } catch (err) {
    console.error("User search failed:", err);
    res.status(500).json({ success: false, message: "User search failed" });
  }
});

router.get("/communities", auth, async (req, res) => {
  try {
    const q = cleanQuery(req.query.q);
    const communities = q.length < 2 ? [] : await searchCommunities(q);
    if (q.length >= 2) {
      publishYmeEvent({
        userId: req.user.id,
        sourceApp: "social_app",
        eventType: "search",
        query: q,
        payload: {
          communitiesCount: communities.length,
          scope: "communities",
        },
      });
    }
    res.json({ success: true, query: q, communities });
  } catch (err) {
    console.error("Community search failed:", err);
    res.status(500).json({ success: false, message: "Community search failed" });
  }
});

module.exports = router;
