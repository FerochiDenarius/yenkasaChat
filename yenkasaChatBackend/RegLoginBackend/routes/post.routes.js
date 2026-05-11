// routes/post.routes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const Community = require('../models/community.model');
const { uploadFiles } = require('../utils/upload');
const authMiddleware = require('../middleware/auth');
const Permission = require('../models/permissions.model');
const PostApproval = require("../models/postapproval.model");
const { sendNotification } = require("../services/notification.service");
const { SYSTEM_USER_ID } = require('../config/system');
const { sendPushNotification } = require("../utils/onesignal");
const { logUploadAudit } = require("../utils/cloudinaryMedia");

// 🧩 import your centralized rewardService
const rewardService = require('../services/reward.service');

const UserPrivacy = require("../models/userPrivacy.model");
const { attachAccurateViewCounts } = require("../utils/postViewCounts");
const { getBlockedRelationshipUserIds } = require("../services/privacy.service");

function normalizeCountry(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function countryQuery(value) {
  const country = value || "Ghana";
  return { country: new RegExp(`^${country}$`, "i") };
}

function normalizePostFeedMode(value = "") {
  const mode = value.toString().trim().toLowerCase().replace(/\s+/g, "-");
  if (["following", "for-you", "trending", "top", "latest", "popular"].includes(mode)) {
    return mode;
  }
  return "latest";
}

function postFeedSort(mode) {
  if (mode === "latest" || mode === "following" || mode === "for-you") return { createdAt: -1 };
  if (mode === "popular" || mode === "top") {
    return { likeCount: -1, commentCount: -1, shareCount: -1, viewCount: -1, createdAt: -1 };
  }
  if (mode === "trending") {
    return { commentCount: -1, shareCount: -1, likeCount: -1, viewCount: -1, createdAt: -1 };
  }
  return { createdAt: -1 };
}

function normalizeTextBackgroundColor(value) {
  const color = (value || "").toString().trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color.toUpperCase() : "";
}

function attachLikedByUser(posts, viewerId) {
  if (!viewerId) return posts;

  const decorate = (post) => ({
    ...post,
    likedByUser: Array.isArray(post.likes)
      ? post.likes.some((id) => id?.toString() === viewerId.toString())
      : false
  });

  return Array.isArray(posts) ? posts.map(decorate) : decorate(posts);
}

/* ---------------------------------------------------
 * ONE-WAY BLOCK CHECK (Instagram style)
 * userA = viewer or actor
 * userB = owner of content
 * --------------------------------------------------- */
async function isBlocked(userA, userB) {
  const viewerPrivacy = await UserPrivacy.findOne({ userId: userA }).lean();
  if (viewerPrivacy?.blockedUsers?.includes(userB)) {
    return true;
  }

  const ownerPrivacy = await UserPrivacy.findOne({ userId: userB }).lean();
  if (ownerPrivacy?.blockedUsers?.includes(userA)) {
    return true;
  }

  return false;
}


/* ------------------------------------
 * 💰 REWARD CONFIGURATION
 * ------------------------------------ */
const REWARDS = { CREATE_POST: 20, GET_LIKE: 1, GET_COMMENT: 1 };

/* ------------------------------------
 * POSTING ACCESS CONFIGURATION
 * ------------------------------------ */
const UNVERIFIED_POST_LIMIT = 5;
const POST_WINDOW_HOURS = 48;

function getPostWindowStart() {
  return new Date(Date.now() - POST_WINDOW_HOURS * 60 * 60 * 1000);
}

function isDeveloperRole(role) {
  return ["developer", "junior_developer", "senior_developer"].includes(Permission.normalize(role));
}

function isAutoApprovedRole(role) {
  const normalized = Permission.normalize(role);
  return ["admin", "moderator"].includes(normalized) || isDeveloperRole(normalized);
}

async function getNormalizedUserRole(user) {
  const roleName = Permission.normalize(user.roleName || "");
  if (roleName && roleName !== "user") {
    return roleName;
  }

  if (user.role) {
    const roleDoc = await Permission.findById(user.role).lean().catch(() => null);
    if (roleDoc?.role) {
      return Permission.normalize(roleDoc.role);
    }

    const normalizedRole = Permission.normalize(user.role);
    if (normalizedRole && normalizedRole !== "user") {
      return normalizedRole;
    }
  }

  return roleName || "user";
}

/* ------------------------------------
 * ✍️ CREATE POST (Supports text, image, video, audio)
 * ------------------------------------ */
router.post('/', authMiddleware, uploadFiles(), async (req, res) => {
  try {
    const {
      text,
      tags,
      location,
      visibility,
      mentions,
      communityName,
      postType,
      textBackgroundColor
    } = req.body;

    const userId = req.user.userId || req.user.id;

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const normalizedRole = await getNormalizedUserRole(user);

    if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        error: "Your account is suspended and cannot create posts right now.",
        suspendedUntil: user.suspendedUntil
      });
    }

    const isAutoPublished = isAutoApprovedRole(normalizedRole);
    const isVerifiedUser = user.verified === true;
    const windowStart = getPostWindowStart();
    let recentPostsCount = 0;
    let remainingPosts = null;

    if (!communityName || communityName.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Community selection is required to create a post."
      });
    }

    const selectedCommunity = await Community.findOne({
      $or: [
        { name: communityName.trim() },
        { displayName: communityName.trim() }
      ]
    });

    if (!selectedCommunity) {
      return res.status(404).json({
        success: false,
        error: "Selected community not found"
      });
    }

    if (normalizeCountry(selectedCommunity.country) !== normalizeCountry(user.country)) {
      return res.status(403).json({
        success: false,
        error: `Selected community is not available for ${user.country || "your country"}.`
      });
    }

    if (!isAutoPublished && !isVerifiedUser) {
      recentPostsCount = await Post.countDocuments({
        userId: user._id,
        createdAt: { $gte: windowStart }
      });

      if (recentPostsCount >= UNVERIFIED_POST_LIMIT) {
        return res.status(429).json({
          success: false,
          code: "POST_LIMIT_REACHED",
          error: `Unverified users can only create ${UNVERIFIED_POST_LIMIT} posts within ${POST_WINDOW_HOURS} hours.`,
          postingAccess: {
            verified: false,
            privileged: false,
            postWindowHours: POST_WINDOW_HOURS,
            postingLimit: UNVERIFIED_POST_LIMIT,
            postsUsed: recentPostsCount,
            remainingPosts: 0,
            requiresReview: true
          }
        });
      }

      remainingPosts = UNVERIFIED_POST_LIMIT - (recentPostsCount + 1);
    }

    let imageUrl = '';
    let imageUrls = [];
    let videoUrl = '';
    let audioUrl = '';
    let detectedPostType = postType || 'text';

    const folder = "yenkasachat/posts";
    const imageFiles = req.files?.imageUrl || [];
    const legacyMediaFile = req.files?.media?.[0];
    const videoFile = req.files?.videoUrl?.[0] ||
      (legacyMediaFile?.mimetype?.startsWith("video") ? legacyMediaFile : null);
    const audioFile = req.files?.audioUrl?.[0] ||
      (legacyMediaFile?.mimetype?.startsWith("audio") ? legacyMediaFile : null);
    const legacyImageFile = !videoFile && !audioFile && legacyMediaFile?.mimetype?.startsWith("image")
      ? legacyMediaFile
      : null;
    const uploadImageFiles = imageFiles.length > 0 ? imageFiles : (legacyImageFile ? [legacyImageFile] : []);

    if (uploadImageFiles.length > 0) {
      const uploadResults = await Promise.all(uploadImageFiles.map((file) =>
        cloudinary.uploader.upload(file.path, {
          folder,
          resource_type: "image",
          quality: "auto:good",
          fetch_format: "auto"
        })
      ));
      uploadResults.forEach((result, index) => logUploadAudit({
        area: "post_image",
        file: uploadImageFiles[index],
        result
      }));

      imageUrls = uploadResults.map((result) => result.secure_url).filter(Boolean);
      imageUrl = imageUrls[0] || "";
      detectedPostType = "image";
    } else if (videoFile || audioFile) {
      const file = videoFile || audioFile;
      const isVideo = !!videoFile;
      const uploadRes = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: isVideo ? "video" : "video",
        quality: "auto:good",
        fetch_format: "auto"
      });
      logUploadAudit({ area: isVideo ? "post_video" : "post_audio", file, result: uploadRes });

      if (isVideo) {
        videoUrl = uploadRes.secure_url;
        detectedPostType = "video";
      } else {
        audioUrl = uploadRes.secure_url;
        detectedPostType = "audio";
      }
    }

    const postStatus = isAutoPublished ? "approved" : "pending";
    const hasUploadedMedia = imageUrls.length > 0 || videoUrl || audioUrl;
    const textOnlyBackgroundColor = !hasUploadedMedia && text?.trim()
      ? normalizeTextBackgroundColor(textBackgroundColor)
      : "";

    const post = await Post.create({
      userId,
      communityId: selectedCommunity._id,
      text: text?.trim() || "",
      textBackgroundColor: textOnlyBackgroundColor,
      imageUrl,
      imageUrls,
      videoUrl,
      audioUrl,
      postType: detectedPostType,
      tags: tags || [],
      mentions: mentions || [],
      location: location || "",
      visibility: visibility || "public",
      communityName: selectedCommunity.displayName || selectedCommunity.name,
      status: postStatus
    });

    /* ------------------------------------
     * PENDING POST → APPROVAL WORKFLOW
     * ------------------------------------ */
    if (!isAutoPublished) {

      await PostApproval.create({
        post: post._id,
        user: userId,
        caption: post.text,
        textBackgroundColor: post.textBackgroundColor,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls || [],
        videoUrl: post.videoUrl,
        audioUrl: post.audioUrl,
        submittedAt: new Date(),
        status: "pending"
      });

      // 🔔 Notify creator their post is pending review
      await sendNotification({
        type: "post_under_review",
        senderId: SYSTEM_USER_ID,
        receiverId: userId,
        activityId: post._id.toString(),
        targetType: "post",
        targetId: post._id.toString(),
        message: "Your post is under review and will be approved shortly."
      });

      // Load approvers ONCE
      const approvers = await User.find({
        roleName: { $in: ["admin", "moderator", "senior_developer", "junior_developer"] }
      }).select("_id playerId username");

      // 🔔 Notify approvers — ONLY ONE LOOP
      for (const mod of approvers) {

        await sendNotification({
          type: "post_pending",
          senderId: userId,
          receiverId: mod._id,
          activityId: post._id.toString(),   // ✔ VALID postId
          targetType: "post",                // ✔ Android navigation
          targetId: post._id.toString(),
          message: "A new post is awaiting approval."
        });

        if (mod.playerId) {
          await sendPushNotification({
            playerId: mod.playerId,
            title: "Pending Post",
            body: "A new post requires your approval.",
            data: {
              type: "post_pending",
              targetType: "post",
              targetId: post._id.toString(),
              activityId: post._id.toString(),
              postId: post._id.toString()
            }
          });
        }
      }
    }

    /* ------------------------------------
     * APPROVED POST → REWARDS + FEED SOCKET
     * ------------------------------------ */
    if (postStatus === "approved") {
      await rewardService.reward(userId, REWARDS.CREATE_POST, {
        type: 'REWARD_POST',
        description: `Earned ${REWARDS.CREATE_POST} YKC for creating a post`,
        relatedPostId: post._id,
        activityId: `create_post_${post._id}_${userId}`,
      });

      if (global.io) {
        global.io.emit("feedUpdate", {
          action: "new_post",
          postId: post._id,
          userId,
          community: post.communityName,
          timestamp: new Date(),
        });
      }
    }

    /* ------------------------------------
     * FINAL RESPONSE
     * ------------------------------------ */
    res.status(201).json({
      success: true,
      post,
      message: postStatus === "approved"
        ? "Post published successfully."
        : "Post submitted for approval.",
      postingAccess: {
        verified: isVerifiedUser,
        privileged: isAutoPublished,
        postWindowHours: POST_WINDOW_HOURS,
        postingLimit: isAutoPublished || isVerifiedUser ? null : UNVERIFIED_POST_LIMIT,
        postsUsed: isAutoPublished || isVerifiedUser ? null : recentPostsCount + 1,
        remainingPosts: isAutoPublished || isVerifiedUser ? null : remainingPosts,
        requiresReview: !isAutoPublished
      }
    });

  } catch (err) {
    console.error("❌ Failed to create post:", err);
    res.status(500).json({ error: "Failed to create post", details: err.message });
  }
});


/* 👤 MY POSTS - must stay before /:postId so "my" is not treated as an ObjectId */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({
      userId: req.user.id,
      isActive: true,
      status: 'approved'
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profileImage verified roleName')
      .populate('communityId', 'name displayName')
      .lean();

    await attachAccurateViewCounts(posts);
    res.json(attachLikedByUser(posts, req.user.id));
  } catch (err) {
    console.error('❌ Failed to fetch my posts:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/* 👤 USER POSTS (with ONE-WAY block enforcement) */
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;        // profile owner
    const viewerId = req.user.id;         // person viewing the profile

    // Load privacy records
    const viewerPrivacy = await UserPrivacy.findOne({ userId: viewerId }).lean();
    const ownerPrivacy = await UserPrivacy.findOne({ userId }).lean();

    // If viewer BLOCKED owner → viewer cannot view their posts
    if (viewerPrivacy?.blockedUsers?.includes(userId)) {
      return res.status(403).json({ error: "You cannot view this user's posts (blocked)." });
    }

    // If owner BLOCKED viewer → viewer cannot view their posts
    if (ownerPrivacy?.blockedUsers?.includes(viewerId)) {
      return res.status(403).json({ error: "You cannot view this user's posts (you are blocked)." });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ userId, isActive: true, status: 'approved' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified roleName')
      .populate('communityId', 'name displayName')
      .lean();

    await attachAccurateViewCounts(posts);
    const postsWithLikedState = attachLikedByUser(posts, viewerId);

    const totalPosts = await Post.countDocuments({ userId, isActive: true, status: 'approved' });

    res.json({
      posts: postsWithLikedState,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts
      }
    });

  } catch (err) {
    console.error('❌ Failed to fetch user posts:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});


/* ------------------------------------
 * 🧩 GET POSTS FROM MULTIPLE COMMUNITIES
 * Filters by BOTH communityId AND communityName
 * ------------------------------------ */
router.get('/by-communities', authMiddleware, async (req, res) => {
  let { names, page = 1, limit = 20 } = req.query;

  if (!names) {
    return res.status(400).json({ error: "No community names provided" });
  }

  const communityNames = names.split(",").map(name => name.trim()).filter(Boolean);
  const allowedCommunities = await Community.find({
    ...countryQuery(req.user.country || "Ghana"),
    isActive: true,
    isApproved: true,
    $or: [
      { name: { $in: communityNames } },
      { displayName: { $in: communityNames } }
    ]
  }).select("_id name displayName").lean();

  const allowedCommunityIds = allowedCommunities.map(community => community._id);
  const allowedCommunityNames = allowedCommunities.flatMap(community => [
    community.name,
    community.displayName
  ]).filter(Boolean);

  if (allowedCommunityIds.length === 0) {
    return res.json({
      success: true,
      posts: [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: 0,
        totalPosts: 0,
        hasMore: false
      }
    });
  }

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;
  const blockedUserIds = await getBlockedRelationshipUserIds(req.user.id);

  const filter = {
    isActive: true,
    status: "approved",
    userId: { $nin: blockedUserIds },
    $or: [
      { communityId: { $in: allowedCommunityIds } },
      { communityName: { $in: allowedCommunityNames } }
    ]
  };

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "username profileImage verified roleName")
    .populate("communityId", "name displayName")  // ✅ FIXED: populate communityId object
    .lean();

  await attachAccurateViewCounts(posts);
  const postsWithLikedState = attachLikedByUser(posts, req.user.id);

  const totalPosts = await Post.countDocuments(filter);

  res.json({
    success: true,
    posts: postsWithLikedState,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
      hasMore: skip + posts.length < totalPosts
    }
  });
});

/* 🧩 GET POSTS BY COMMUNITY (with ONE-WAY block enforcement) */
router.get('/community/:communityId', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const viewerId = req.user.id;

    const { page = 1, limit = 20 } = req.query;
    const feedMode = normalizePostFeedMode(req.query.feedType || req.query.tab || req.query.sort);
    const skip = (page - 1) * limit;

    // Verify community exists
    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    // Load privacy
    const viewerPrivacy = await UserPrivacy.findOne({ userId: viewerId }).lean();

    const iBlocked = viewerPrivacy?.blockedUsers?.map(id => id.toString()) || [];

    const blockedMeDocs = await UserPrivacy.find({ blockedUsers: viewerId }).lean();
    const blockedMe = blockedMeDocs.map(doc => doc.userId.toString());

    // People the viewer cannot see
    const blockedUserIds = [...new Set([...iBlocked, ...blockedMe])];

    // Find posts for this community EXCEPT blocked users
    const posts = await Post.find({
      communityId,
      isActive: true,
      status: 'approved',
      userId: { $nin: blockedUserIds } // 🔥 BLOCK ENFORCEMENT HERE
    })
      .sort(postFeedSort(feedMode))
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified roleName')
      .populate('communityId', 'name displayName')
      .lean();

    await attachAccurateViewCounts(posts);
    const postsWithLikedState = attachLikedByUser(posts, viewerId);

    const totalPosts = await Post.countDocuments({
      communityId,
      isActive: true,
      status: 'approved',
      userId: { $nin: blockedUserIds } // 🔥 Ensure pagination matches
    });

    res.json({
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
      },
      posts: postsWithLikedState,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts
      }
    });

  } catch (err) {
    console.error('❌ Failed to fetch community posts:', err);
    res.status(500).json({ error: 'Failed to fetch community posts' });
  }
});


router.get('/community-name/:name', authMiddleware, async (req, res) => {
  try {
    const { name } = req.params;
    const community = await Community.findOne({
      $or: [{ name }, { displayName: name }]
    });
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const posts = await Post.find({
      communityId: community._id,
      isActive: true,
      status: 'approved'
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profileImage verified roleName')
      .populate('communityId', 'name displayName')
      .lean();

    await attachAccurateViewCounts(posts);
    const postsWithLikedState = attachLikedByUser(posts, req.user.id);

    res.json({ community, posts: postsWithLikedState });
  } catch (err) {
    console.error("❌ Error fetching posts by community name:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------------------
 * 🧩 GET SINGLE POST BY ID (for comments screen, deep links)
 * ------------------------------------ */
router.get("/:postId", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = await Post.findOne({
      _id: postId,
      isActive: true,
      status: "approved"
    })
      .populate("userId", "username profileImage verified roleName")
      .populate("communityId", "name displayName")
      .lean();

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    await attachAccurateViewCounts(post);
    const postWithLikedState = attachLikedByUser(post, viewerId);

    // 🔒 One-way block enforcement (same logic as feed)
    const blocked = await isBlocked(viewerId, post.userId._id.toString());
    if (blocked) {
      return res.status(403).json({ error: "You cannot view this post" });
    }

    res.json(postWithLikedState);

  } catch (err) {
    console.error("❌ Failed to fetch post by ID:", err);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// -----------------------------------------------
// DELETE POST (OWNER ONLY)
// -----------------------------------------------
router.delete("/:postId", authMiddleware, async (req, res) => {

  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // Only the owner can delete
    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized to delete this post" });
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: "Post deleted successfully",
      postId
    });
  } catch (err) {
    console.error("❌ Delete post error:", err);
    res.status(500).json({ success: false, error: "Failed to delete post" });
  }
});


// -----------------------------------------------
// HIDE POST (User hides from their feed)
// -----------------------------------------------
// NOTE: This does NOT delete the post. Just hides for this user.
router.post("/:postId/hide", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const userId = req.user.id;

    // Save hidden posts inside user's hidden list (you must add hiddenPosts: [] inside User schema)
    const User = require("../models/user.model");

    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { hiddenPosts: postId } },
      { new: true }
    );

    res.json({
      success: true,
      message: "Post hidden successfully"
    });

  } catch (err) {
    console.error("❌ Hide post error:", err);
    res.status(500).json({ success: false, error: "Failed to hide post" });
  }
});

// -----------------------------------------------
// SHARE POST (record a real share before opening OS share sheet)
// -----------------------------------------------
router.post("/:postId/share", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId).select("userId shareCount");
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const ownerId = post.userId.toString();
    if (await isBlocked(userId, ownerId)) {
      return res.status(403).json({ success: false, message: "Action blocked by privacy settings" });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { shareCount: 1 } },
      { new: true, select: "_id shareCount userId" }
    ).lean();

    try {
      const AppVerification = require("../models/appverification.model");
      let appVerification = await AppVerification.findOne({ userId: ownerId });
      if (!appVerification) {
        appVerification = new AppVerification({ userId: ownerId });
      }
      appVerification.metrics.totalShares = Number(appVerification.metrics.totalShares || 0) + 1;
      await appVerification.save();
    } catch (metricErr) {
      console.error("⚠️ Failed to update share verification metric:", metricErr.message);
    }

    if (global.io) {
      global.io.emit("feedUpdate", {
        type: "post_shared",
        postId,
        shareCount: updatedPost?.shareCount || 0,
        userId,
        timestamp: new Date()
      });
    }

    return res.json({
      success: true,
      message: "Share recorded",
      shareCount: updatedPost?.shareCount || 0
    });
  } catch (err) {
    console.error("❌ Share tracking failed:", err);
    res.status(500).json({ success: false, error: "Failed to record share" });
  }
});


// -----------------------------------------------
// DOWNLOAD MEDIA (just returns the media URL)
// -----------------------------------------------
router.get("/:postId/download", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    res.json({
      success: true,
      media: {
        imageUrl: post.imageUrl || null,
        imageUrls: post.imageUrls || [],
        videoUrl: post.videoUrl || null,
        audioUrl: post.audioUrl || null
      }
    });

  } catch (err) {
    console.error("❌ Download media error:", err);
    res.status(500).json({ success: false, error: "Failed to get media" });
  }
});


// -----------------------------------------------
// FLAG / REPORT POST
// -----------------------------------------------
const ModerationItem = require("../models/ModerationItem.model");

router.post("/:postId/flag", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Create moderation queue item
    await ModerationItem.create({
      type: "post_report",
      targetPostId: postId,
      targetUserId: post.userId,
      reportedBy: req.user.id,
      reason: reason || "inappropriate"
    });

    res.json({
      success: true,
      message: "Post flagged and sent for moderation review"
    });

  } catch (err) {
    console.error("❌ Flag post error:", err);
    res.status(500).json({ error: "Failed to flag post" });
  }
});

const { hasMinimumRole } = require("../utils/authority");

router.delete("/moderation/post/:postId", authMiddleware, async (req, res) => {
  const role = req.user;

  if (!hasMinimumRole(role, "admin")) {
    return res.status(403).json({ error: "Insufficient privileges" });
  }

  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  await post.deleteOne();

  res.json({ success: true, message: "Post deleted by moderator action" });
});





module.exports = router;
