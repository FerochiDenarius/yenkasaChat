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
// ✅ Email verification code request
router.post('/request', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ⏱️ 5 minutes validity
    const CODE_LIFETIME_SECONDS = 300;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + CODE_LIFETIME_SECONDS * 1000);

    user.verificationCode = code;
    user.codeExpiresAt = expiresAt;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Yenkasa Chat" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your verification code is: ${code}`,
    });

    // ✅ RETURN TIMER INFO
    res.json({
      message: 'Verification code sent via email',
      expiresInSeconds: CODE_LIFETIME_SECONDS,
      expiresAt,
    });

  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
});



// =============================== // email code confirm// ===============================

// ✅ Confirm verification code
router.post('/confirm', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ message: 'Email and code are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.verificationCode || !user.codeExpiresAt) {
      return res.status(400).json({ message: 'No verification in progress' });
    }

    if (Date.now() > user.codeExpiresAt.getTime()) {
      return res.status(400).json({ message: 'Verification code expired' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    user.verified = true;
    user.verificationCode = null;
    user.codeExpiresAt = null;
    await user.save();

    res.json({ message: 'Account verified successfully', verified: true });

  } catch (err) {
    console.error('Confirm error:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
});




module.exports = router;
