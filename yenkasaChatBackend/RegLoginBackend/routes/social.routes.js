// routes/social.routes.js
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const CoinTransaction = require("../models/cointransaction.model");
const CoinSupply = require("../models/coinSupply");
const verifyToken = require("../middleware/auth");
const rewardService = require('../services/reward.service');


const router = express.Router();

const REWARD_LIKE = 10;
const MAX_SUPPLY = 100_000_000;

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
async function rewardCoins({ toUserId, fromUserId, relatedPostId, amount, type, description, activityId }) {
  try {
    if (!toUserId) return console.warn("⚠️ Missing user for reward");

    // prevent duplicate rewards
    if (activityId) {
      const exists = await CoinTransaction.findOne({ activityId });
      if (exists) {
        console.log(`⚠️ Skipping duplicate reward for ${activityId}`);
        return;
      }
    }

    // ensure supply exists
    await CoinSupply.findByIdAndUpdate(
      "YENKASA_SUPPLY",
      { $setOnInsert: { totalMinted: 0 } },
      { upsert: true }
    );

    // check max supply and increment
    const supply = await CoinSupply.findOneAndUpdate(
      { _id: "YENKASA_SUPPLY", totalMinted: { $lte: MAX_SUPPLY - amount } },
      { $inc: { totalMinted: amount } },
      { new: true }
    );

    if (!supply) return console.warn("⚠️ Max supply reached, cannot mint more coins");

    // update user balance
    const user = await User.findById(toUserId);
    if (!user) return console.warn("⚠️ User not found for reward");

    const before = user.coinsBalance || 0;
    user.coinsBalance += amount;
    await user.save();

 

    console.log(`✅ Rewarded ${amount} coins to ${user.username} for ${type}`);
  } catch (err) {
    console.error("❌ Error in rewardCoins:", err.message);
  }
}

/* ------------------------------------
 * 👍 LIKE / UNLIKE POST
 * ------------------------------------ */
router.post("/like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const postId = req.params.postId;
    const post = await Post.findById(postId).select("likes likeCount userId");

    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    // toggle like
    const update = alreadyLiked
      ? { $pull: { likes: userId }, $inc: { likeCount: -1 } }
      : { $addToSet: { likes: userId }, $inc: { likeCount: 1 } };

    const updatedPost = await Post.findByIdAndUpdate(postId, update, { new: true }).select("likes likeCount");

    const likedByUser = updatedPost.likes.some((id) => id.toString() === userId);

    // emit socket event
    emitFeedUpdate(req, likedByUser ? "post_liked" : "post_unliked", {
      postId,
      userId,
      likeCount: updatedPost.likeCount,
    });

    // ✅ reward the liker (not the post owner)
  // reward the liker (not the post owner)
if (!alreadyLiked && likedByUser) {
  await rewardService.reward(userId, REWARD_LIKE, {
    fromUserId: post.userId,
    type: 'REWARD_POST_LIKE',
    description: `Reward for liking post ${postId}`,
    relatedPostId: postId,
    activityId: `like_${postId}_${userId}`
  });
}


    res.status(200).json({
      message: likedByUser ? "Post liked" : "Post unliked",
      likeCount: updatedPost.likeCount,
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
