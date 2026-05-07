const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth");
const ModerationItem = require("../models/ModerationItem.model");
const Post = require("../models/post.model");
const User = require("../models/user.model");

const { hasMinimumRole } = require("../utils/authority");

/* --------------------------------------------------
 * GET ALL PENDING MODERATION ITEMS
 * Accessible by moderator+
 * -------------------------------------------------- */
router.get("/moderation/pending", authMiddleware, async (req, res) => {
  const role = req.user;

  if (!hasMinimumRole(role, "moderator")) {
    return res.status(403).json({ error: "Insufficient privileges" });
  }

  const items = await ModerationItem.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .populate("reportedBy", "username roleName")
    .populate("targetUserId", "username email roleName")
    .populate("targetPostId", "text content caption userId mediaType imageUrl videoUrl");

  res.json({ success: true, items });
});

/* --------------------------------------------------
 * APPROVE A MODERATION ITEM
 * Admin+
 * -------------------------------------------------- */
router.post("/moderation/:id/approve", authMiddleware, async (req, res) => {
  const role = req.user;

  if (!hasMinimumRole(role, "admin")) {
    return res.status(403).json({ error: "Approval requires admin or higher" });
  }

  const item = await ModerationItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  item.status = "approved";
  item.handledBy = req.user.id;
  item.handledAt = new Date();

  await item.save();

  res.json({ success: true, message: "Moderation item approved" });
});

/* --------------------------------------------------
 * REJECT A MODERATION ITEM
 * Admin+
 * -------------------------------------------------- */
router.post("/moderation/:id/reject", authMiddleware, async (req, res) => {
  const role = req.user;

  if (!hasMinimumRole(role, "admin")) {
    return res.status(403).json({ error: "Rejection requires admin or higher" });
  }

  const item = await ModerationItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  item.status = "rejected";
  item.handledBy = req.user.id;
  item.handledAt = new Date();

  await item.save();

  res.json({ success: true, message: "Moderation item rejected" });
});

/* --------------------------------------------------
 * DELETE POST (GLOBAL) — Admin+
 * -------------------------------------------------- */
router.delete("/moderation/post/:postId", authMiddleware, async (req, res) => {
  const role = req.user;

  if (!hasMinimumRole(role, "admin")) {
    return res.status(403).json({ error: "Only admin or higher can delete posts" });
  }

  const post = await Post.findById(req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  await post.deleteOne();

  // Resolve any moderation items tied to this post
  await ModerationItem.updateMany(
    { targetPostId: post._id, status: "pending" },
    { status: "resolved", handledBy: req.user.id, handledAt: new Date() }
  );

  res.json({ success: true, message: "Post deleted by moderation action" });
});

/* --------------------------------------------------
 * SUSPEND USER — Junior Dev+
 * -------------------------------------------------- */
router.post("/moderation/user/:userId/suspend", authMiddleware, async (req, res) => {
  const role = req.user;

  if (!hasMinimumRole(role, "junior_developer")) {
    return res.status(403).json({ error: "Only developers can suspend users" });
  }

  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.isSuspended = true;
  user.suspendedAt = new Date();
  await user.save();

  await ModerationItem.updateMany(
    { targetUserId: user._id, status: "pending" },
    { status: "resolved", handledBy: req.user.id, handledAt: new Date() }
  );

  res.json({ success: true, message: "User suspended successfully" });
});

/* --------------------------------------------------
 * BLOCK USER (GLOBAL) — Junior Dev+
 * -------------------------------------------------- */
router.post("/moderation/user/:userId/block", authMiddleware, async (req, res) => {
  const role = req.user;

  if (!hasMinimumRole(role, "junior_developer")) {
    return res.status(403).json({ error: "Only developers can block users" });
  }

  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.isBlocked = true;
  await user.save();

  res.json({ success: true, message: "User globally blocked" });
});

router.post("/moderation/report/user/:userId", authMiddleware, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId).select("_id username");
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (targetUser._id.toString() === req.user.id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot report yourself" });
    }

    const existing = await ModerationItem.findOne({
      type: "user_report",
      targetUserId: targetUser._id,
      reportedBy: req.user.id,
      status: "pending"
    });

    if (existing) {
      return res.json({
        success: true,
        message: "This report is already pending review"
      });
    }

    await ModerationItem.create({
      type: "user_report",
      targetUserId: targetUser._id,
      reportedBy: req.user.id,
      reason: req.body?.reason || "User reported from profile",
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: "Report received. Our moderation team will review it."
    });
  } catch (err) {
    console.error("User report failed:", err);
    return res.status(500).json({ success: false, message: "Failed to submit report" });
  }
});

module.exports = router;
