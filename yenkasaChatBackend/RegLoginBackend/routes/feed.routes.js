// routes/feed.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getCommunityFeed } = require("../models/feed.model");

// GET /api/feed
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const feedData = await getCommunityFeed(userId, page, limit);
    res.status(200).json(feedData);
  } catch (err) {
    console.error("❌ Error fetching community feed:", err);
    res.status(500).json({ error: err.message || "Failed to fetch feed" });
  }
});

module.exports = router;
