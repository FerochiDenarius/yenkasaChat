const express = require("express");
const router = express.Router();

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
    const user = await User.findById(req.user.id);
    if (!canApprove(user.roleName)) return res.status(403).json({ error: "Not authorized" });

    const approvalEntry = await PostApproval.findById(req.params.id);
    if (!approvalEntry) return res.status(404).json({ error: "Approval item not found" });

    const post = await Post.findByIdAndUpdate(
      approvalEntry.post,
      { status: "approved" },
      { new: true }
    );

    approvalEntry.status = "approved";
    await approvalEntry.save();

    const owner = await User.findById(post.userId);

    if (owner) {
      const activityId = `post_approved_${post._id}`;

      // In-app notification
      await sendNotification({
        type: "post_approved",
        senderId: req.user.id,
        receiverId: owner._id,
        activityId,
        message: "Your post has been approved!"
      });

      // Reward 10 YKC
      await rewardService.reward(owner._id, 10, {
        type: "REWARD_POST_APPROVAL",
        description: "Your post was approved",
        relatedPostId: post._id,
        activityId
      });

      // Push notification
      if (owner.oneSignalPlayerId) {
        const payload = {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_player_ids: [owner.oneSignalPlayerId],
          headings: { en: "Post Approved 🎉" },
          contents: { en: "Your post has been approved and is now live!" },
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

    res.json({ success: true, message: "Post approved" });

  } catch (err) {
    console.error("❌ APPROVE ERROR:", err);
    res.status(500).json({ error: "Error approving post" });
  }
});

// ================================
// REJECT post + notify creator
// ================================
router.put("/:id/reject", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!canApprove(user.roleName)) return res.status(403).json({ error: "Not authorized" });

    const approvalEntry = await PostApproval.findById(req.params.id);
    if (!approvalEntry) return res.status(404).json({ error: "Approval item not found" });

    approvalEntry.status = "rejected";
    await approvalEntry.save();

    const post = await Post.findById(approvalEntry.post);
    const owner = await User.findById(post.userId);

    if (owner) {
      const activityId = `post_rejected_${post._id}`;

      // In-app notification
      await sendNotification({
        type: "post_rejected",
        senderId: req.user.id,
        receiverId: owner._id,
        activityId,
        message: "Your post has been rejected."
      });

      // Push notification
      if (owner.oneSignalPlayerId) {
        const payload = {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_player_ids: [owner.oneSignalPlayerId],
          headings: { en: "Post Rejected" },
          contents: { en: "Unfortunately, your post has been rejected." },
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

    res.json({ success: true, message: "Post rejected" });

  } catch (err) {
    console.error("❌ REJECT ERROR:", err);
    res.status(500).json({ error: "Error rejecting post" });
  }
});

module.exports = router;
