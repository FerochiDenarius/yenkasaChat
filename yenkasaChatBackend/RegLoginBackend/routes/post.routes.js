// routes/post.routes.js
const express = require('express');
const router = express.Router();
const { v2: cloudinary } = require('cloudinary');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const Community = require('../models/community.model');
const { uploadFiles } = require('../utils/upload');
const authMiddleware = require('../middleware/auth');
const Permission = require('../models/permissions.model');
const PostApproval = require("../models/postapproval.model");
const { sendNotification } = require("../services/notification.service");



// 🧩 import your centralized rewardService
const rewardService = require('../services/reward.service');

/* ------------------------------------
 * 💰 REWARD CONFIGURATION
 * ------------------------------------ */
const REWARDS = { CREATE_POST: 10, GET_LIKE: 2, GET_COMMENT: 3 };
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
      postType
    } = req.body;

    const userId = req.user.userId || req.user.id;

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Required for validation
    const normalizedRole = Permission.normalize(user.roleName || user.role);

    // Permission check (only verified+ can post)
    if (!Permission.canPost(normalizedRole, user.verified)) {
      return res.status(403).json({ error: "You do not have permission to create posts." });
    }

    // Initialize media fields
    let imageUrl = '';
    let videoUrl = '';
    let audioUrl = '';
    let detectedPostType = postType || 'text';

    /* Handle media upload */
    let file;
    if (req.files.media) file = req.files.media[0];
    else if (req.files.videoUrl) file = req.files.videoUrl[0];
    else if (req.files.audioUrl) file = req.files.audioUrl[0];
    else if (req.files.imageUrl) file = req.files.imageUrl[0];

    if (file) {
      const folder = "yenkasachat/posts";
      const mime = file.mimetype;

      const isVideo = mime.startsWith("video");
      const isAudio = mime.startsWith("audio");

      const resourceType = isVideo || isAudio ? "video" : "image";

      const uploadRes = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: resourceType
      });

      if (isVideo) {
        videoUrl = uploadRes.secure_url;
        detectedPostType = "video";
      } else if (isAudio) {
        audioUrl = uploadRes.secure_url;
        detectedPostType = "audio";
      } else {
        imageUrl = uploadRes.secure_url;
        detectedPostType = "image";
      }
    }

    /* Find community */
    if (!communityName || communityName.trim() === "") {
      return res.status(400).json({ error: "Community selection is required to create a post." });
    }

    const selectedCommunity = await Community.findOne({
      $or: [
        { name: communityName.trim() },
        { displayName: communityName.trim() }
      ]
    });

    if (!selectedCommunity) {
      return res.status(404).json({ error: "Selected community not found" });
    }

    /* Determine post status */
    const isPrivileged = Permission.canApprove(normalizedRole);
    const postStatus = isPrivileged ? "approved" : "pending";

    /* Create post */
    const post = await Post.create({
      userId,
      communityId: selectedCommunity._id,
      text: text?.trim() || "",
      imageUrl,
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

/* If PENDING → add to PostApproval queue */
if (!isPrivileged) {
  await PostApproval.create({
    post: post._id,
    user: userId,
    submittedAt: new Date(),
    status: "pending"
  });

  // Notify creator their post is pending review
  await sendNotification({
    type: "post_under_review",
    senderId: "system",
    receiverId: userId,
    activityId: `post_pending_${post._id}`,
    message: "Your post is under review and will be approved shortly."
  });

  // Notify all approvers
  const approvers = await User.find({
    roleName: { $in: ["admin", "moderator", "senior_developer", "junior_developer"] }
  }).select("_id oneSignalPlayerId username");

  for (const mod of approvers) {
    await sendNotification({
      type: "post_pending",
      senderId: userId,
      receiverId: mod._id,
      activityId: `pending_${post._id}`,
      message: "A new post is awaiting approval."
    });

    if (mod.oneSignalPlayerId) {
      const payload = {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [mod.oneSignalPlayerId],
        headings: { en: "Pending Post" },
        contents: { en: "A new post requires your approval." },
        data: { postId: post._id }
      };

      await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${process.env.ONESIGNAL_KEY}`
        },
        body: JSON.stringify(payload)
      });
    }
  }
}


const approvers = await User.find({
  roleName: { $in: ["admin", "moderator", "senior_developer", "junior_developer"] }
}).select("_id oneSignalPlayerId username");

for (const mod of approvers) {
  await sendNotification({
    type: "post_pending",
    senderId: userId,
    receiverId: mod._id,
    activityId: `pending_${post._id}`,
    message: "A new post is awaiting approval."
  });

  // Push To OneSignal
  if (mod.oneSignalPlayerId) {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${process.env.ONESIGNAL_KEY}`
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [mod.oneSignalPlayerId],
        headings: { en: "Pending Post" },
        contents: { en: "A new post requires your approval." },
        data: { postId: post._id }
      })
    });
  }
}


    /* Reward ONLY approved posts */
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

    /* Respond with created post */
    res.status(201).json({ success: true, post });

  } catch (err) {
    console.error("❌ Failed to create post:", err);
    res.status(500).json({ error: "Failed to create post", details: err.message });
  }
});

/* 👤 USER POSTS */
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ userId, isActive: true, status: 'approved' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .populate('communityId', 'name displayName')
      .lean();

    const totalPosts = await Post.countDocuments({ userId, isActive: true, status: 'approved' });

    res.json({
      posts,
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

  const communityNames = names.split(",");

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  const filter = {
    isActive: true,
    status: "approved",
    communityName: { $in: communityNames }
  };

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", "username profileImage verified")
    .populate("communityId", "name displayName")  // ✅ FIXED: populate communityId object
    .lean();

  const totalPosts = await Post.countDocuments(filter);

  res.json({
    success: true,
    posts,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts,
      hasMore: skip + posts.length < totalPosts
    }
  });
});


/* 🧩 GET POSTS BY COMMUNITY */
router.get('/community/:communityId', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Verify community exists
    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    // Find posts for this community
    const posts = await Post.find({
      communityId,
      isActive: true,
      status: 'approved'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username profileImage verified')
      .populate('communityId', 'name displayName')
      .lean();

    const totalPosts = await Post.countDocuments({
      communityId,
      isActive: true,
      status: 'approved'
    });

    res.json({
      community: {
        id: community._id,
        name: community.name,
        displayName: community.displayName,
      },
      posts,
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
      .populate('userId', 'username profileImage verified')
      .populate('communityId', 'name displayName');

    res.json({ community, posts });
  } catch (err) {
    console.error("❌ Error fetching posts by community name:", err);
    res.status(500).json({ error: 'Server error' });
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
router.post("/:postId/flag", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // save inside post document
    if (!post.flags) post.flags = [];

    post.flags.push({
      user: req.user.id,
      reason: reason || "inappropriate",
      createdAt: new Date()
    });

    await post.save();

    res.json({
      success: true,
      message: "Post flagged and sent to admins",
    });

  } catch (err) {
    console.error("❌ Flag post error:", err);
    res.status(500).json({ success: false, error: "Failed to flag post" });
  }
});




module.exports = router;
