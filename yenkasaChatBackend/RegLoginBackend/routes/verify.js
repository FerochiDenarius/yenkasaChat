const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH);

// 🔒 Middleware: Verify JWT Token
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const token = authHeader.split(" ")[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};

// ✅ Token-based verification
router.post('/', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const { method } = req.body;
        console.log(`👉 Simulating verification via ${method}`);
        user.verified = true;
        await user.save();

        res.json({ message: "Verification complete", verified: true });
    } catch (err) {
        console.error("❌ Verification error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Email verification code request
router.post('/request', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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

        res.json({ message: 'Verification code sent via email', expiresAt });
    } catch (err) {
        console.error('Email send error:', err);
        res.status(500).json({ message: 'Failed to send verification code' });
    }
});

// ✅ Confirm verification code
router.post('/confirm', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Email and code are required' });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

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

// ✅ SMS verification code request
router.post('/request-phone', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    try {
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        user.verificationCode = code;
        user.codeExpiresAt = expiresAt;
        await user.save();

        await twilioClient.messages.create({
            to: phone,
            from: process.env.TWILIO_PHONE,
            body: `Your Yenkasa Chat verification code is: ${code}`,
        });

        res.json({ message: 'Verification code sent via SMS', expiresAt });
    } catch (err) {
        console.error('SMS send error:', err.message || err);
        res.status(500).json({ message: 'Failed to send verification code via SMS' });
    }
});

module.exports = router;
