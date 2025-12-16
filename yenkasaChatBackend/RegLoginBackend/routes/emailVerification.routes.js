console.log("<<<<< EMAIL VERIFICATION CONTROLLER LOADED >>>>>");

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/* ==============================
   📧 MAIL TRANSPORT
================================ */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ==============================
   📩 REQUEST EMAIL CODE
================================ */
router.post('/request', authMiddleware, async (req, res) => {
  const userId = req.user._id;
  const now = Date.now();

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (!user.email) {
    return res.status(400).json({
      success: false,
      message: 'No email associated with this account.',
    });
  }

  if (user.emailVerified) {
    return res.json({
      success: true,
      message: 'Email already verified.',
    });
  }

  const CODE_LIFETIME_SECONDS = 180;

  // ⛔ Prevent spam / resend abuse
  if (
    user.emailVerificationExpires &&
    user.emailVerificationExpires.getTime() > now
  ) {
    const remainingSeconds = Math.ceil(
      (user.emailVerificationExpires.getTime() - now) / 1000
    );

    return res.status(429).json({
      success: false,
      message: 'Please wait before requesting a new code.',
      retryAfterSeconds: remainingSeconds,
    });
  }

  // 🔄 Reset old code
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;

  // 🔐 Generate new code
  const code = crypto.randomInt(100000, 999999).toString();
  user.emailVerificationCode = code;
  user.emailVerificationExpires = new Date(
    now + CODE_LIFETIME_SECONDS * 1000
  );

  await user.save();

  await transporter.sendMail({
    from: `"Yenkasa Support" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Yenkasa Email Verification Code',
    html: `
      <p>Hello ${user.username || 'User'},</p>
      <p>Your verification code is:</p>
      <h2>${code}</h2>
      <p>This code expires in 3 minutes.</p>
    `,
    text: `Your Yenkasa verification code is ${code}. It expires in 3 minutes.`,
  });

  return res.json({
    success: true,
    message: 'Verification code sent.',
    expiresInSeconds: CODE_LIFETIME_SECONDS,
  });
});

/* ==============================
   ✅ CONFIRM EMAIL CODE
================================ */
router.post('/confirm', authMiddleware, async (req, res) => {
  const { code } = req.body;
  const userId = req.user._id;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Verification code is required.',
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpires) {
    return res.status(400).json({
      success: false,
      message: 'No verification in progress.',
    });
  }

  if (Date.now() > user.emailVerificationExpires.getTime()) {
    return res.status(400).json({
      success: false,
      message: 'Verification code expired.',
    });
  }

  if (String(code).trim() !== String(user.emailVerificationCode).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code.',
    });
  }

  // ✅ Verified
  user.emailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return res.json({
    success: true,
    message: 'Email verified successfully.',
  });
});

module.exports = router;
