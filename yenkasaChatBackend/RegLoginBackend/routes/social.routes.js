// routes/social.routes.js
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const CoinTransaction = require("../models/cointransaction.model");
const CoinSupply = require("../models/coinSupply");
const verifyToken = require("../middleware/auth");
const rewardService = require('../services/reward.service');
const UserPrivacy = require("../models/userPrivacy.model");
const { sendNotification } = require("../services/notification.service");


async function isBlocked(userA, userB) {
  try {
    const [privacyA, privacyB] = await Promise.all([
      UserPrivacy.findOne({ userId: userA }).lean(),
      UserPrivacy.findOne({ userId: userB }).lean()
    ]);

    const aBlockedB = privacyA?.blockedUsers?.includes(userB);
    const bBlockedA = privacyB?.blockedUsers?.includes(userA);

    return aBlockedB || bBlockedA;
  } catch (err) {
    console.error("BLOCK CHECK ERROR:", err.message);
    return false;
  }
}



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
 * LIKE / UNLIKE POST
 * ------------------------------------ */
router.post("/like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const post = await Post.findById(postId)
      .select("likes likeCount userId")
      .populate("userId", "username oneSignalPlayerId");
    
    if (!post) return res.status(404).json({ message: "Post not found" });

    const postOwnerId = post.userId._id.toString();

    // 🚫 BLOCK CHECK
    if (await isBlocked(userId, postOwnerId)) {
      return res.status(403).json({
        message: "You cannot interact with this user due to privacy settings"
      });
    }

    const alreadyLiked = post.likes.some(id => id.toString() === userId);

    // LIKE / UNLIKE
    const update = alreadyLiked
      ? { $pull: { likes: userId }, $inc: { likeCount: -1 } }
      : { $addToSet: { likes: userId }, $inc: { likeCount: 1 } };

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      update,
      { new: true }
    ).select("likes likeCount");

    const likedByUser = updatedPost.likes.some(id => id.toString() === userId);

    // SOCKET UPDATE
    emitFeedUpdate(req, likedByUser ? "post_liked" : "post_unliked", {
      postId,
      userId,
      likeCount: updatedPost.likeCount,
    });

    /* ------------------------------------
     * 🎁 REWARD for LIKE ONLY (not unlike)
     * ------------------------------------ */
    if (!alreadyLiked && likedByUser) {
      await rewardService.reward(userId, REWARD_LIKE, {
        fromUserId: postOwnerId,
        type: "REWARD_POST_LIKE",
        description: `Earned ${REWARD_LIKE} YKC for liking a post`,
        relatedPostId: postId,
        activityId: `post_like_${postId}_${userId}` 
      });

      // 🔔 Notification to owner
      if (!(await isBlocked(userId, postOwnerId))) {
        await sendNotification({
          type: "post_like",
          senderId: userId,
          receiverId: postOwnerId,
          activityId: `post_like_notify_${postId}_${userId}`,
          message: "liked your post",
           targetType: "post",
           targetId: postId
        });
      }
    }

    return res.json({
      message: likedByUser ? "Post liked" : "Post unliked",
      likeCount: updatedPost.likeCount,
      likedByUser,
    });

  } catch (err) {
    console.error("❌ Error toggling like:", err);
    return res.status(500).json({
      message: "Failed to toggle like",
      error: err.message
    });
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
