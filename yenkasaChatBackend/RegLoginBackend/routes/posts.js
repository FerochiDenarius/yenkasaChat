const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const Post = require("../models/post");
const User = require("../models/user.model");
const verifyToken = require("../middleware/auth");
const router = express.Router();

// ------------------- COMMUNITY CONFIG -------------------

// Default Yenkasa communities
const DEFAULT_COMMUNITIES = [
  "Ayimensah","Danfa","Kweiman","Oyarifa","Abokobi","Frafraha",
  "New Legon","Adenta","Adenta NewSite","Amrahia","Oyibi",
  "Legon Campus","East Legon","Menpeasem","Ogbojo","Adjinganor",
  "Botwe","Madina Zongo Juntion","Atomic Juntion","UPSA","Bawaleshie",
  "American House","Botwe","School Junction","Mataheko","Nana Krom",
  "Hatso","Taifa","Odokor","Aboso Okai"
];

// In-memory cache for quick listing
let customCommunities = [];

// Get all communities (default + user-created)
router.get("/communities", verifyToken, async (req, res) => {
  try {
    const allCommunities = [...DEFAULT_COMMUNITIES, ...customCommunities];
    res.status(200).json({ communities: allCommunities });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch communities", error: error.message });
  }
});

// Verified users can create new community
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
  } catch (error) {
    res.status(500).json({ message: "Failed to create community", error: error.message });
  }
});

// ------------------- MULTER SETUP -------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ------------------- CREATE POST -------------------
router.post("/", verifyToken, upload.single("media"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { caption, mediaType, communityName } = req.body;

    if (!caption && !req.file) {
      return res.status(400).json({ message: "Post must have text or media." });
    }

    // Ensure post has a valid community
    if (!communityName) {
      return res.status(400).json({ message: "Each post must belong to a community." });
    }

    const allCommunities = [...DEFAULT_COMMUNITIES, ...customCommunities];
    if (!allCommunities.includes(communityName)) {
      return res.status(400).json({ message: "Invalid community selected." });
    }

    let mediaUrl = null;
    let thumbnailUrl = null;

    if (req.file) {
      const folder = "yenkasachat/posts";
      const resourceType =
        mediaType === "video" || mediaType === "audio" ? "video" : "image";

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      mediaUrl = uploadResult.secure_url;
      if (uploadResult.thumbnail_url) thumbnailUrl = uploadResult.thumbnail_url;
    }

    // Create post (includes community info)
    const newPost = new Post({
      user: userId,
      caption,
      mediaType: mediaType || "text",
      mediaUrl,
      thumbnailUrl,
      communityName, // string field
    });

    await newPost.save();

    const populatedPost = await newPost.populate("user", "_id username profileImage");
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Error creating post", error: error.message });
  }
});

// ------------------- GET ALL POSTS (Feed) -------------------
router.get("/", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "_id username profileImage")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Failed to fetch posts", error: error.message });
  }
});

// ------------------- GET POSTS BY COMMUNITY -------------------
router.get("/community/:name", verifyToken, async (req, res) => {
  try {
    const { name } = req.params;
    const posts = await Post.find({ communityName: name })
      .populate("user", "_id username profileImage")
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).json({ message: "Failed to fetch community posts", error: error.message });
  }
});

// ------------------- GET MY POSTS -------------------
router.get("/my", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.user.id })
      .populate("user", "_id username profileImage")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({ message: "Failed to fetch user posts", error: error.message });
  }
});

// ------------------- DELETE POST -------------------
router.delete("/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const postAuthorId = post.user?._id?.toString() || post.user?.toString();
    if (postAuthorId !== userId.toString()) {
      return res.status(403).json({ message: "Forbidden: Cannot delete another user's post." });
    }

    // Optional: delete media from Cloudinary
    if (post.mediaUrl) {
      try {
        const folderMarker = "yenkasachat/posts/";
        const startIndex = post.mediaUrl.indexOf(folderMarker);
        if (startIndex !== -1) {
          const publicIdWithFolder = post.mediaUrl.substring(startIndex);
          const publicId = publicIdWithFolder.substring(0, publicIdWithFolder.lastIndexOf("."));
          const resourceType = ["video", "audio"].includes(post.mediaType)
            ? "video"
            : "image";
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        }
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
      }
    }

    await Post.findByIdAndDelete(postId);
    res.status(200).json({ message: "Post deleted successfully." });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Error deleting post", error: error.message });
  }
});

module.exports = router;
