const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const Post = require("../models/post");
const User = require("../models/user.model");
const verifyToken = require("../middleware/auth");
const CoinTransaction = require('../models/coinTransaction');
const CoinSupply = require('../models/coinSupply');

const router = express.Router();

/* ------------------------------------
 * 💰 YENKASA COIN REWARD SYSTEM
 * ------------------------------------ */
const MAX_SUPPLY = 100_000_000;

async function ensureSupply() {
  await CoinSupply.findByIdAndUpdate(
    "YENKASA_SUPPLY",
    { $setOnInsert: { totalMinted: 0 } },
    { upsert: true }
  );
}

async function rewardUser(userId, amount, description, referenceModel, referenceId) {
  try {
    await ensureSupply();
    const amt = Math.abs(Number(amount));

    const supply = await CoinSupply.findOneAndUpdate(
      { _id: "YENKASA_SUPPLY", totalMinted: { $lte: MAX_SUPPLY - amt } },
      { $inc: { totalMinted: amt } },
      { new: true, upsert: true }
    );

    if (!supply) {
      console.warn("⚠️ Supply limit reached. No more minting possible.");
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { coinsBalance: amt } },
      { new: true }
    );

    await CoinTransaction.create({
      user: userId,
      type: "earn",
      amount: amt,
      description,
      referenceModel,
      referenceId,
      balanceAfter: user?.coinsBalance,
    });

    console.log(`✅ Rewarded ${amt} coins to ${user?.username} for ${description}`);
  } catch (err) {
    console.error("❌ Error rewarding coins:", err);
  }
}

/* ------------------------------------
 * 🏘️ COMMUNITY CONFIGURATION
 * ------------------------------------ */
const DEFAULT_COMMUNITIES = [
  "Ayimensah","Danfa","Kweiman","Oyarifa","Abokobi","Frafraha",
  "New Legon","Adenta","Adenta NewSite","Amrahia","Oyibi",
  "Legon Campus","East Legon","Menpeasem","Ogbojo","Adjinganor",
  "Botwe","Madina Zongo Juntion","Atomic Juntion","UPSA","Bawaleshie",
  "American House","Botwe","School Junction","Mataheko","Nana Krom",
  "Hatso","Taifa","Odokor","Aboso Okai"
];

let customCommunities = [];

// 🏘️ Get all communities
router.get("/communities", verifyToken, async (req, res) => {
  try {
    const all = [...DEFAULT_COMMUNITIES, ...customCommunities];
    res.status(200).json({ communities: all });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch communities", error: err.message });
  }
});

// 🏗️ Verified user creates new community
router.post("/communities", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isVerified) {
      return res.status(403).json({ message: "Only verified users can create communities." });
    }

    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Community name is required." });

    if (DEFAULT_COMMUNITIES.includes(name) || customCommunities.includes(name)) {
      return res.status(400).json({ message: "Community already exists." });
    }

    customCommunities.push(name);
    res.status(201).json({ message: "Community created successfully.", name });
  } catch (err) {
    res.status(500).json({ message: "Failed to create community", error: err.message });
  }
});

/* ------------------------------------
 * 📸 MULTER + CLOUDINARY SETUP
 * ------------------------------------ */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ------------------------------------
 * ✍️ CREATE A NEW POST
 * ------------------------------------ */
router.post("/", verifyToken, upload.single("media"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { caption, mediaType, communityName } = req.body;

    if (!caption && !req.file) {
      return res.status(400).json({ message: "Post must have text or media." });
    }

    if (!communityName) {
      return res.status(400).json({ message: "Each post must belong to a community." });
    }

    const allCommunities = [...DEFAULT_COMMUNITIES, ...customCommunities];
    if (!allCommunities.includes(communityName)) {
      return res.status(400).json({ message: "Invalid community selected." });
    }

    let mediaUrl = null;
    let thumbnailUrl = null;

    // Upload media if provided
    if (req.file) {
      const folder = "yenkasachat/posts";
      const resourceType =
        mediaType === "video" || mediaType === "audio" ? "video" : "image";

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: resourceType },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });

      mediaUrl = uploadResult.secure_url;
      if (uploadResult.thumbnail_url) thumbnailUrl = uploadResult.thumbnail_url;
    }

    // Create and save post
    const newPost = new Post({
      user: userId,
      caption,
      mediaType: mediaType || "text",
      mediaUrl,
      thumbnailUrl,
      communityName,
    });

    await newPost.save();

    // ✅ Reward user for creating post
    await rewardUser(userId, 10, "Earned from creating a post", "Post", newPost._id);

    const populated = await newPost.populate("user", "_id username profileImage");
    res.status(201).json(populated);
  } catch (err) {
    console.error("❌ Error creating post:", err);
    res.status(500).json({ message: "Error creating post", error: err.message });
  }
});

/* ------------------------------------
 * 📰 GET ALL POSTS (FEED)
 * ------------------------------------ */
router.get("/", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "_id username profileImage")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    console.error("❌ Error fetching posts:", err);
    res.status(500).json({ message: "Failed to fetch posts", error: err.message });
  }
});

/* ------------------------------------
 * 🌍 GET POSTS BY COMMUNITY
 * ------------------------------------ */
router.get("/community/:name", verifyToken, async (req, res) => {
  try {
    const { name } = req.params;
    const posts = await Post.find({ communityName: name })
      .populate("user", "_id username profileImage")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    console.error("❌ Error fetching community posts:", err);
    res.status(500).json({ message: "Failed to fetch community posts", error: err.message });
  }
});

/* ------------------------------------
 * 👤 GET MY POSTS
 * ------------------------------------ */
router.get("/my", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.user.id })
      .populate("user", "_id username profileImage")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    console.error("❌ Error fetching user posts:", err);
    res.status(500).json({ message: "Failed to fetch user posts", error: err.message });
  }
});

/* ------------------------------------
 * 🗑️ DELETE POST
 * ------------------------------------ */
router.delete("/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const postAuthor = post.user?._id?.toString() || post.user?.toString();
    if (postAuthor !== userId.toString()) {
      return res.status(403).json({ message: "Forbidden: Cannot delete another user's post." });
    }

    // Delete from Cloudinary
    if (post.mediaUrl) {
      try {
        const marker = "yenkasachat/posts/";
        const idx = post.mediaUrl.indexOf(marker);
        if (idx !== -1) {
          const publicIdWithFolder = post.mediaUrl.substring(idx);
          const publicId = publicIdWithFolder.substring(0, publicIdWithFolder.lastIndexOf("."));
          const resourceType = ["video", "audio"].includes(post.mediaType)
            ? "video"
            : "image";
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        }
      } catch (err) {
        console.error("⚠️ Cloudinary delete error:", err);
      }
    }

    await Post.findByIdAndDelete(postId);
    res.status(200).json({ message: "Post deleted successfully." });
  } catch (err) {
    console.error("❌ Error deleting post:", err);
    res.status(500).json({ message: "Error deleting post", error: err.message });
  }
});

module.exports = router;
