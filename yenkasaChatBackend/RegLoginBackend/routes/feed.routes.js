// routes/feed.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Post = require("../models/post.model");
const UserPrivacy = require("../models/userPrivacy.model");
const Ad = require("../models/Ad.model"); // ⭐ ADD THIS
const { attachAccurateViewCounts } = require("../utils/postViewCounts");

/* ---------------------------------------------------
 * Helper: Get ALL users that viewer cannot see
 * --------------------------------------------------- */
async function getBlockedUserIds(viewerId) {
  const myPrivacy = await UserPrivacy.findOne({ userId: viewerId }).lean();
  
  const iBlocked = myPrivacy?.blockedUsers?.map(id => id.toString()) || [];

  const blockedMeDocs = await UserPrivacy.find({ blockedUsers: viewerId }).lean();
  const blockedMe = blockedMeDocs.map(doc => doc.userId.toString());

  return [...new Set([...iBlocked, ...blockedMe])];
}

// -----------------------------------------------------
// ✅ FEED WITH ADS MIXED IN
// -----------------------------------------------------
router.get("/", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // ===============================
    // 1️⃣ FETCH POSTS (same as before)
    // ===============================
    const posts = await Post.find({ isActive: true, status: "approved" })
      .populate("userId", "username profileImage verified roleName")
      .populate("communityId", "name displayName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    await attachAccurateViewCounts(posts);

    const totalPosts = await Post.countDocuments({
      isActive: true,
      status: "approved",
    });

    // ===============================
    // 2️⃣ FETCH ADS
    // ===============================
    const ads = await Ad.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(Math.ceil(posts.length / 6)) // 1 ad per 6 posts
      .lean();

    // ===============================
    // 3️⃣ MIX POSTS + ADS
    // ===============================
    let combined = [];
    let adIndex = 0;

    for (let i = 0; i < posts.length; i++) {
      combined.push(posts[i]);

      // Insert an ad every 6 posts
      if ((i + 1) % 6 === 0 && ads[adIndex]) {
        combined.push({
          __isAd: true,
          ad: ads[adIndex++],
        });
      }
    }

    // If more ads, append them
    while (adIndex < ads.length) {
      combined.push({
        __isAd: true,
        ad: ads[adIndex++],
      });
    }

    // ===============================
    // 4️⃣ SEND RESPONSE
    // ===============================
    res.status(200).json({
      feed: combined,
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


// -----------------------------------------------------
// Socket route (unchanged)
// -----------------------------------------------------
router.post("/notify-update", auth, async (req, res) => {
  try {
    const { action, postId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Missing action type" });
    }

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
