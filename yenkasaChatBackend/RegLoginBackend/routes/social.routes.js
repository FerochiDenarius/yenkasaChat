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

    // Ensure post exists and get current likes
    const post = await Post.findById(req.params.postId).select("likes");
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Determine current state (handle ObjectId vs string)
    const alreadyLiked = Array.isArray(post.likes) && post.likes.some(id => id.toString() === userId);

    // Use atomic update to avoid race conditions
    const update = alreadyLiked
      ? { $pull: { likes: userId } }
      : { $addToSet: { likes: userId } };

    // Return the updated document (with likes array) to compute authoritative values
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.postId,
      update,
      { new: true, runValidators: true }
    ).select("likes");

    if (!updatedPost) {
      return res.status(500).json({ message: "Failed to update like state" });
    }

    // Compute likedByUser from the updated document to be authoritative
    const likedByUser = Array.isArray(updatedPost.likes) && updatedPost.likes.some(id => id.toString() === userId);
    const likesCount = Array.isArray(updatedPost.likes) ? updatedPost.likes.length : 0;

    res.status(200).json({
      message: likedByUser ? "Post liked" : "Post unliked",
      likesCount,
      likedByUser,
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

    // Load minimal fields
    const user = await User.findById(userId).select("following");
    const target = await User.findById(req.params.targetUserId).select("followers");

    if (!user) return res.status(404).json({ message: "Authenticated user not found" });
    if (!target) return res.status(404).json({ message: "Target user not found" });

    // Prevent following yourself
    if (userId === String(target._id)) return res.status(400).json({ message: "Cannot follow yourself" });

    const isFollowing = Array.isArray(user.following) && user.following.some(id => id.toString() === String(target._id));

    // Atomic updates for both documents to avoid partial state
    if (isFollowing) {
      await Promise.all([
        User.findByIdAndUpdate(userId, { $pull: { following: target._id } }),
        User.findByIdAndUpdate(target._id, { $pull: { followers: userId } }),
      ]);
    } else {
      await Promise.all([
        User.findByIdAndUpdate(userId, { $addToSet: { following: target._id } }),
        User.findByIdAndUpdate(target._id, { $addToSet: { followers: userId } }),
      ]);
    }

    // Re-fetch counts from DB for authoritative values
    const freshUser = await User.findById(userId).select("following");
    const freshTarget = await User.findById(target._id).select("followers");

    res.status(200).json({
      message: isFollowing ? "Unfollowed user" : "Followed user",
      followingCount: Array.isArray(freshUser.following) ? freshUser.following.length : 0,
      followersCount: Array.isArray(freshTarget.followers) ? freshTarget.followers.length : 0,
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

    const alreadyBlocked = Array.isArray(user.blocked) && user.blocked.some(id => id.toString() === String(target._id));

    const update = alreadyBlocked ? { $pull: { blocked: target._id } } : { $addToSet: { blocked: target._id } };
    const updated = await User.findByIdAndUpdate(userId, update, { new: true }).select("blocked");

    res.status(200).json({
      message: alreadyBlocked ? "User unblocked" : "User blocked",
      blockedCount: Array.isArray(updated.blocked) ? updated.blocked.length : 0,
    });
  } catch (err) {
    console.error("❌ Error in block/unblock:", err);
    res.status(500).json({ message: "Failed to block/unblock", error: err.message });
  }
});

module.exports = router;