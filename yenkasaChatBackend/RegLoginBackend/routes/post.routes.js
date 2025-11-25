// routes/post.routes.js
const express = require('express');
const router = express.Router();
const { v2: cloudinary } = require('cloudinary');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const Community = require('../models/community.model');
const upload = require("../utils/upload");
const authMiddleware = require('../middleware/auth');
const Permission = require('../models/permissions.model');

// 🧩 import your centralized rewardService
const rewardService = require('../services/reward.service');

/* ------------------------------------
 * 💰 REWARD CONFIGURATION
 * ------------------------------------ */
const REWARDS = { CREATE_POST: 10, GET_LIKE: 2, GET_COMMENT: 3 };

/* ------------------------------------
 * ✍️ CREATE POST (Supports text, image, video, audio)
 * ------------------------------------ */
router.post('/', authMiddleware, upload(), async (req, res) => {
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
const user = await User.findById(userId).populate('role');
if (!user) return res.status(404).json({ error: 'User not found' });


    // Initialize post fields
    let imageUrl = '';
    let videoUrl = '';
    let audioUrl = '';
    let detectedPostType = postType || 'text';

    /* ✅ Handle media upload */
    let file;
    if (req.files.media) file = req.files.media[0];
    else if (req.files.videoUrl) file = req.files.videoUrl[0];
    else if (req.files.audioUrl) file = req.files.audioUrl[0];
    else if (req.files.imageUrl) file = req.files.imageUrl[0];

    if (file) {
      const folder = "yenkasachat/posts";
      const mime = file.mimetype;
      const isVideo = mime.startsWith('video');
      const isAudio = mime.startsWith('audio');
      const resourceType = isVideo || isAudio ? 'video' : 'image';

      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: resourceType,
      });

      if (isVideo) {
        videoUrl = uploadResult.secure_url;
        detectedPostType = 'video';
      } else if (isAudio) {
        audioUrl = uploadResult.secure_url;
        detectedPostType = 'audio';
      } else {
        imageUrl = uploadResult.secure_url;
        detectedPostType = 'image';
      }
    }

    /* ✅ Find community (if provided) */
  /* ✅ Ensure a community is selected */
/* ✅ Find community (if provided) */
let selectedCommunity = null;
if (communityName && communityName.trim() !== "") {
  selectedCommunity = await Community.findOne({
    $or: [
      { name: communityName.trim() },
      { displayName: communityName.trim() }
    ]
  });
}

/* ✅ Ensure a community is selected *****/
if (!communityName || communityName.trim() === "") {
  return res.status(400).json({ error: "Community selection is required to create a post." });
}

/* ✅ Validate that community actually exists */
if (!selectedCommunity) {
  return res.status(404).json({ error: "Selected community not found" });
}



// ...

// Normalize the role and check permissions
const normalizedRole = Permission.normalize(user.role);
const isPrivilegedUser = Permission.canApprove(normalizedRole);
const postStatus = isPrivilegedUser ? "approved" : "pending";



/* ✅ Create post */
const post = new Post({
  userId,
  communityId: selectedCommunity._id,
  text: text?.trim() || '',
  imageUrl,
  videoUrl,
  audioUrl,
  postType: detectedPostType,
  tags: tags || [],
  mentions: mentions || [],
  location: location || '',
  visibility: visibility || 'public',
  communityName: selectedCommunity.displayName || selectedCommunity.name,
  status: postStatus,
});


    await post.save();

    /* ✅ Reward user via rewardService */
    if (postStatus === "approved") {
      await rewardService.reward(userId, REWARDS.CREATE_POST, {
  type: 'REWARD_POST',  // ✅ matches schema enum
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

    /* ✅ Response */
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

// GET /posts/by-communities?ids=1,2,3
router.get('/by-communities', authMiddleware, async (req, res) => {
  try {
    const ids = req.query.ids?.split(',') || [];
    if (ids.length === 0) {
      return res.status(400).json({ error: "No communities provided" });
    }

    const posts = await Post.find({
      communityId: { $in: ids },
      isActive: true,
      status: "approved"
    })
      .sort({ createdAt: -1 })
      .populate("userId", "username profileImage verified")
      .populate("communityId", "name displayName")
      .lean();

    res.json({ posts });

  } catch (err) {
    console.error("❌ Failed to fetch multi-community posts:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

/* 🕵️‍♂️ GET ALL PENDING POSTS */
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

// Normalize the user's role properly
const normalizedRole = Permission.normalize(user.role);

// Define which roles can approve
const approvers = ["admin", "moderator", "junior_developer", "senior_developer"];

// Check if user is allowed to approve
if (!approvers.includes(normalizedRole)) {
  return res.status(403).json({ error: 'Not authorized to approve posts' });
}

    

    const pendingPosts = await Post.find({ status: "pending" })
      .populate('userId', 'username profileImage verified')
      .populate('communityId', 'name displayName')
      .sort({ createdAt: -1 });

    res.json(pendingPosts);
  } catch (err) {
    console.error("❌ Error fetching pending posts:", err);
    res.status(500).json({ error: "Server error fetching pending posts" });
  }
});

module.exports = router;
