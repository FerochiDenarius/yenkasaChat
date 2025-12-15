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

/* ==============================
   1️⃣ REQUEST EMAIL VERIFICATION
   POST /api/email-verification/request
================================ */
router.post('/request', async (req, res) => {
  const { email } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[EMAIL_VERIFY][${timestamp}] Request received for:`, email);

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Valid email is required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // SECURITY: Do not reveal existence
      return res.status(200).json({
        message: 'If an account exists, a verification code has been sent.',
      });
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    user.emailVerificationCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Yenkasa Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Yenkasa Email Verification Code',
      html: `
        <p>Hello ${user.username || 'User'},</p>
        <p>Your verification code is:</p>
        <h2>${code}</h2>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
        <p>— Yenkasa Team</p>
      `,
      text: `Your Yenkasa verification code is ${code}. It expires in 10 minutes.`,
    });

    console.log(`[EMAIL_VERIFY][${timestamp}] Code sent to ${user.email}`);

    res.json({
      success: true,
      message: 'Verification code sent to email',
    });

  } catch (err) {
    console.error('[EMAIL_VERIFY] ERROR:', err);
    res.status(500).json({ message: 'Failed to send verification email' });
  }
});

/* ==============================
   2️⃣ CONFIRM EMAIL VERIFICATION
   POST /api/email-verification/confirm
================================ */
router.post('/confirm', async (req, res) => {
const { email, code } = req.body;

const cleanCode = String(code).trim();
  const timestamp = new Date().toISOString();

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and code are required' });
  }

  try {
    const hashedCode = crypto
  .createHash('sha256')
  .update(cleanCode)
  .digest('hex');


  const user = await User.findOne({
  email: email.toLowerCase().trim(),
  emailVerificationCode: hashedCode,
  emailVerificationExpires: { $gt: new Date() },
});


    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification code',
      });
    }

    user.verified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log(`[EMAIL_VERIFY][${timestamp}] Email verified for ${user.email}`);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });

  } catch (err) {
    console.error('[EMAIL_VERIFY] CONFIRM ERROR:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
});

module.exports = router;
