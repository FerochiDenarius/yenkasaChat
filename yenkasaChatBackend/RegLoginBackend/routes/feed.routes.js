// routes/feed.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Post = require("../models/post.model");
const UserPrivacy = require("../models/userPrivacy.model");

/* ---------------------------------------------------
 * Helper: Get ALL users that viewer cannot see
 * --------------------------------------------------- */
async function getBlockedUserIds(viewerId) {
  const myPrivacy = await UserPrivacy.findOne({ userId: viewerId }).lean();
  
  const iBlocked = myPrivacy?.blockedUsers?.map(id => id.toString()) || [];

  const blockedMeDocs = await UserPrivacy.find({ blockedUsers: viewerId }).lean();
  const blockedMe = blockedMeDocs.map(doc => doc.userId.toString());

  return [...new Set([...iBlocked, ...blockedMe])]; // merged unique
}


// ✅ Existing feed fetching logic (unchanged)
router.get("/", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isActive: true, status: "approved" })
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


// ✅ Socket trigger route — when a new post is created or updated
router.post("/notify-update", auth, async (req, res) => {
  try {
    const { action, postId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Missing action type" });
    }

    // Notify all connected clients to refresh feed
    if (global.io) {
      global.io.emit("feedUpdate", { action, postId });
      console.log(`📢 Feed update broadcasted: ${action} (post: ${postId})`);
    }

    res.status(200).json({ success: true, message: "Feed update emitted" });
  } catch (err) {
    console.error("❌ Error emitting feed update:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
