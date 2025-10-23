const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const Post = require("../models/post");
const verifyToken = require("../middleware/auth");
const router = express.Router();

// Multer setup for uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ------------------- CREATE POST -------------------
router.post("/", verifyToken, upload.single("media"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { caption, mediaType } = req.body;

    if (!caption && !req.file) {
      return res.status(400).json({ message: "Post must have text or media." });
    }

    let mediaUrl = null;
    let thumbnailUrl = null;

    if (req.file) {
      const folder = "yenkasachat/posts";
      const resourceType =
        mediaType === "video" || mediaType === "audio" ? "video" : "image";

      // Upload file to Cloudinary
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

    // Create new post
    const newPost = new Post({
      user: userId,
      caption,
      mediaType: mediaType || "text",
      mediaUrl,
      thumbnailUrl,
    });

    await newPost.save();

    // Populate user info (username + profileImage)
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
      .populate("user", "_id username profileImage") // populate profileImage for frontend
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Failed to fetch posts", error: error.message });
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
/* -------------------
 * 🗑️ DELETE POST (with robust ObjectId handling + debug)
 * ------------------- */
router.delete("/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // Support both possible keys
    const { postId } = req.params;

    console.log("DELETE request received for post:", postId);
    console.log("Authenticated user ID:", userId);

    const post = await Post.findById(postId);

    if (!post) {
      console.log("❌ Post not found:", postId);
      return res.status(404).json({ message: "Post not found." });
    }

    // Normalize IDs as strings for comparison
    const postAuthorId = post.user?._id?.toString() || post.user?.toString();
    const authUserId = userId?.toString();

    console.log("Post author ID:", postAuthorId);
    console.log("Authenticated user ID (string):", authUserId);

    // ✅ Only the author can delete
    if (postAuthorId !== authUserId) {
      console.log("🚫 Forbidden: User is not the post's author.");
      return res.status(403).json({
        message: "Forbidden: You cannot delete another user's post.",
        postAuthorId,
        authUserId,
      });
    }

    // ✅ Optional: delete media from Cloudinary
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
          console.log("🗑️ Deleting media from Cloudinary:", publicId);
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        } else {
          console.warn("⚠️ Could not extract Cloudinary publicId from:", post.mediaUrl);
        }
      } catch (cloudinaryError) {
        console.error("⚠️ Cloudinary delete error (non-fatal):", cloudinaryError);
      }
    }

    // ✅ Delete post document
    await Post.findByIdAndDelete(postId);
    console.log("✅ Post deleted successfully:", postId);

    res.status(200).json({ message: "Post deleted successfully." });
  } catch (error) {
    console.error("🔥 Error deleting post:", error);
    res.status(500).json({ message: "Error deleting post", error: error.message });
  }
});



module.exports = router;
