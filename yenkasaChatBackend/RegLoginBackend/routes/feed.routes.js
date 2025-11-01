// routes/feed.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getCommunityFeed } = require("../models/feed.model");

// GET /api/feed
router.get("/", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const posts = await require("../models/post.model")
      .find()
      .populate("user", "username profileImage")
      .populate("community", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({ posts });
  } catch (err) {
    console.error("❌ Error fetching feed:", err);
    res.status(500).json({ error: err.message || "Failed to fetch feed" });
  }
});


module.exports = router;
