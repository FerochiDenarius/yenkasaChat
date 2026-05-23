// routes/feed.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Post = require("../models/post.model");
const Community = require("../models/community.model");
const Follow = require("../models/follow.model");
const Ad = require("../models/Ad.model"); // ⭐ ADD THIS
const { getBlockedRelationshipUserIds } = require("../services/privacy.service");
const { getRankedFeed } = require("../services/feedRanking.service");

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

function normalizeFeedMode(value = "") {
  const mode = value.toString().trim().toLowerCase().replace(/\s+/g, "-");
  if (["following", "for-you", "trending", "top", "latest", "popular"].includes(mode)) {
    return mode;
  }
  return "for-you";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCommunityNames(value = "") {
  return value
    .toString()
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

async function communityIdsForNames(names, country) {
  if (!names.length) return null;

  const exactNameQueries = names.map((name) => {
    const exact = new RegExp(`^${escapeRegex(name)}$`, "i");
    return { $or: [{ displayName: exact }, { name: exact }] };
  });

  return Community.find({
    ...countryQuery(country),
    isActive: true,
    isApproved: true,
    $or: exactNameQueries
  }).distinct("_id");
}

async function allowedCountryCommunityIds(user) {
  return Community.find({
    ...countryQuery(user.country || "Ghana"),
    isActive: true,
    isApproved: true
  }).distinct("_id");
}

function userJoinedCommunityIds(user) {
  return [
    user.community,
    ...(user.joinedCommunities || [])
  ].filter(Boolean).map((id) => id.toString());
}

function intersectObjectIds(primary, secondary) {
  if (!Array.isArray(secondary)) return primary;
  const allowed = new Set(secondary.map((id) => id.toString()));
  return primary.filter((id) => allowed.has(id.toString()));
}

async function followingIdsForUser(userId) {
  const docs = await Follow.find({ follower: userId, status: "active" })
    .select("following")
    .lean();
  return docs.map((doc) => doc.following).filter(Boolean);
}

async function buildPostFilter(req, feedMode) {
  const blockedUserIds = await getBlockedRelationshipUserIds(req.user.id);
  const allowedCommunityIds = await allowedCountryCommunityIds(req.user);
  const selectedCommunityIds = await communityIdsForNames(
    parseCommunityNames(req.query.names || req.query.communities),
    req.user.country || "Ghana"
  );

  const postFilter = {
    isActive: true,
    status: "approved",
    userId: { $nin: blockedUserIds },
    communityId: { $in: selectedCommunityIds || allowedCommunityIds }
  };

  if (feedMode === "for-you") {
    const joinedIds = userJoinedCommunityIds(req.user);
    const scopedJoinedIds = selectedCommunityIds
      ? intersectObjectIds(joinedIds, selectedCommunityIds)
      : joinedIds;

    if (scopedJoinedIds.length) {
      postFilter.communityId = { $in: scopedJoinedIds };
    } else if (joinedIds.length) {
      postFilter.communityId = { $in: [] };
    } else {
      postFilter.communityId = { $in: selectedCommunityIds || allowedCommunityIds };
    }
  }

  if (feedMode === "following") {
    const followingIds = await followingIdsForUser(req.user.id);
    postFilter.userId = {
      $in: followingIds,
      $nin: blockedUserIds
    };
  }

  return postFilter;
}

async function fetchFeed(req, explicitMode) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = (page - 1) * limit;
  const feedMode = normalizeFeedMode(explicitMode || req.query.feedType || req.query.tab || req.query.sort);
  const postFilter = await buildPostFilter(req, feedMode);
  const viewerContext = {
    joinedCommunityIds: new Set(userJoinedCommunityIds(req.user).map((id) => id.toString())),
    followingIds: new Set(
      feedMode === "for-you" ? (await followingIdsForUser(req.user.id)).map((id) => id.toString()) : []
    )
  };

  console.log(`[feed] request mode=${feedMode} page=${page} limit=${limit}`);

  const { posts, totalPosts, rankingSummary } = await getRankedFeed({
    feedMode,
    postFilter,
    page,
    limit,
    viewerContext
  });
  const postsWithLikedState = attachLikedByUser(posts, req.user.id);

  const ads = await Ad.find({
    isActive: true,
    approvalStatus: "approved",
    adType: { $in: ["sponsor", "internal"] }
  })
    .sort({ createdAt: -1 })
    .limit(Math.ceil(posts.length / 6))
    .lean();

  const feed = [];
  let adIndex = 0;
  postsWithLikedState.forEach((post, index) => {
    feed.push(post);
    if ((index + 1) % 6 === 0 && ads[adIndex]) {
      feed.push({ __isAd: true, ad: ads[adIndex++] });
    }
  });

  while (adIndex < ads.length) {
    feed.push({ __isAd: true, ad: ads[adIndex++] });
  }

  console.log(
    `[feed] response mode=${feedMode} page=${page} total=${totalPosts} returned=${posts.length} top=${JSON.stringify(rankingSummary)}`
  );

  return {
    success: true,
    mode: feedMode,
    posts: postsWithLikedState,
    feed,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
      hasMore: skip + posts.length < totalPosts,
    },
  };
}

// -----------------------------------------------------
// ✅ FEED WITH MODE-SPECIFIC BACKEND LOGIC
// -----------------------------------------------------
router.get("/", auth, async (req, res) => {
  try {
    res.status(200).json(await fetchFeed(req));
  } catch (err) {
    console.error("❌ Error fetching feed:", err);
    res.status(500).json({ error: err.message || "Failed to fetch feed" });
  }
});

router.get("/:mode", auth, async (req, res) => {
  try {
    const feedMode = normalizeFeedMode(req.params.mode);
    if (feedMode !== req.params.mode) {
      return res.status(404).json({ error: "Unknown feed mode" });
    }
    res.status(200).json(await fetchFeed(req, feedMode));
  } catch (err) {
    console.error(`❌ Error fetching ${req.params.mode} feed:`, err);
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
