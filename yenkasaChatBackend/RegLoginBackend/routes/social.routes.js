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
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Ensure post exists
    const post = await Post.findById(req.params.postId).select("likes");
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Determine current state (use .some with toString to handle ObjectId)
    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    // Use atomic update to avoid race conditions
    const update = alreadyLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } };

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.postId,
      update,
      { new: true, runValidators: true }
    ).select("likes");

    if (!updatedPost) {
      return res.status(500).json({ message: "Failed to update like state" });
    }

    res.status(200).json({
      message: alreadyLiked ? "Post unliked" : "Post liked",
      likesCount: updatedPost.likes.length,
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
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("following");
    const target = await User.findById(req.params.targetUserId).select("followers");

    if (!user) return res.status(404).json({ message: "Authenticated user not found" });
    if (!target) return res.status(404).json({ message: "Target user not found" });
    if (target.id === user.id) return res.status(400).json({ message: "Cannot follow yourself" });

    const isFollowing = user.following.some((id) => id.toString() === target.id);

    // Atomic updates for both documents
    if (isFollowing) {
      await Promise.all([
        User.findByIdAndUpdate(userId, { $pull: { following: target.id } }),
        User.findByIdAndUpdate(target.id, { $pull: { followers: userId } }),
      ]);
    } else {
      await Promise.all([
        User.findByIdAndUpdate(userId, { $addToSet: { following: target.id } }),
        User.findByIdAndUpdate(target.id, { $addToSet: { followers: userId } }),
      ]);
    }

    // Re-fetch counts (or compute from returned docs if you returned them)
    const freshUser = await User.findById(userId).select("following");
    const freshTarget = await User.findById(target.id).select("followers");

    res.status(200).json({
      message: isFollowing ? "Unfollowed user" : "Followed user",
      followingCount: freshUser.following.length,
      followersCount: freshTarget.followers.length,
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
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("blocked");
    const target = await User.findById(req.params.targetUserId).select("_id");

    if (!user) return res.status(404).json({ message: "Authenticated user not found" });
    if (!target) return res.status(404).json({ message: "Target user not found" });

    const alreadyBlocked = user.blocked.some((id) => id.toString() === target.id);

    const update = alreadyBlocked ? { $pull: { blocked: target.id } } : { $addToSet: { blocked: target.id } };
    const updated = await User.findByIdAndUpdate(userId, update, { new: true }).select("blocked");

    res.status(200).json({
      message: alreadyBlocked ? "User unblocked" : "User blocked",
      blockedCount: updated.blocked.length,
    });
  } catch (err) {
    console.error("❌ Error in block/unblock:", err);
    res.status(500).json({ message: "Failed to block/unblock", error: err.message });
  }
});

module.exports = router;