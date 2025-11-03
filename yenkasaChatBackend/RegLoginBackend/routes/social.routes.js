// routes/social.routes.js
const express = require("express");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const Comment = require("../models/comment.model");
const verifyToken = require("../middleware/auth");

const router = express.Router();

/* ------------------------------------
 * 🪙 REWARD COINS HELPER (Updated)
 * ------------------------------------ */
const { v4: uuidv4 } = require("uuid");

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

    // Destructure useful fields from extra
    const {
      fromUserId = null,
      relatedPostId = null,
      relatedCommentId = null,
      description = "",
      activityId = null
    } = extra;

    // 🧩 Step 1: Avoid duplicate rewards for the same action
    if (activityId) {
      const existing = await CoinTransaction.findOne({ activityId });
      if (existing) {
        console.log(`⚠️ Reward skipped — activity ${activityId} already rewarded.`);
        return;
      }
    }

    // 🪙 Step 2: Ensure coin supply document exists
    await CoinSupply.findByIdAndUpdate(
      "YENKASA_SUPPLY",
      { $setOnInsert: { totalMinted: 0 } },
      { upsert: true }
    );

    // 🧮 Step 3: Update coin supply (if within cap)
    const updatedSupply = await CoinSupply.findOneAndUpdate(
      {
        _id: "YENKASA_SUPPLY",
        totalMinted: { $lte: MAX_SUPPLY - amount }
      },
      { $inc: { totalMinted: amount } },
      { new: true }
    );

    if (!updatedSupply) {
      console.warn("⚠️ Not enough supply to mint more coins");
      return;
    }

    // 👤 Step 4: Find user
    const user = await User.findById(userId);
    if (!user) {
      console.warn("⚠️ User not found for rewardCoins()");
      return;
    }

    // 💰 Step 5: Update user balance
    const before = user.coinsBalance || 0;
    user.coinsBalance += amount;
    await user.save();

    // 🧾 Step 6: Record transaction
    await CoinTransaction.create({
      fromUserId,
      toUserId: user._id,
      amount,
      type: actionType,
      description: description || `Rewarded for ${actionType}`,
      relatedPostId,
      relatedCommentId,
      activityId,
      transactionId: uuidv4(),
      toUserBalanceBefore: before,
      toUserBalanceAfter: user.coinsBalance,
      status: "completed"
    });

    console.log(`✅ Rewarded ${amount} coins to ${user.username} for ${actionType}`);
  } catch (err) {
    console.error("❌ Error rewarding coins:", err);
  }
}

/* ------------------------------------
 * 👍 LIKE / UNLIKE POST (Fixed)
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

    // Reward coins only if newly liked
    if (!alreadyLiked) {
      try {
        console.log("🏅 Rewarding user:", userId);
        await rewardCoins(userId, "REWARD_LIKE", 10, req.params.postId);
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


/* ------------------------------------
 * 🧩 GET ALL APPROVED POSTS (with like status)
 * ------------------------------------ */
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("📥 Fetching approved posts for user:", userId);

    const posts = await Post.find({ status: "approved", isActive: true })
      .populate("userId", "username profileImage")
      .select("userId content image likes likeCount comments createdAt") // ✅ include likeCount explicitly
      .sort({ createdAt: -1 })
      .lean();

    if (!posts.length) {
      console.log("⚠️ No approved posts found.");
      return res.status(200).json([]);
    }

    const result = posts.map((post) => {
      const likedByUser = post.likes?.some(
        (like) => like.toString() === userId?.toString()
      );

      const computedLikeCount = post.likeCount ?? post.likes?.length ?? 0;

      console.log(`🧾 Post ${post._id} → likes: ${post.likes?.length}, likeCount: ${computedLikeCount}, likedByUser: ${likedByUser}`);

      return {
        ...post,
        likeCount: computedLikeCount,
        likedByUser,
      };
    });

    console.log(`✅ Returning ${result.length} posts with like info`);
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error fetching posts:", err);
    res.status(500).json({
      message: "Failed to fetch posts",
      error: err.message,
    });
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

    const comment = await Comment.create({ user: userId, post: postId, text: text.trim() });
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
    await comment.populate("user", "_id username profileImage");

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
    await rewardCoins(req.user.id, "view", 10, req.params.postId);
    res.json({ viewsCount: post.viewsCount });
  } catch (err) {
    console.error("❌ Error updating view count:", err);
    res.status(500).json({ error: "Failed to update view count" });
  }
});

/* ------------------------------------
 * 🤝 FOLLOW / UNFOLLOW USER (FIXED)
 * ------------------------------------ */
router.post("/toggle-follow/:targetUserId", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const targetUserId = req.params.targetUserId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (userId === targetUserId)
      return res.status(400).json({ message: "Cannot follow yourself" });

    const user = await User.findById(userId).select("following coinsBalance username");
    const target = await User.findById(targetUserId).select("followers username");

    if (!user || !target) return res.status(404).json({ message: "User not found" });

    const isFollowing = user.following.some((id) => id.toString() === targetUserId);

    if (isFollowing) {
      await Promise.all([
        User.findByIdAndUpdate(userId, { $pull: { following: targetUserId } }),
        User.findByIdAndUpdate(targetUserId, { $pull: { followers: userId } }),
      ]);
    } else {
      await Promise.all([
        User.findByIdAndUpdate(userId, { $addToSet: { following: targetUserId } }),
        User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: userId } }),
      ]);
      await rewardCoins(userId, "follow", 10, targetUserId);
    }

    // Refresh counts
    const [updatedUser, updatedTarget] = await Promise.all([
      User.findById(userId).select("following"),
      User.findById(targetUserId).select("followers"),
    ]);

    const followingCount = updatedUser.following.length;
    const followersCount = updatedTarget.followers.length;

    await Promise.all([
      User.findByIdAndUpdate(userId, { followingCount }),
      User.findByIdAndUpdate(targetUserId, { followersCount }),
    ]);

    const refreshed = await User.findById(userId).select("coinsBalance");

    res.status(200).json({
      message: isFollowing ? "Unfollowed user" : "Followed user",
      followingCount,
      followersCount,
      coinsBalance: refreshed.coinsBalance,
    });
  } catch (err) {
    console.error("❌ Error in toggle-follow:", err);
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
      isDeleted: false,
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
 * 📰 FEED FROM FOLLOWED USERS
 * ------------------------------------ */

router.post("/block/:targetUserId", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const targetUserId = req.params.targetUserId;
    const user = await User.findById(userId).select("blocked");
    const target = await User.findById(targetUserId).select("_id");

    if (!user || !target) return res.status(404).json({ message: "User not found" });

    const alreadyBlocked = user.blocked.some((id) => id.toString() === targetUserId);
    const update = alreadyBlocked
      ? { $pull: { blocked: target._id } }
      : { $addToSet: { blocked: target._id } };

    await User.findByIdAndUpdate(userId, update, { new: true });

    // Return user IDs instead of count
    res.status(200).json({
      message: alreadyBlocked ? "User unblocked" : "User blocked",
      userId: userId,
      blockedUserId: targetUserId
    });
  } catch (err) {
    console.error("❌ Error in block/unblock:", err);
    res.status(500).json({ message: "Failed to block/unblock", error: err.message });
  }
});

module.exports = router;
