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

/* ------------------------------------
 * ✅ Multer Setup (Memory Storage)
 * ------------------------------------ */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

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
 * ✅ Route: Create Post
 * ------------------------------------ */
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        text,
        tags,
        location,
        visibility,
        mentions,
        communityName,
        postType,
      } = req.body;

      const userId = req.user.id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Initialize
      let imageUrl = "";
      let videoUrl = "";
      let audioUrl = "";
      let detectedPostType = postType || "text";

      /* ------------------------------------
       * ✅ Upload Files (if provided)
       * ------------------------------------ */
      const uploadToCloudinary = (fileBuffer, folder, resourceType) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: resourceType },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(fileBuffer);
        });
      };

      const folder = "yenkasachat/posts";

      if (req.files?.image?.length) {
        const result = await uploadToCloudinary(
          req.files.image[0].buffer,
          folder,
          "image"
        );
        imageUrl = result.secure_url;
        detectedPostType = "image";
      } else if (req.files?.video?.length) {
        const result = await uploadToCloudinary(
          req.files.video[0].buffer,
          folder,
          "video"
        );
        videoUrl = result.secure_url;
        detectedPostType = "video";
      } else if (req.files?.audio?.length) {
        const result = await uploadToCloudinary(
          req.files.audio[0].buffer,
          folder,
          "video" // audio uses Cloudinary's 'video' resource type
        );
        audioUrl = result.secure_url;
        detectedPostType = "audio";
      }

      /* ------------------------------------
       * ✅ Community Lookup (if provided)
       * ------------------------------------ */
      let selectedCommunity = null;
      if (communityName && communityName.trim() !== "") {
        selectedCommunity = await Community.findOne({
          $or: [
            { name: communityName.trim() },
            { displayName: communityName.trim() },
          ],
        });
      }

      /* ------------------------------------
       * ✅ Determine Approval Status
       * ------------------------------------ */
      const approvers = ["admin", "moderator", "developer"];
      const isPrivilegedUser = approvers.includes(user.role?.toLowerCase());
      const postStatus = isPrivilegedUser ? "approved" : "pending";

      /* ------------------------------------
       * ✅ Create Post
       * ------------------------------------ */
      const post = new Post({
        userId,
        communityId: selectedCommunity
          ? selectedCommunity._id
          : user.community || null,
        text: text?.trim() || "",
        imageUrl,
        videoUrl,
        audioUrl,
        postType: detectedPostType,
        tags: tags || [],
        mentions: mentions || [],
        location: location || "",
        visibility: visibility || "public",
        communityName: selectedCommunity
          ? selectedCommunity.displayName
          : communityName || "",
        status: postStatus,
      });

      await post.save();

      /* ------------------------------------
       * ✅ Reward & Emit Feed Update
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
      res.status(201).json({ success: true, post });
    } catch (err) {
      console.error("❌ Failed to create post:", err);
      res.status(500).json({
        error: "Failed to create post",
        details: err.message,
      });
    }
  }
);




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
