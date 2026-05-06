const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const UserPrivacy = require("../models/userPrivacy.model");
const SystemViolation = require("../models/systemViolation.model");
const Notification = require("../models/notifications.model");
const { SYSTEM_USER_ID } = require("../config/system");
const { canModerate } = require("../middleware/permissions");

// ────────────────────────────────────────────
// ADMIN OR SYSTEM CHECK
// ────────────────────────────────────────────
function isAdminOrSystem(user) {
  return canModerate(user) || user.id === SYSTEM_USER_ID;
}

// ────────────────────────────────────────────
// SYSTEM BLOCK USER
// ────────────────────────────────────────────
router.post("/block", auth, async (req, res) => {
  try {
    const { targetId, reason } = req.body;

    if (!isAdminOrSystem(req.user)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!targetId || !reason) {
      return res.status(400).json({ message: "targetId and reason required" });
    }

    // Update user privacy
    const privacy = await UserPrivacy.findOne({ userId: targetId });
    if (!privacy) {
      return res.status(404).json({ message: "Privacy record not found" });
    }

    privacy.systemBlocked = true;
    await privacy.save();

    // Create violation log
    const violation = await SystemViolation.create({
      userId: targetId,
      adminId: req.user.id,
      reason,
      action: "system_block",
      systemBlocked: true
    });

    // Notification
    await Notification.create({
      type: "system_block",
      senderId: SYSTEM_USER_ID,
      receiverId: targetId,
      message: `Your account has been restricted. Reason: ${reason}`,
      activityId: `system_block_${violation._id}`,
      targetType: "profile",
      targetId: SYSTEM_USER_ID
    });

    return res.json({ success: true, message: "User system-blocked", violation });

  } catch (err) {
    console.error("SYSTEM BLOCK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ────────────────────────────────────────────
// SYSTEM UNBLOCK USER
// ────────────────────────────────────────────
router.post("/unblock", auth, async (req, res) => {
  try {
    const { targetId, reason } = req.body;

    if (!isAdminOrSystem(req.user)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const privacy = await UserPrivacy.findOne({ userId: targetId });
    if (!privacy) return res.status(404).json({ message: "Privacy doc not found" });

    privacy.systemBlocked = false;
    await privacy.save();

    const violation = await SystemViolation.create({
      userId: targetId,
      adminId: req.user.id,
      reason: reason || "System unblock",
      action: "system_unblock",
      systemBlocked: false
    });

    // Notify the user
    await Notification.create({
      type: "system_unblock",
      senderId: SYSTEM_USER_ID,
      receiverId: targetId,
      message: "Your account restrictions have been removed.",
      activityId: `system_unblock_${violation._id}`,
      targetType: "profile",
      targetId: SYSTEM_USER_ID
    });

    res.json({ success: true, message: "User system-unblocked", violation });

  } catch (err) {
    console.error("SYSTEM UNBLOCK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ────────────────────────────────────────────
// SYSTEM WARNING (Optional Feature)
// ────────────────────────────────────────────
router.post("/warning", auth, async (req, res) => {
  try {
    const { targetId, reason } = req.body;

    if (!isAdminOrSystem(req.user)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const violation = await SystemViolation.create({
      userId: targetId,
      adminId: req.user.id,
      reason,
      action: "warning"
    });

    await Notification.create({
      type: "system_warning",
      senderId: SYSTEM_USER_ID,
      receiverId: targetId,
      message: `Warning: ${reason}`,
      activityId: `system_warning_${violation._id}`,
      targetType: "profile",
      targetId: SYSTEM_USER_ID
    });

    res.json({ success: true, message: "Warning sent", violation });

  } catch (err) {
    console.error("SYSTEM WARNING ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
