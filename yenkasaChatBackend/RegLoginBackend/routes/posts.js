const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const Post = require("../models/post");
const verifyToken = require("../middleware/auth"); // ✅ fix: not destructured
const router = express.Router();

// ✅ Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ CREATE POST (Text, Image, Video, or Audio)
router.post("/", verifyToken, upload.single("media"), async (req, res) => {  // ✅ fix: use "media" (Android sends this)
  try {
    const userId = req.user.id;
    const { caption, mediaType } = req.body;

    // Validate: must contain text or file
    if (!caption && !req.file) {
      return res.status(400).json({ message: "Post must have text or media." });
    }

    let mediaUrl = null;
    let thumbnailUrl = null;

    if (req.file) {
      const folder = "yenkasachat/posts";
      const resourceType =
        mediaType === "video" || mediaType === "audio" ? "video" : "image";

      // ✅ Upload file to Cloudinary
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
      if (uploadResult.thumbnail_url) {
        thumbnailUrl = uploadResult.thumbnail_url;
      }
    }

    // ✅ Create post document
    const newPost = new Post({
      user: userId,
      caption,
      mediaType: mediaType || "text",
      mediaUrl,
      thumbnailUrl,
    });

    await newPost.save();

    const populatedPost = await newPost.populate("user", "username avatarUrl");
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({
      message: "Error creating post",
      error: error.message,
    });
  }
});

// ✅ GET ALL POSTS (Feed)
router.get("/", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "username avatarUrl")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({
      message: "Failed to fetch posts",
      error: error.message,
    });
  }
});

// ✅ GET MY POSTS
router.get("/my", verifyToken, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.user.id })
      .populate("user", "username avatarUrl")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({
      message: "Failed to fetch user posts",
      error: error.message,
    });
  }
});

// ✅ DELETE POST
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await post.deleteOne();
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({
      message: "Error deleting post",
      error: error.message,
    });
  }
});

module.exports = router;
