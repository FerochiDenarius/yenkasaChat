const express = require('express');
const router = express.Router();
const User = require('../models/user.model'); // Assuming path is correct
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Initialize Twilio Client
// Using process.env.TWILIO_ACCOUNT_SID and process.env.TWILIO_AUTH as per your code
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH);

// 🔒 Middleware: Verify JWT Token
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        // It's good practice to also log failed auth attempts on the server for monitoring
        console.warn('Authentication attempt failed: Missing or malformed Bearer token.');
        return res.status(401).json({ message: "Unauthorized: Access token is missing or malformed." });
    }
    try {
        const token = authHeader.split(" ")[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        console.warn(`Authentication attempt failed: Invalid or expired token. Error: ${err.message}`);
        // Differentiate between token structure issues and expiration if possible for client feedback
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Unauthorized: Access token has expired." });
        }
        return res.status(401).json({ message: "Unauthorized: Invalid access token." });
    }
};

// ❓ Token-based verification - REVIEW IF STILL NEEDED
// This route allows an authenticated user to mark themselves verified without code.
// Consider if this is still a desired flow or if all verification should be code-based.
router.post('/set-verified', authenticate, async (req, res) => { // Renamed route for clarity
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            console.warn(`Set-verified attempt for non-existent user ID: ${req.user.id}`);
            return res.status(404).json({ message: "User not found." });
        }

        // const { method } = req.body; // 'method' seems unused here
        // console.log(`👉 User ${user.email || user.phone} manually set to verified by admin/token.`);
        
        if (user.verified) {
            return res.status(200).json({ message: "User is already verified.", verified: true });
        }

        user.verified = true;
        await user.save();
        console.log(`User ${user.email || user.id} marked as verified successfully.`);
        res.json({ message: "User marked as verified successfully.", verified: true });
    } catch (err) {
        console.error(`❌ Error in /set-verified for user ID ${req.user?.id}: ${err.message}`, err);
        res.status(500).json({ error: "Server error during verification process." });
    }
});

// --- EMAIL VERIFICATION ---

// ✅ Request Email Verification Code
router.post('/request-email-code', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email address is required.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User with this email address not found.' });
        }

        if (user.emailVerified) { // Assuming you add 'emailVerified' to your User model
            return res.status(400).json({ message: 'This email address is already verified.' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration

        user.emailVerificationCode = code; // Use specific field
        user.emailCodeExpiresAt = expiresAt; // Use specific field
        // If user.verificationCode and user.codeExpiresAt are general, ensure they aren't overwritten by phone request
        await user.save();

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587", 10), // Ensure port is an integer
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465', // true for 465, false for other ports (like 587 if using STARTTLS)
            auth: {
                user: process.env.EMAIL_USER, // no.reply@yenkasa.xyz
                pass: process.env.EMAIL_PASS, // password for no.reply@yenkasa.xyz
            },
            // Good to add timeout options
            connectionTimeout: 10000, // 10 seconds
            greetingTimeout: 10000,   // 10 seconds
            socketTimeout: 10000,     // 10 seconds
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"Yenkasa Chat" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Yenkasa Email Verification Code',
            text: `Hello ${user.username || ''},\n\nYour Yenkasa email verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe Yenkasa Team`,
            html: `<p>Hello ${user.username || ''},</p><p>Your Yenkasa email verification code is: <strong>${code}</strong></p><p>This code will expire in 10 minutes.</p><p>If you did not request this, please ignore this email.</p><p>Thanks,<br>The Yenkasa Team</p>`,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email verification code ${code} sent to ${email} via Zoho.`);
        res.json({ message: 'Verification code sent to your email address.', expiresAt });

    } catch (err) {
        console.error(`Email send error for ${email}:`, err.message, err.stack);
        if (err.responseCode) { // Nodemailer specific error info
            console.error('Nodemailer Response Code:', err.responseCode);
            console.error('Nodemailer Response:', err.response);
        }
        res.status(500).json({ message: 'Failed to send verification code. Please try again later or contact support.' });
    }
});

// ✅ Confirm Email Verification Code
router.post('/confirm-email-code', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ message: 'Email address and verification code are required.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User with this email address not found.' });
        }

        if (user.emailVerified) {
             return res.status(400).json({ message: 'This email address is already verified.' });
        }

        if (!user.emailVerificationCode || !user.emailCodeExpiresAt) {
            return res.status(400).json({ message: 'No email verification process was initiated for this account, or the code was already used.' });
        }

        if (Date.now() > user.emailCodeExpiresAt.getTime()) {
            // Clear expired code
            user.emailVerificationCode = null;
            user.emailCodeExpiresAt = null;
            await user.save();
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (user.emailVerificationCode !== code.trim()) {
            // Consider adding attempt tracking here to prevent brute-forcing
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        user.emailVerified = true;
        user.verified = true; // Set general 'verified' status as well
        user.emailVerificationCode = null;
        user.emailCodeExpiresAt = null;
        await user.save();

        console.log(`Email ${email} verified successfully for user ID ${user._id}.`);
        // Optionally, generate new JWT tokens if verification completes a signup flow
        res.json({ message: 'Email address verified successfully.', verified: true, emailVerified: true });

    } catch (err) {
        console.error(`Confirm email error for ${email}:`, err.message, err.stack);
        res.status(500).json({ message: 'Email verification confirmation failed. Please try again later.' });
    }
});


// --- PHONE VERIFICATION ---

// ✅ Request Phone SMS Verification Code
router.post('/request-phone-code', async (req, res) => {
    const { phone } = req.body; // Expecting phone in E.164 format, e.g., +12223334444
    if (!phone) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    // Basic E.164 validation (consider a library for production)
    if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone number format. Please use E.164 (e.g., +12223334444).' });
    }

    try {
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: 'User with this phone number not found.' });
        }

        if (user.phoneVerified) { // Assuming you add 'phoneVerified' to your User model
            return res.status(400).json({ message: 'This phone number is already verified.' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.phoneVerificationCode = code; // Use specific field
        user.phoneCodeExpiresAt = expiresAt; // Use specific field
        await user.save();

        await twilioClient.messages.create({
            to: phone,
            from: process.env.TWILIO_PHONE, // Using your specified env variable
            body: `Your Yenkasa Chat verification code is: ${code}. This code expires in 10 minutes.`,
        });

        console.log(`SMS verification code ${code} sent to ${phone} via Twilio.`);
        res.json({ message: 'Verification code sent to your phone number.', expiresAt });

    } catch (err) {
        console.error(`SMS send error for ${phone}:`, err.message || err, err.stack);
        if (err.status) console.error('Twilio Error Status:', err.status); // Twilio specific error info
        if (err.code) console.error('Twilio Error Code:', err.code);
        if (err.moreInfo) console.error('Twilio More Info:', err.moreInfo);
        res.status(500).json({ message: 'Failed to send SMS verification code. Please try again later or contact support.' });
    }
});

// ✅ Confirm Phone SMS Verification Code
router.post('/confirm-phone-code', async (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code) {
        return res.status(400).json({ message: 'Phone number and verification code are required.' });
    }
     if (!/^\+[1-9]\d{1,14}$/.test(phone)) { // Validate phone format again
        return res.status(400).json({ message: 'Invalid phone number format.' });
    }

    try {
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: 'User with this phone number not found.' });
        }

        if (user.phoneVerified) {
            return res.status(400).json({ message: 'This phone number is already verified.' });
        }

        if (!user.phoneVerificationCode || !user.phoneCodeExpiresAt) {
            return res.status(400).json({ message: 'No phone verification process was initiated for this account, or the code was already used.' });
        }

        if (Date.now() > user.phoneCodeExpiresAt.getTime()) {
            user.phoneVerificationCode = null;
            user.phoneCodeExpiresAt = null;
            await user.save();
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (user.phoneVerificationCode !== code.trim()) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        user.phoneVerified = true;
        // user.verified = true; // Decide if phone verification alone also sets the general 'verified' status
        user.phoneVerificationCode = null;
        user.phoneCodeExpiresAt = null;
        await user.save();

        console.log(`Phone ${phone} verified successfully for user ID ${user._id}.`);
        res.json({ message: 'Phone number verified successfully.', phoneVerified: true /*, verified: user.verified */ });

    } catch (err) {
        console.error(`Confirm phone error for ${phone}:`, err.message, err.stack);
        res.status(500).json({ message: 'Phone verification confirmation failed. Please try again later.' });
    }
});

// Remove old generic /confirm and /request routes if they are fully replaced
// The original /confirm used 'email' as identifier.
// The original /request was for email using Gmail.

module.exports = router;
