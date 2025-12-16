console.log("<<<<< EMAIL VERIFICATION CONTROLLER LOADED >>>>>");

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/* ==============================
   ⚙️ CONFIG
================================ */
const CODE_LIFETIME_SECONDS = Number(process.env.EMAIL_CODE_LIFETIME || 180);
const RESEND_COOLDOWN_SECONDS = Number(process.env.EMAIL_RESEND_COOLDOWN || 60);
const MAX_VERIFY_ATTEMPTS = 5;

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
   🧰 HELPERS
================================ */
const nowISO = () => new Date().toISOString();

const hashCode = (code) =>
  crypto.createHash('sha256').update(code).digest('hex');

/* ==============================
   📩 REQUEST EMAIL CODE
================================ */
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const now = Date.now();

    console.log(`[${nowISO()}] 📩 Email verification code REQUESTED | userId=${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      console.log(`[${nowISO()}] ❌ User not found | userId=${userId}`);
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: 'No email associated with this account.',
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email already verified.',
      });
    }

    // ⛔ Cooldown check
    if (user.emailVerificationCooldown && user.emailVerificationCooldown.getTime() > now) {
      const remaining = Math.ceil(
        (user.emailVerificationCooldown.getTime() - now) / 1000
      );

      console.log(
        `[${nowISO()}] ⏳ Resend blocked (cooldown ${remaining}s) | userId=${userId}`
      );

      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another code.',
        retryAfterSeconds: remaining,
      });
    }

    // 🔐 Generate code
    const plainCode = crypto.randomInt(100000, 999999).toString();
    const hashed = hashCode(plainCode);

    user.emailVerificationCode = hashed;
    user.emailVerificationExpires = new Date(now + CODE_LIFETIME_SECONDS * 1000);
    user.emailVerificationCooldown = new Date(now + RESEND_COOLDOWN_SECONDS * 1000);
    user.emailVerificationAttempts = 0;

    await user.save();

    console.log(
      `[${nowISO()}] 🔐 Code GENERATED | userId=${userId} | expiresAt=${user.emailVerificationExpires.toISOString()}`
    );

    await transporter.sendMail({
      from: `"Yenkasa Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Yenkasa Email Verification Code',
      html: `
        <p>Hello ${user.username?.replace(/[<>]/g, '') || 'User'},</p>
        <p>Your verification code is:</p>
        <h2>${plainCode}</h2>
        <p>This code expires in ${CODE_LIFETIME_SECONDS / 60} minutes.</p>
      `,
      text: `Your Yenkasa verification code is ${plainCode}. It expires in ${CODE_LIFETIME_SECONDS / 60} minutes.`,
    });

    console.log(
      `[${nowISO()}] 📧 Code SENT | userId=${userId} | email=${user.email}`
    );

    return res.status(200).json({
      success: true,
      message: 'Verification code sent.',
      expiresInSeconds: CODE_LIFETIME_SECONDS,
    });
  } catch (err) {
    console.error(`[${nowISO()}] 💥 REQUEST ERROR`, err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

/* ==============================
   ✅ CONFIRM EMAIL CODE
================================ */
router.post('/confirm', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    console.log(`[${nowISO()}] ✅ Code CONFIRM attempt | userId=${userId}`);

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

    if (user.emailVerificationAttempts >= MAX_VERIFY_ATTEMPTS) {
      console.log(
        `[${nowISO()}] 🚫 Too many attempts | userId=${userId}`
      );
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Request a new code.',
      });
    }

    if (Date.now() > user.emailVerificationExpires.getTime()) {
      console.log(
        `[${nowISO()}] ⌛ Code EXPIRED | userId=${userId}`
      );
      return res.status(400).json({
        success: false,
        message: 'Verification code expired.',
      });
    }

    const hashedInput = hashCode(String(code).trim());

    if (hashedInput !== user.emailVerificationCode) {
      user.emailVerificationAttempts += 1;
      await user.save();

      console.log(
        `[${nowISO()}] ❌ Invalid code | userId=${userId} | attempts=${user.emailVerificationAttempts}`
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code.',
      });
    }

    // ✅ Verified
    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationCooldown = undefined;
    user.emailVerificationAttempts = 0;

    await user.save();

    console.log(
      `[${nowISO()}] 🎉 Email VERIFIED | userId=${userId}`
    );

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
    });
  } catch (err) {
    console.error(`[${nowISO()}] 💥 CONFIRM ERROR`, err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

module.exports = router;
