const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const PostApproval = require("../models/postapproval.model");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth");
const { sendNotification } = require("../services/notification.service");
const rewardService = require("../services/reward.service");
const { getPermissions, canApproveContent, REVIEWER_RANKS } = require("../middleware/permissions");

const ALLOWED_ROLES = REVIEWER_RANKS.map((rank) => rank.toLowerCase());
const ALLOWED_ACCESS_ROLES = [...REVIEWER_RANKS];

function canApprove(userOrRole) {
  return canApproveContent(userOrRole);
}

// Helper: fetch all approvers
async function getApprovers() {
  return User.find({
    $or: [
      { roleName: { $in: ALLOWED_ROLES } },
      { accessRole: { $in: ALLOWED_ACCESS_ROLES } }
    ]
  }).select("_id username playerId");
}

// ================================
// GET Pending Posts + Notify Admins/Mods/Developers
// ================================
router.get("/pending", authMiddleware, async (req, res) => {
  try {
  const user = await User.findById(req.user.id);
  const permissions = getPermissions(user);

  console.log("[PostApproval] pending request", {
    userId: req.user.id,
    rank: permissions.rank,
    canApprove: canApprove(user)
  });

  if (!canApprove(user)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const existingApprovalPostIds = await PostApproval.distinct("post");
  const missingApprovalPosts = await Post.find({
    status: "pending",
    _id: { $nin: existingApprovalPostIds }
  }).select("_id userId text caption textBackgroundColor imageUrl imageUrls videoUrl audioUrl createdAt");

  if (missingApprovalPosts.length > 0) {
    console.warn("[PostApproval] Backfilling missing approval rows", {
      count: missingApprovalPosts.length
    });

    const backfillOps = missingApprovalPosts
      .filter(post => post.userId)
      .map(post => ({
        updateOne: {
          filter: { post: post._id },
          update: {
            $setOnInsert: {
              post: post._id,
              user: post.userId,
              caption: post.text || post.caption || "",
              textBackgroundColor: post.textBackgroundColor || "",
              imageUrl: post.imageUrl || "",
              imageUrls: post.imageUrls || [],
              videoUrl: post.videoUrl || "",
              audioUrl: post.audioUrl || "",
              submittedAt: post.createdAt || new Date(),
              status: "pending"
            }
          },
          upsert: true
        }
      }));

    if (backfillOps.length > 0) {
      await PostApproval.bulkWrite(backfillOps);
    }
  }

  const pending = await PostApproval.find({ status: "pending" })
    .populate({
      path: "post",
      populate: [
        { path: "userId", select: "username profileImage verified roleName" },
        { path: "communityId", select: "displayName name" }
      ]
    })
    .populate("user", "username profileImage")
    .sort({ submittedAt: -1 });

  const visiblePending = [];

  // Notify approvers only ONCE per post
  for (const item of pending) {
    if (!item.post) {
      console.warn("[PostApproval] Skipping orphan approval row with missing post", {
        approvalId: item._id.toString()
      });
      continue;
    }

    visiblePending.push(item);

    if (!item.notifiedAdmins) {
      const approvers = await getApprovers();

      for (const moderator of approvers) {
        await sendNotification({
          type: "post_pending",
          senderId: item.user,
          receiverId: moderator._id,
          activityId: `pending_${item._id}`,
          message: "A new post is awaiting approval.",
          targetType: "post",
          targetId: item.post._id.toString(),
          push: true,
          pushTitle: "Pending Post",
          pushBody: "A new post is waiting for approval.",
          pushData: {
            type: "post_pending",
            approvalId: item._id.toString(),
            targetType: "post",
            targetId: item.post._id.toString(),
            postId: item.post._id.toString()
          }
        });
      }

      item.notifiedAdmins = true;
      await item.save();
    }
  }

  console.log("[PostApproval] pending response", {
    rawCount: pending.length,
    visibleCount: visiblePending.length
  });

  res.json({ pending: visiblePending });
  } catch (err) {
    console.error("❌ POST APPROVAL PENDING ERROR:", err);
    res.status(500).json({ error: "Failed to load pending posts" });
  }
});

// ================================
// APPROVE POST + notify + 10YKC reward
// ================================
router.put("/:id/approve", authMiddleware, async (req, res) => {
  try {
    const approver = await User.findById(req.user.id);
    if (!canApprove(approver))
      return res.status(403).json({ error: "Not authorized" });

    const approvalEntry = await PostApproval.findById(req.params.id);
    if (!approvalEntry)
      return res.status(404).json({ error: "Approval item not found" });

    const post = await Post.findByIdAndUpdate(
      approvalEntry.post,
      { status: "approved" },
      { new: true }
    );

    approvalEntry.status = "approved";
    await approvalEntry.save();

    const owner = await User.findById(post.userId);

    if (owner) {
      // ⭐ FINAL UUID VERSION
      const activityId = `post_approved_${post._id}_${uuidv4()}`;

      // 🔔 In-app notification
      await sendNotification({
        type: "post_approved",
        senderId: approver._id,
        receiverId: owner._id,
        activityId,
        message: "Your post has been approved!",
        targetType: "post",
        targetId: post._id.toString(),
        push: true,
        pushTitle: "Post Approved 🎉",
        pushBody: "Your post is now live!",
        pushData: {
          type: "post_approved",
          targetType: "post",
          targetId: post._id.toString(),
          activityId: post._id.toString(),
          postId: post._id.toString()
        }
      });

    // ⭐ Reward post owner (their content got approved)
await rewardService.reward(owner._id, 8, {
  type: "REWARD_POST_APPROVED",
  description: "Your post was approved and you earned 8 YKC!",
  relatedPostId: post._id,
  activityId
});

// ⭐ Reward the APPROVER (their work)
await rewardService.reward(approver._id, 8, {
  type: "REWARD_POST_APPROVED",
  description: "You earned 8 YKC for your post approval",
  relatedPostId: post._id,
  activityId
});

    }

    res.json({
      success: true,
      message: "Post approved",
      reward: 8
    });

  } catch (err) {
    console.error("❌ APPROVE ERROR:", err);
    res.status(500).json({ error: "Error approving post" });
  }
});



// ================================
// REJECT post + notify creator + 10 YKC reward
// ================================
router.put("/:id/reject", authMiddleware, async (req, res) => {
  try {
    const approver = await User.findById(req.user.id);
    if (!canApprove(approver))
      return res.status(403).json({ error: "Not authorized" });

    const approvalEntry = await PostApproval.findById(req.params.id);
    if (!approvalEntry)
      return res.status(404).json({ error: "Approval item not found" });

    const post = await Post.findByIdAndUpdate(
      approvalEntry.post,
      { status: "rejected" },
      { new: true }
    );
    if (!post)
      return res.status(404).json({ error: "Post not found" });

    approvalEntry.status = "rejected";
    await approvalEntry.save();

    const owner = await User.findById(post.userId);

    if (owner) {
      // ⭐ FINAL UUID VERSION
      const activityId = `post_rejected_${post._id}_${uuidv4()}`;

      // 🔔 In-app notification
      await sendNotification({
        type: "post_rejected",
        senderId: approver._id,
        receiverId: owner._id,
        activityId,
        message: "Your post has been rejected.",
        targetType: "post",
        targetId: post._id.toString(),
        push: true,
        pushTitle: "Post Rejected",
        pushBody: "Your post was rejected.",
        pushData: {
          type: "post_rejected",
          targetType: "post",
          targetId: post._id.toString(),
          activityId: post._id.toString(),
          postId: post._id.toString()
        }
      });

     // ⭐ Reward the moderator/admin who performed the rejection
await rewardService.reward(approver._id, 1, {
  type: "REWARD_POST_REJECTED",
  description: `You rejected a post by ${owner.username}`,
  relatedPostId: post._id,
  activityId
});

    }

    res.json({
      success: true,
      message: "Post rejected",
      reward: 10
    });

  } catch (err) {
    console.error("❌ REJECT ERROR:", err);
    res.status(500).json({ error: "Error rejecting post" });
  }
});


module.exports = router;
