const express = require("express");
const Post = require("../models/post");
const User = require("../models/user.model");
const Comment = require("../models/comment");
const verifyToken = require("../middleware/auth");

const router = express.Router();

/* ------------------------------------
 * 🪙 REWARD COINS HELPER
 * ------------------------------------ */
async function rewardCoins(userId, actionType = 'activity', amount = 10, referenceId = null) {
  try {
    const User = require("../models/user.model");
    const CoinTransaction = require("../models/coinTransaction");
    const CoinSupply = require("../models/coinSupply");
    const MAX_SUPPLY = 100_000_000;

    // Ensure supply exists
    await CoinSupply.findByIdAndUpdate(
      "YENKASA_SUPPLY",
      { $setOnInsert: { totalMinted: 0 } },
      { upsert: true }
    );

    // Check supply limit
    const updatedSupply = await CoinSupply.findOneAndUpdate(
      { _id: "YENKASA_SUPPLY", totalMinted: { $lte: MAX_SUPPLY - amount } },
      { $inc: { totalMinted: amount } },
      { new: true }
    );
    if (!updatedSupply) return console.warn("⚠️ Not enough supply to mint more coins");

    // Reward user
    const user = await User.findById(userId);
    if (!user) return;

    user.coinsBalance += amount;
    await user.save();

    await CoinTransaction.create({
      user: user._id,
      type: "earn",
      amount,
      description: `Earned from ${actionType}`,
      referenceId,
      balanceAfter: user.coinsBalance
    });

    console.log(`✅ Rewarded ${amount} coins to user ${user.username} for ${actionType}`);
  } catch (err) {
    console.error("❌ Error rewarding coins:", err);
  }
}

/* ------------------------------------
 * 👍 LIKE / UNLIKE POST
 * ------------------------------------ */
router.post("/like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const post = await Post.findById(req.params.postId).select("likes");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyLiked = post.likes.some(id => id.toString() === userId);

    // Prepare the update operation
    const updateOperation = alreadyLiked
      ? { $pull: { likes: userId } }
      : { $addToSet: { likes: userId } };

    await Post.findByIdAndUpdate(req.params.postId, updateOperation);

    const freshPost = await Post.findById(req.params.postId).select("likes");
    const newLikesCount = freshPost.likes.length;
    await Post.findByIdAndUpdate(req.params.postId, { likesCount: newLikesCount });

    const likedByUser = freshPost.likes.some(id => id.toString() === userId);

    // ✅ Reward only when liking (not unliking)
    if (!alreadyLiked) {
      await rewardCoins(userId, "like", 10, req.params.postId);
    }

    res.status(200).json({
      message: likedByUser ? "Post liked" : "Post unliked",
      likesCount: newLikesCount,
      likedByUser,
    });

  } catch (err) {
    console.error("❌ Error toggling like:", err);
    res.status(500).json({ message: "Failed to toggle like", error: err.message });
  }
});

/* ------------------------------------
 * 💬 ADD COMMENT
 * ------------------------------------ */
router.post("/comment/:postId", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!text || text.trim() === "")
      return res.status(400).json({ message: "Comment text required" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = await Comment.create({
      user: userId,
      post: postId,
      text: text.trim(),
    });

    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    await comment.populate("user", "_id username profileImage");

    // ✅ Reward for commenting
    await rewardCoins(userId, "comment", 10, postId);

    res.status(201).json(comment);
  } catch (err) {
    console.error("❌ Error adding comment:", err);
    res.status(500).json({ message: "Failed to add comment", error: err.message });
  }
});

/* ------------------------------------
 * 💬 GET COMMENTS
 * ------------------------------------ */
router.get("/comments/:postId", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await Comment.find({ post: postId, isDeleted: false })
      .populate("user", "_id username profileImage")
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    console.error("❌ Error loading comments:", err);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

/* ------------------------------------
 * 👁️‍🗨️ ADD VIEW
 * ------------------------------------ */
router.post("/view/:postId", verifyToken, async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { $inc: { viewsCount: 1 } },
      { new: true }
    );

    // ✅ Reward for viewing
    await rewardCoins(req.user.id, "view", 10, req.params.postId);

    res.json({ viewsCount: post.viewsCount });
  } catch (err) {
    console.error("❌ Error updating view count:", err);
    res.status(500).json({ error: "Failed to update view count" });
  }
});

/* ------------------------------------
 * 🤝 FOLLOW / UNFOLLOW USER
 * ------------------------------------ */
router.post("/follow/:targetUserId", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("following");
    const target = await User.findById(req.params.targetUserId).select("followers");

    if (!user || !target) return res.status(404).json({ message: "User not found" });
    if (userId === String(target._id)) return res.status(400).json({ message: "Cannot follow yourself" });

    const isFollowing = user.following.some(id => id.toString() === String(target._id));
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
      // ✅ Reward for following
      await rewardCoins(userId, "follow", 10, req.params.targetUserId);
    }

    const freshUser = await User.findById(userId).select("following");
    const freshTarget = await User.findById(target._id).select("followers");

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
 * 📰 FEED FROM FOLLOWED USERS
 * ------------------------------------ */
router.get("/feed/following", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("following");
    if (!user) return res.status(404).json({ message: "User not found" });

    const posts = await Post.find({
      user: { $in: [...user.following, userId] },
      isDeleted: false
    })
      .populate("user", "_id username profileImage")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    console.error("❌ Error loading following feed:", err);
    res.status(500).json({ message: "Failed to load following feed", error: err.message });
  }
});

/* ------------------------------------
 * 🚫 BLOCK / UNBLOCK USER
 * ------------------------------------ */
router.post("/block/:targetUserId", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("blocked");
    const target = await User.findById(req.params.targetUserId).select("_id");

    if (!user || !target) return res.status(404).json({ message: "User not found" });

    const alreadyBlocked = user.blocked.some(id => id.toString() === String(target._id));
    const update = alreadyBlocked ? { $pull: { blocked: target._id } } : { $addToSet: { blocked: target._id } };
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
