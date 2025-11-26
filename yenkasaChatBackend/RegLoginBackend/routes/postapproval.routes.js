const express = require("express");
const router = express.Router();
const PostApproval = require("../models/postapproval.model");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth.middleware");

const ALLOWED_ROLES = ["admin", "moderator", "senior_developer", "junior_developer"];

function canApprove(roleName) {
  return ALLOWED_ROLES.includes(roleName);
}

// ================================
// GET Pending Posts
// ================================
router.get("/pending", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!canApprove(user.roleName)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const pending = await PostApproval.find({ status: "pending" })
    .populate("user", "username profileImage")
    .sort({ submittedAt: -1 });

  res.json({ pending });
});

// ================================
// APPROVE post
// ================================
router.put("/:id/approve", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!canApprove(user.roleName)) return res.status(403).json({ error: "Not authorized" });

  const approvalEntry = await PostApproval.findById(req.params.id);
  if (!approvalEntry) return res.status(404).json({ error: "Approval item not found" });

  // 1️⃣ Update real Post to approved
  await Post.findByIdAndUpdate(approvalEntry.post, { status: "approved" });

  // 2️⃣ Update approval record
  approvalEntry.status = "approved";
  await approvalEntry.save();

  res.json({ success: true, message: "Post approved" });
});

// ================================
// REJECT post
// ================================
router.put("/:id/reject", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!canApprove(user.roleName)) return res.status(403).json({ error: "Not authorized" });

  const approvalEntry = await PostApproval.findById(req.params.id);
  if (!approvalEntry) return res.status(404).json({ error: "Approval item not found" });

  approvalEntry.status = "rejected";
  await approvalEntry.save();

  res.json({ success: true, message: "Post rejected" });
});

module.exports = router;
