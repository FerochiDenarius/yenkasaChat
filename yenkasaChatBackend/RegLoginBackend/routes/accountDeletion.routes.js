const express = require("express");
const router = express.Router();

const ModerationItem = require("../models/ModerationItem.model");
const User = require("../models/user.model");

router.post("/account/delete-request", async (req, res) => {
  try {
    const { email, reason } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await ModerationItem.findOne({
      type: "account_deletion",
      email: normalizedEmail,
      status: "pending"
    });

    if (existing) {
      return res.json({
        success: true,
        message: "A deletion request is already pending."
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("_id");

    await ModerationItem.create({
      type: "account_deletion",
      email: normalizedEmail,
      targetUserId: user?._id || null,
      reason: reason || "",
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message:
        "Deletion request received. It will be reviewed within 30 days."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to submit request" });
  }
});


router.post("/account/data-delete-request", async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  await ModerationItem.create({
    type: "partial_data_deletion",
    email: email.toLowerCase().trim(),
    reason: reason || "User requested partial data deletion",
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: "Your data deletion request has been received."
  });
});

module.exports = router;
