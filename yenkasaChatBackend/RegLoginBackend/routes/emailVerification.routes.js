// <<<<< EMAIL VERIFICATION CONTROLLER - V1 >>>>>
console.log("<<<<< EMAIL VERIFICATION CONTROLLER LOADED -", new Date().toISOString(), ">>>>>");

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');


const router = express.Router();

/* ==============================
   📧 MAIL TRANSPORT (REUSED)
================================ */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =============================== // email code Request // ===============================
router.post('/request', authMiddleware, async (req, res) => {
  const user = req.user;
  const now = Date.now();
  const timestamp = new Date(now).toISOString();

  console.log(
    `[EMAIL_VERIFY][${timestamp}] Request by user ${user._id}`
  );

  if (!user.email) {
    return res.status(400).json({
      success: false,
      message: 'No email address associated with this account.',
    });
  }

  if (user.emailVerified) {
    return res.json({
      success: true,
      message: 'Email already verified.',
    });
  }

  /**
   * ⏱️ SINGLE SOURCE OF TRUTH
   * Code lifetime = 3 minutes
   */
  const CODE_LIFETIME_SECONDS = 180;

  /**
   * If a code exists and is still valid → block request
   */
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
      retryAfterSeconds: remainingSeconds, // 🔥 frontend timer
    });
  }

  /**
   * ❌ Invalidate any old code (expired or not)
   */
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;

  /**
   * 🔐 Generate NEW code
   */
  const code = crypto.randomInt(100000, 999999).toString().trim();

  user.emailVerificationCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');

  user.emailVerificationExpires = new Date(
    now + CODE_LIFETIME_SECONDS * 1000
  );

  await user.save();

  console.log(
    `[EMAIL_VERIFY][${timestamp}] New code generated`,
    {
      expiresAt: user.emailVerificationExpires.toISOString(),
    }
  );

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"Yenkasa Support" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Yenkasa Email Verification Code',
    html: `
      <p>Hello ${user.username || 'User'},</p>
      <p>Your verification code is:</p>
      <h2>${code}</h2>
      <p>This code expires in 3 minutes.</p>
      <p>— Yenkasa Team</p>
    `,
    text: `Your Yenkasa verification code is ${code}. It expires in 3 minutes.`,
  });

  res.json({
    success: true,
    message: 'Verification code sent to email.',
    expiresInSeconds: CODE_LIFETIME_SECONDS, // frontend can show countdown
  });
});



// =============================== // email code confirm// ===============================

router.post('/confirm', authMiddleware,  async (req, res) => {
  const { code } = req.body;
  const user = req.user;
  const timestamp = new Date().toISOString();

  console.log(
    `[EMAIL_VERIFY][${timestamp}] Confirm attempt by user ${user._id}`
  );

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Verification code is required.',
    });
  }

  // Already verified
  if (user.emailVerified) {
    console.log(
      `[EMAIL_VERIFY][${timestamp}] Email already verified for ${user.email}`
    );
    return res.json({
      success: true,
      message: 'Email already verified.',
    });
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpires) {
    console.warn(
      `[EMAIL_VERIFY][${timestamp}] Missing verification fields for ${user.email}`
    );
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification code.',
    });
  }

  if (user.emailVerificationExpires.getTime() < Date.now()) {
    console.warn(
      `[EMAIL_VERIFY][${timestamp}] Code expired for ${user.email}`
    );
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification code.',
    });
  }

  const hashedInputCode = crypto
    .createHash('sha256')
    .update(String(code).trim())
    .digest('hex');

  // 🔍 TEMP DEBUG (remove later)
  console.log(
    `[EMAIL_VERIFY][${timestamp}] Hash comparison`,
    {
      inputHash: hashedInputCode,
      storedHash: user.emailVerificationCode,
    }
  );

  if (hashedInputCode !== user.emailVerificationCode) {
    console.warn(
      `[EMAIL_VERIFY][${timestamp}] Code mismatch for ${user.email}`
    );
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification code.',
    });
  }

  // ✅ SUCCESS
  user.emailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;

  await user.save();

  console.log(
    `[EMAIL_VERIFY][${timestamp}] ✅ Email verified for ${user.email}`
  );

  res.json({
    success: true,
    message: 'Email verified successfully.',
  });
});



module.exports = router;
