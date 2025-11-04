// routes/social.routes.js
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const verifyToken = require("../middleware/auth");

const router = express.Router();

/* ------------------------------------
 * 🔌 SOCKET EMIT HELPER
 * ------------------------------------ */
function emitFeedUpdate(req, type, payload = {}) {
  try {
    const io = req.app.get("io");
    if (io) io.emit("feedUpdate", { type, ...payload });
  } catch (err) {
    console.error("⚠️ Socket emit error:", err.message);
  }
}

/* ------------------------------------
 * 🪙 REWARD COINS HELPER
 * ------------------------------------ */
async function rewardCoins(
  userId,
  actionType = "REWARD_ACTIVITY",
  amount = 10,
  extra = {}
) {
  try {
    const CoinTransaction = require("../models/cointransaction.model");
    const CoinSupply = require("../models/coinSupply");
    const User = require("../models/user.model");
    const MAX_SUPPLY = 100_000_000;

    const {
      fromUserId = null,
      relatedPostId = null,
      description = "",
      activityId = null,
    } = extra;

    // 🧩 Step 1: Prevent duplicate rewards
    if (activityId) {
      const existing = await CoinTransaction.findOne({ activityId });
      if (existing) {
        console.log(`⚠️ Reward skipped — activity ${activityId} already rewarded.`);
        return;
      }
    }

    // 🪙 Step 2: Ensure supply doc exists
    await CoinSupply.findByIdAndUpdate(
      "YENKASA_SUPPLY",
      { $setOnInsert: { totalMinted: 0 } },
      { upsert: true }
    );

    // 🧮 Step 3: Check max supply and increment
    const updatedSupply = await CoinSupply.findOneAndUpdate(
      { _id: "YENKASA_SUPPLY", totalMinted: { $lte: MAX_SUPPLY - amount } },
      { $inc: { totalMinted: amount } },
      { new: true }
    );

    if (!updatedSupply) return console.warn("⚠️ Not enough supply to mint more coins");

    // 👤 Step 4: Update user balance
    const user = await User.findById(userId);
    if (!user) return;

    const before = user.coinsBalance || 0;
    user.coinsBalance += amount;
    await user.save();

    // 🧾 Step 5: Record transaction
    await CoinTransaction.create({
      fromUserId,
      toUserId: user._id,
      amount,
      type: actionType,
      description: description || `Rewarded for ${actionType}`,
      relatedPostId,
      activityId,
      transactionId: uuidv4(),
      toUserBalanceBefore: before,
      toUserBalanceAfter: user.coinsBalance,
      status: "completed",
    });

    console.log(`✅ Rewarded ${amount} coins to ${user.username} for ${actionType}`);
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
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    console.log("💥 Like route hit by user:", userId, "on post:", req.params.postId);

    const post = await Post.findById(req.params.postId).select("likes likeCount userId");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    // Build update operation
    const updateOperation = alreadyLiked
      ? { $pull: { likes: userId }, $inc: { likeCount: -1 } }
      : { $addToSet: { likes: userId }, $inc: { likeCount: 1 } };

    const updated = await Post.findByIdAndUpdate(
      req.params.postId,
      updateOperation,
      { new: true }
    ).select("likes likeCount");

    const likedByUser = updated.likes.some((id) => id.toString() === userId);

    console.log(`✅ Like status after toggle: liked=${likedByUser}, count=${updated.likeCount}`);

    // Emit socket feed update
    emitFeedUpdate(req, likedByUser ? "post_liked" : "post_unliked", {
      postId: req.params.postId,
      userId,
      likeCount: updated.likeCount,
    });

    // Reward coins if it's a new like
    if (!alreadyLiked) {
      try {
        console.log("🏅 Rewarding user:", userId);
        await rewardCoins(userId, "REWARD_LIKE", 10, {
          relatedPostId: req.params.postId,
          activityId: `like_${req.params.postId}_${userId}`,
        });
      } catch (rewardErr) {
        console.error("⚠️ Reward system error:", rewardErr.message);
      }
    }

    res.status(200).json({
      message: likedByUser ? "Post liked" : "Post unliked",
      likeCount: updated.likeCount,
      likedByUser,
    });
  } catch (err) {
    console.error("❌ Error toggling like:", err);
    res.status(500).json({ message: "Failed to toggle like", error: err.message });
  }
});

// ✅ Get likes for a post
router.get("/likes/:postId", verifyToken, async (req, res) => {
  try {
    const postId = req.params.postId;
    const likes = await Like.find({ postId }).populate("userId", "username profileImage");
    res.status(200).json({ count: likes.length, users: likes });
  } catch (error) {
    console.error("❌ Error fetching likes:", error);
    res.status(500).json({ error: "Failed to fetch likes" });
  }
});

module.exports = router;
