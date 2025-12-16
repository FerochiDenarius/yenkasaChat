// <<<<< EMAIL VERIFICATION CONTROLLER - V1 >>>>>
console.log("<<<<< EMAIL VERIFICATION CONTROLLER LOADED -", new Date().toISOString(), ">>>>>");

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user.model');

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

router.post('/request', auth, async (req, res) => {
  const user = req.user;
  const timestamp = new Date().toISOString();

  console.log(
    `[EMAIL_VERIFY][${timestamp}] Request by authenticated user ${user._id}`
  );

  if (!user.email) {
    return res.status(400).json({
      success: false,
      message: 'No email address associated with this account.',
    });
  }

  // Already verified
  if (user.emailVerified) {
    return res.json({
      success: true,
      message: 'Email already verified.',
    });
  }

  // ✅ Reuse existing valid code
  if (
    user.emailVerificationCode &&
    user.emailVerificationExpires &&
    user.emailVerificationExpires > new Date()
  ) {
    console.log(
      `[EMAIL_VERIFY][${timestamp}] Reusing existing code for ${user.email}`
    );

    return res.json({
      success: true,
      message: 'Verification code already sent. Please check your email.',
    });
  }

  // 🔐 Generate new code
  const code = crypto.randomInt(100000, 999999).toString();

  user.emailVerificationCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');

  user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);

  await user.save();

  console.log(
    `[EMAIL_VERIFY][${timestamp}] Persisted verification fields`,
    {
      codeExists: !!user.emailVerificationCode,
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
      <p>This code expires in 10 minutes.</p>
      <p>— Yenkasa Team</p>
    `,
    text: `Your Yenkasa verification code is ${code}. It expires in 10 minutes.`,
  });

  console.log(
    `[EMAIL_VERIFY][${timestamp}] Code sent to ${user.email}`
  );

  res.json({
    success: true,
    message: 'Verification code sent to email.',
  });
});


router.post('/confirm', auth, async (req, res) => {
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
