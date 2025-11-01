// routes/feed.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getCommunityFeed } = require("../models/feed.model");

// GET /api/feed
// ✅ Updated Feed Route — matches Android FeedResponse model
// ✅ Corrected Feed Route — fixes populate() path error
router.get("/", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const Post = require("../models/post.model");

    const posts = await Post.find({ isActive: true, status: "approved" })
      // ❗ Use userId and communityId — not user or community
      .populate("userId", "username profileImage verified")
      .populate("communityId", "name displayName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({
      isActive: true,
      status: "approved",
    });

    res.status(200).json({
      posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching feed:", err);
    res.status(500).json({ error: err.message || "Failed to fetch feed" });
  }
});


module.exports = router;
