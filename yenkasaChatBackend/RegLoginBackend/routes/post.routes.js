// routes/post.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const Post = require('../models/post.model');
const User = require('../models/user.model');
const Community = require('../models/community.model');
const CoinTransaction = require('../models/cointransaction.model');
const CoinSupply = require('../models/coinSupply');

const authMiddleware = require('../middleware/auth');

// 🧰 Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ------------------------------------
 * 💰 REWARD CONFIGURATION
 * ------------------------------------ */
const REWARDS = { CREATE_POST: 10, GET_LIKE: 2, GET_COMMENT: 3 };
const MAX_SUPPLY = 100_000_000;

/* ------------------------------------
 * 🪙 Ensure Supply Record Exists
 * ------------------------------------ */
async function ensureSupply() {
  await CoinSupply.findByIdAndUpdate(
    "YENKASA_SUPPLY",
    { $setOnInsert: { totalMinted: 0 } },
    { upsert: true }
  );
}

/* ------------------------------------
 * 🎁 Reward User Utility
 * ------------------------------------ */
async function rewardUser(userId, amount, reason, referenceModel, referenceId) {
  try {
    await ensureSupply();
    const amt = Math.abs(Number(amount));

    // Update total supply if within max
    const supply = await CoinSupply.findOneAndUpdate(
      { _id: "YENKASA_SUPPLY", totalMinted: { $lte: MAX_SUPPLY - amt } },
      { $inc: { totalMinted: amt } },
      { new: true, upsert: true }
    );
    if (!supply) return;

    const user = await User.findById(userId);
    if (!user) {
      console.warn(`⚠️ rewardUser: user ${userId} not found`);
      return;
    }

    const beforeBalance = user.coinsBalance || 0;
    const afterBalance = beforeBalance + amt;

    user.coinsBalance = afterBalance;
    await user.save();

    // Determine transaction type
    let txType = 'BONUS';
    if (referenceModel === 'Post') txType = 'REWARD_POST';
    else if (referenceModel === 'Comment') txType = 'REWARD_COMMENT';
    else if (reason?.toLowerCase().includes('follow')) txType = 'REWARD_FOLLOW';

    // Create coin transaction
    await CoinTransaction.create({
      toUserId: userId,
      amount: amt,
      type: txType,
      description: reason || `Reward for ${referenceModel || 'activity'}`,
      relatedPostId: referenceModel === 'Post' ? referenceId : null,
      relatedCommentId: referenceModel === 'Comment' ? referenceId : null,
      toUserBalanceBefore: beforeBalance,
      toUserBalanceAfter: afterBalance,
      status: 'completed'
    });

    console.log(`✅ Rewarded ${amt} coins to user ${user.username} (${txType})`);
  } catch (err) {
    console.error("❌ Error rewarding coins:", err);
  }
}

/* ------------------------------------
 * ✍️ CREATE POST (FULL FIXED & LOGGED)
 * ------------------------------------ */
router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
  console.log("🟢 Incoming post creation request...");
  try {
    const {
      text,
      imageUrl,
      videoUrl,
      mediaUrls,
      tags,
      location,
      visibility,
      postType,
      mentions,
      communityName
    } = req.body;

    const userId = req.user.id;
    console.log(`👤 Authenticated user: ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      console.warn("⚠️ User not found for post creation");
      return res.status(404).json({ error: 'User not found' });
    }

    let uploadedImageUrl = imageUrl || '';
    let uploadedVideoUrl = videoUrl || '';

    /* ------------------------------------
     * ☁️ Upload file to Cloudinary if provided
     * ------------------------------------ */
    if (req.file) {
      console.log(`📤 File detected: ${req.file.originalname}, MIME: ${req.file.mimetype}`);
      const folder = "yenkasachat/posts";
      const isVideo = req.file.mimetype.startsWith('video');
      const resourceType = isVideo ? "video" : "image";

      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: resourceType },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(req.file.buffer);
        });

        if (isVideo) {
          uploadedVideoUrl = uploadResult.secure_url;
          console.log(`🎥 Video uploaded to Cloudinary: ${uploadedVideoUrl}`);
        } else {
          uploadedImageUrl = uploadResult.secure_url;
          console.log(`🖼️ Image uploaded to Cloudinary: ${uploadedImageUrl}`);
        }
      } catch (uploadErr) {
        console.error("❌ Cloudinary upload failed:", uploadErr);
        return res.status(500).json({ error: "Media upload failed" });
      }
    }

    /* ------------------------------------
     * 🏘️ Find community if provided
     * ------------------------------------ */
    let selectedCommunity = null;
    if (communityName && communityName.trim() !== "") {
      console.log(`🏘️ Checking for community: ${communityName}`);
      selectedCommunity = await Community.findOne({
        $or: [
          { name: communityName.trim() },
          { displayName: communityName.trim() }
        ]
      });
      if (selectedCommunity) {
        console.log(`✅ Community found: ${selectedCommunity.displayName}`);
      } else {
        console.log(`⚠️ No matching community found, post will be standalone`);
      }
    }

    /* ------------------------------------
     * 🧠 Determine approval status
     * ------------------------------------ */
    const approvers = ["admin", "moderator", "developer"];
    const isPrivilegedUser = approvers.includes(user.role?.toLowerCase());
    const postStatus = isPrivilegedUser ? "approved" : "pending";
    console.log(`📝 Post status: ${postStatus} (user role: ${user.role})`);

    /* ------------------------------------
     * 🆕 Create Post Document
     * ------------------------------------ */
    const post = new Post({
      userId,
      communityId: selectedCommunity ? selectedCommunity._id : user.community || null,
      text: text?.trim() || '',
      imageUrl: uploadedImageUrl,
      videoUrl: uploadedVideoUrl,
      mediaUrls: mediaUrls || [],
      tags: tags || [],
      mentions: mentions || [],
      location: location || '',
      visibility: visibility || 'public',
      postType: postType || 'text',
      communityName: selectedCommunity ? selectedCommunity.displayName : communityName || '',
      status: postStatus,
    });

    await post.save();
    console.log(`✅ Post created successfully: ${post._id}`);

    /* ------------------------------------
     * 💰 Reward if auto-approved
     * ------------------------------------ */
    if (postStatus === "approved") {
      try {
        await rewardUser(userId, REWARDS.CREATE_POST, "Reward for creating post", "Post", post._id);
        console.log(`💰 Reward sent to user ${user.username}`);
      } catch (rewardErr) {
        console.error("⚠️ Failed to process reward:", rewardErr);
      }

      // 🔔 Emit new post event for realtime updates
      if (global.io) {
        global.io.emit("feedUpdate", {
          action: "new_post",
          postId: post._id,
          userId,
          community: post.communityName,
          timestamp: new Date(),
        });
        console.log(`📢 feedUpdate emitted for post ${post._id}`);
      } else {
        console.log("⚠️ Socket.io not initialized, skipping feedUpdate emit");
      }
    }

    res.json({ success: true, post });

  } catch (err) {
    console.error("❌ Unexpected error during post creation:", err);
    res.status(500).json({ error: "Failed to create post", details: err.message });
  }
});


/* ------------------------------------
 * 👤 USER POSTS
 * ------------------------------------ */
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
 * 🕵️‍♂️ GET ALL PENDING POSTS
 * ------------------------------------ */
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const approvers = ["admin", "moderator", "developer"];
    if (!approvers.includes(user.role?.toLowerCase())) {
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
