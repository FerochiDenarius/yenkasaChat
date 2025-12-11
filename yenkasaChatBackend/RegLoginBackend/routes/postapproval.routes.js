const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const PostApproval = require("../models/postapproval.model");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth");
const { sendNotification } = require("../services/notification.service");
const rewardService = require("../services/reward.service");

const ALLOWED_ROLES = ["admin", "moderator", "senior_developer", "junior_developer"];

function canApprove(roleName) {
  return ALLOWED_ROLES.includes(roleName);
}

// Helper: fetch all approvers
async function getApprovers() {
  return User.find({
    roleName: { $in: ALLOWED_ROLES }
  }).select("_id username oneSignalPlayerId");
}

// ================================
// GET Pending Posts + Notify Admins/Mods/Developers
// ================================
router.get("/pending", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!canApprove(user.roleName)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const pending = await PostApproval.find({ status: "pending" })
    .populate({
      path: "post",
      populate: [
        { path: "userId", select: "username profileImage verified" },
        { path: "communityId", select: "displayName name" }
      ]
    })
    .populate("user", "username profileImage")
    .sort({ submittedAt: -1 });

  // Notify approvers only ONCE per post
  for (const item of pending) {
    if (!item.notifiedAdmins) {
      const approvers = await getApprovers();

      for (const moderator of approvers) {
        await sendNotification({
          type: "post_pending",
          senderId: item.user,
          receiverId: moderator._id,
          activityId: `pending_${item._id}`,
          message: "A new post is awaiting approval."
        });

        if (moderator.oneSignalPlayerId) {
          const payload = {
            app_id: process.env.ONESIGNAL_APP_ID,
            include_player_ids: [moderator.oneSignalPlayerId],
            headings: { en: "Pending Post" },
            contents: { en: "A new post is waiting for approval." },
            data: { approvalId: item._id }
          };

          await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              Authorization: `Basic ${process.env.ONESIGNAL_KEY}`
            },
            body: JSON.stringify(payload)
          });
        }
      }

      item.notifiedAdmins = true;
      await item.save();
    }
  }

  res.json({ pending });
});

// ================================
// APPROVE POST + notify + 10YKC reward
// ================================
router.put("/:id/approve", authMiddleware, async (req, res) => {
  try {
    const approver = await User.findById(req.user.id);
    if (!canApprove(approver.roleName))
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
          targetId: post._id.toString()

      });

    // ⭐ Reward post owner (their content got approved)
await rewardService.reward(owner._id, 10, {
  type: "REWARD_POST_APPROVED",
  description: "Your post was approved and you earned 10 YKC!",
  relatedPostId: post._id,
  activityId
});

// ⭐ Reward the APPROVER (their work)
await rewardService.reward(owner._id, 10, {
  type: "REWARD_POST_APPROVED",
  description: "You earned 10 YKC for your post approval",
  relatedPostId: post._id,
  activityId
});



      // 📱 Push notification
      if (owner.oneSignalPlayerId) {
        const payload = {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_player_ids: [owner.oneSignalPlayerId],
          headings: { en: "Post Approved 🎉" },
          contents: { en: "Your post is now live!" },
          data: { postId: post._id.toString() }
        };

        await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${process.env.ONESIGNAL_KEY}`
          },
          body: JSON.stringify(payload)
        });
      }
    }

    res.json({
      success: true,
      message: "Post approved",
      reward: 10
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
    if (!canApprove(approver.roleName))
      return res.status(403).json({ error: "Not authorized" });

    const approvalEntry = await PostApproval.findById(req.params.id);
    if (!approvalEntry)
      return res.status(404).json({ error: "Approval item not found" });

    approvalEntry.status = "rejected";
    await approvalEntry.save();

    const post = await Post.findById(approvalEntry.post);
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
        message: "Your post has been rejected."
      });

     // ⭐ Reward the moderator/admin who performed the rejection
await rewardService.reward(approver._id, 10, {
  type: "REWARD_POST_REJECTED",
  description: `You rejected a post by ${owner.username}`,
  relatedPostId: post._id,
  activityId
});


      // 📱 Push notification
      if (owner.oneSignalPlayerId) {
        const payload = {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_player_ids: [owner.oneSignalPlayerId],
          headings: { en: "Post Rejected" },
          contents: { en: "Your post was rejected, but you earned 10 coins." },
          data: { postId: post._id.toString() }
        };

        await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${process.env.ONESIGNAL_KEY}`
          },
          body: JSON.stringify(payload)
        });
      }
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
