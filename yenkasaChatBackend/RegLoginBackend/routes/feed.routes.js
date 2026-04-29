// routes/feed.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Post = require("../models/post.model");
const Community = require("../models/community.model");
const UserPrivacy = require("../models/userPrivacy.model");
const Ad = require("../models/Ad.model"); // ⭐ ADD THIS
const { attachAccurateViewCounts } = require("../utils/postViewCounts");
const { getBlockedRelationshipUserIds } = require("../services/privacy.service");

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

function attachLikedByUser(posts, viewerId) {
  if (!viewerId) return posts;

  return posts.map((post) => ({
    ...post,
    likedByUser: Array.isArray(post.likes)
      ? post.likes.some((id) => id?.toString() === viewerId.toString())
      : false
  }));
}

function countryQuery(value) {
  const country = (value || "Ghana").toString().trim();
  return { country: new RegExp(`^${country}$`, "i") };
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
    const blockedUserIds = await getBlockedRelationshipUserIds(req.user.id);
    const allowedCommunityIds = await Community.find({
      ...countryQuery(req.user.country || "Ghana"),
      isActive: true,
      isApproved: true
    }).distinct("_id");

    const postFilter = {
      isActive: true,
      status: "approved",
      userId: { $nin: blockedUserIds },
      communityId: { $in: allowedCommunityIds }
    };

    const posts = await Post.find(postFilter)
      .populate("userId", "username profileImage verified roleName")
      .populate("communityId", "name displayName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    await attachAccurateViewCounts(posts);
    const postsWithLikedState = attachLikedByUser(posts, req.user.id);

    const totalPosts = await Post.countDocuments(postFilter);

    // ===============================
    // 2️⃣ FETCH ADS
    // ===============================
    const ads = await Ad.find({
      isActive: true,
      approvalStatus: "approved",
      adType: { $in: ["sponsor", "internal"] }
    })
      .sort({ createdAt: -1 })
      .limit(Math.ceil(posts.length / 6)) // 1 ad per 6 posts
      .lean();

    // ===============================
    // 3️⃣ MIX POSTS + ADS
    // ===============================
    let combined = [];
    let adIndex = 0;

    for (let i = 0; i < posts.length; i++) {
      combined.push(postsWithLikedState[i]);

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
