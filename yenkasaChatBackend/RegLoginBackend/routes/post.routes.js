// routes/post.routes.js
const express = require('express');
const router = express.Router();
const { v2: cloudinary } = require('cloudinary');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const Community = require('../models/community.model');
const CoinTransaction = require('../models/cointransaction.model');
const CoinSupply = require('../models/coinSupply');
const upload = require("../utils/upload");
const { v4: uuidv4 } = require('uuid');


const authMiddleware = require('../middleware/auth');


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
const { v4: uuidv4 } = require('uuid');

async function rewardUser(userId, amount, reason, referenceModel, referenceId, activityId = null) {
  try {
    await ensureSupply();
    const amt = Math.abs(Number(amount));

    const supply = await CoinSupply.findOneAndUpdate(
      { _id: "YENKASA_SUPPLY", totalMinted: { $lte: MAX_SUPPLY - amt } },
      { $inc: { totalMinted: amt } },
      { new: true, upsert: true }
    );
    if (!supply) return;

    const user = await User.findById(userId);
    if (!user) return;

    // Prevent double reward for same activity
    if (activityId) {
      const existingTx = await CoinTransaction.findOne({ activityId });
      if (existingTx) return;
    }

    const beforeBalance = user.coinsBalance || 0;
    const afterBalance = beforeBalance + amt;

    user.coinsBalance = afterBalance;
    await user.save();

    let txType = 'BONUS';
    if (referenceModel === 'Post') txType = 'REWARD_POST';
    else if (referenceModel === 'Comment') txType = 'REWARD_COMMENT';
    else if (reason?.toLowerCase().includes('follow')) txType = 'REWARD_FOLLOW';

    await CoinTransaction.create({
      transactionId: uuidv4(),
      activityId: activityId || uuidv4(),
      fromUserId: null,
      toUserId: userId,
      fromUsername: 'System',
      toUsername: user.username,
      fromWalletId: null,
      toWalletId: user.walletId,
      amount: amt,
      type: txType,
      description: reason || `Reward for ${referenceModel || 'activity'}`,
      relatedPostId: await Post.findById(post._id),
      relatedCommentId: referenceModel === 'Comment' ? referenceId : null,
      fromUserBalanceBefore: null,
      fromUserBalanceAfter: null,
      toUserBalanceBefore: beforeBalance,
      toUserBalanceAfter: afterBalance,
      status: 'completed'
    });

    console.log(`✅ Rewarded ${amt} coins to ${user.username} (${txType})`);
  } catch (err) {
    console.error("❌ Error rewarding coins:", err);
  }
}

/* ------------------------------------
 * ✍️ CREATE POST (Supports text, image, video, audio)
 * ------------------------------------ */
router.post('/', authMiddleware, upload(), async (req, res) => {
  try {
    const {
      text,              // caption / post text
      tags,
      location,
      visibility,
      mentions,
      communityName,
      postType           // optional hint from frontend ('video', 'image', 'audio', 'text')
    } = req.body;

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Initialize post fields
    let imageUrl = '';
    let videoUrl = '';
    let audioUrl = '';
    let detectedPostType = postType || 'text';

    /* ------------------------------------
     * ✅ Determine uploaded file
     * ------------------------------------ */
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

    /* ------------------------------------
     * ✅ Community lookup (if provided)
     * ------------------------------------ */
    let selectedCommunity = null;
    if (communityName && communityName.trim() !== "") {
      selectedCommunity = await Community.findOne({
        $or: [
          { name: communityName.trim() },
          { displayName: communityName.trim() }
        ]
      });
    }

    /* ------------------------------------
     * ✅ Determine approval status
     * ------------------------------------ */
    const approvers = ["admin", "moderator", "developer"];
    const isPrivilegedUser = approvers.includes(user.role?.toLowerCase());
    const postStatus = isPrivilegedUser ? "approved" : "pending";

    /* ------------------------------------
     * ✅ Create post
     * ------------------------------------ */
    const post = new Post({
      userId,
      communityId: selectedCommunity ? selectedCommunity._id : user.community || null,
      text: text?.trim() || '',
      imageUrl,
      videoUrl,
      audioUrl,
      postType: detectedPostType,
      tags: tags || [],
      mentions: mentions || [],
      location: location || '',
      visibility: visibility || 'public',
      communityName: selectedCommunity ? selectedCommunity.displayName : (communityName || ''),
      status: postStatus,
    });

    await post.save();

    /* ------------------------------------
     * ✅ Reward & emit feed update
     * ------------------------------------ */
    if (postStatus === "approved") {
      await rewardUser(
        userId,
        REWARDS.CREATE_POST,
        "Reward for creating post",
        "Post",
        post._id
      );

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
     * ✅ Response
     * ------------------------------------ */
    res.status(201).json({
      success: true,
      post
    });

  } catch (err) {
    console.error("❌ Failed to create post:", err);
    res.status(500).json({
      error: "Failed to create post",
      details: err.message
    });
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
