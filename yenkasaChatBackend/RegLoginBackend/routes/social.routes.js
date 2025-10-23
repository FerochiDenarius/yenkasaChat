const express = require("express");
const Post = require("../models/post");
const User = require("../models/user.model");
const verifyToken = require("../middleware/auth");

const router = express.Router();

/* ------------------------------------
 * 👍 LIKE / UNLIKE POST
 * ------------------------------------ */
router.post("/like/:postId", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = req.user.id;
    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    res.status(200).json({
      message: alreadyLiked ? "Post unliked" : "Post liked",
      likesCount: post.likes.length,
      likedByUser: !alreadyLiked,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Error toggling like:", err);
    res.status(500).json({ message: "Failed to toggle like", error: err.message });
  }
});

/* ------------------------------------
 * 💬 COMMENT (placeholder for future)
 * ------------------------------------ */
router.post("/comment/:postId", verifyToken, async (req, res) => {
  res.status(501).json({ message: "Comment feature coming soon." });
});

/* ------------------------------------
 * 🤝 FOLLOW USER
 * ------------------------------------ */
router.post("/follow/:targetUserId", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const target = await User.findById(req.params.targetUserId);

    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.id === user.id)
      return res.status(400).json({ message: "Cannot follow yourself" });

    const isFollowing = user.following.includes(target.id);

    if (isFollowing) {
      user.following = user.following.filter((id) => id.toString() !== target.id);
      target.followers = target.followers.filter((id) => id.toString() !== user.id);
    } else {
      user.following.push(target.id);
      target.followers.push(user.id);
    }

    await user.save();
    await target.save();

    res.status(200).json({
      message: isFollowing ? "Unfollowed user" : "Followed user",
      followingCount: user.following.length,
      followersCount: target.followers.length,
    });
  } catch (err) {
    console.error("❌ Error in follow/unfollow:", err);
    res.status(500).json({ message: "Failed to follow/unfollow", error: err.message });
  }
});

/* ------------------------------------
 * 🚫 BLOCK USER
 * ------------------------------------ */
router.post("/block/:targetUserId", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const target = await User.findById(req.params.targetUserId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const alreadyBlocked = user.blocked.includes(target.id);

    if (alreadyBlocked) {
      user.blocked = user.blocked.filter((id) => id.toString() !== target.id);
    } else {
      user.blocked.push(target.id);
    }

    await user.save();

    res.status(200).json({
      message: alreadyBlocked ? "User unblocked" : "User blocked",
      blockedCount: user.blocked.length,
    });
  } catch (err) {
    console.error("❌ Error in block/unblock:", err);
    res.status(500).json({ message: "Failed to block/unblock", error: err.message });
  }
});

module.exports = router;
