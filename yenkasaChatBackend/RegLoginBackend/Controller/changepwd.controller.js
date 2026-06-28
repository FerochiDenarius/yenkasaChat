// <<<<< CONTROLLER IS V6 - TOP OF FILE - Sep 12 2025 (Example, will be dynamic) >>>>>
console.log("<<<<< CONTROLLER IS V6 - TOP OF FILE - ", new Date().toISOString(), ">>>>>");

require('dotenv').config(); // Good to have at the top if not already done by server.js
const bcrypt = require('bcryptjs'); // Assuming you use bcrypt for password hashing
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user.model'); // Ensure path is correct

// Your existing controllerTag
// Using a dynamic timestamp for the original tag might be slightly misleading if the file is cached by require,
// but it's okay for its original purpose. The V6 logs will use fresh timestamps.
const controllerTag = `[CHANGE_PWD_CONTROLLER_ORIGINAL_TAG - ${new Date().toISOString()}]`;

// --- Email provider configuration ---
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
const smtpConfigured = requiredSmtpVars.every((varName) => Boolean(process.env[varName]));
const resendConfigured = Boolean(process.env.RESEND_API_KEY);

if (!resendConfigured && !smtpConfigured) {
    console.error(`<<<<< CONTROLLER V6 - ${controllerTag} FATAL ERROR: No password reset email provider configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_PORT/EMAIL_USER/EMAIL_PASS. >>>>>`);
}
const transporter = smtpConfigured ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
}) : null;

const resetRequestSuccessMessage = 'If an account with that email exists, a password reset link has been sent.';

function normalizeOrigin(origin) {
    if (!origin || typeof origin !== 'string') return null;

    const trimmed = origin.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(trimmed)) return null;

    try {
        const parsed = new URL(trimmed);
        return parsed.origin;
    } catch {
        return null;
    }
}

function getResetLinkOrigin(req) {
    const configuredOrigin = normalizeOrigin(
        process.env.FRONTEND_URL ||
        process.env.PUBLIC_BASE_URL ||
        process.env.CLIENT_URL
    );
    if (configuredOrigin) return configuredOrigin;

    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    return normalizeOrigin(`${protocol}://${host}`) || 'https://www.yenkasa.xyz';
}

async function sendPasswordResetEmail({ to, username, resetUrl }) {
    const from = process.env.EMAIL_FROM || `"YenkasaChat Support" <${process.env.EMAIL_USER || 'no.reply@yenkasa.xyz'}>`;
    const subject = "YenkasaChat Password Reset Request";
    const html = `<p>Hello ${username || 'YenkasaChat User'},</p><p>You requested a password reset.</p><p><a href="${resetUrl}">Reset Your Password</a></p><p>${resetUrl}</p><p>If you did not request this, you can ignore this email.</p><p>Thanks,<br/>The YenkasaChat Team</p>`;
    const text = `Hello ${username || 'YenkasaChat User'},\n\nYou requested a password reset.\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n\nThanks,\nThe YenkasaChat Team`;

    if (resendConfigured) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to,
                subject,
                html,
                text,
            }),
        });

        if (!response.ok) {
            const responseText = await response.text();
            const error = new Error(`Resend email failed with status ${response.status}`);
            error.code = 'resend_send_failed';
            error.status = response.status;
            error.response = responseText;
            throw error;
        }

        return response.json();
    }

    if (!transporter) {
        const error = new Error('No password reset email provider is configured.');
        error.code = 'email_provider_not_configured';
        throw error;
    }

    return transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
    });
}


// --- Functions ---

// ✅ 1. Request password reset (send email with token)
const requestPasswordReset = async (req, res, next) => { // Added next for consistency if routes file passes it
    const currentV6Timestamp = new Date().toISOString();
    console.log(`<<<<< CONTROLLER V6 - HIT requestPasswordReset - Timestamp: ${currentV6Timestamp} >>>>>`);

    const { email } = req.body;
    // Using your original currentTimestamp for your existing logs
    const currentOriginalTimestamp = new Date().toISOString();
    console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Received password reset request for email: ${email}`);

    if (!email || typeof email !== 'string') {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Validation Error: Email not provided or invalid format.`);
        return res.status(400).json({ message: 'Email is required and must be a string.' });
    }

    if (!resendConfigured && !smtpConfigured) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] FATAL ERROR: No password reset email provider is configured. Missing SMTP vars: ${requiredSmtpVars.filter((varName) => !process.env[varName]).join(', ') || 'none'}`);
        return res.status(500).json({ message: 'Server email configuration error. Unable to send password reset email.' });
    }

    try {
        const lowerCaseEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: lowerCaseEmail });

        if (!user) {
            console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] User with email "${lowerCaseEmail}" not found. Sending generic response for security.`);
            return res.status(200).json({
                message: resetRequestSuccessMessage,
            });
        }

        const plainResetToken = crypto.randomBytes(32).toString('hex');
        const hashedResetToken = crypto.createHash('sha256').update(plainResetToken).digest('hex');
        user.passwordResetToken = hashedResetToken;
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save();
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Hashed reset token generated and user "${user.username || user._id}" saved to DB.`);

        const resetLinkOrigin = getResetLinkOrigin(req);
        const resetUrl = `${resetLinkOrigin}/reset-password?token=${plainResetToken}`;
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Constructed password reset URL for frontend origin: ${resetLinkOrigin}`);

        try {
            await sendPasswordResetEmail({
                to: user.email,
                username: user.username,
                resetUrl,
            });
        } catch (mailError) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();
            console.error(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Password reset email delivery failed; reset token cleared for user "${user.username || user._id}".`, {
                code: mailError?.code || null,
                command: mailError?.command || null,
                responseCode: mailError?.responseCode || null,
                response: mailError?.response || null,
                message: mailError?.message || 'Unknown email delivery error',
            });
            throw mailError;
        }

        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Password reset email sent successfully to: ${user.email}.`);
        res.status(200).json({ message: resetRequestSuccessMessage });

    } catch (err) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Error in requestPasswordReset for ${email}:`, err);
        console.error(`<<<<< CONTROLLER V6 - requestPasswordReset - ERROR STACK: ${err.stack} >>>>>`);
        res.status(500).json({ message: 'Error sending password reset email. Please try again later.' });
    }
};


// ✅ 2. Verify reset token
const verifyResetToken = async (req, res, next) => {
    const currentV6Timestamp = new Date().toISOString();
    console.log(`<<<<< CONTROLLER V6 - HIT verifyResetToken - Timestamp: ${currentV6Timestamp} >>>>>`);

    const { token } = req.body;
    const currentOriginalTimestamp = new Date().toISOString();
    console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Verifying reset token (plain): ${token ? token.substring(0, 10) + '...' : 'N/A'}`);

    if (!token) {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Token not provided for verification.`);
        return res.status(400).json({ message: 'Token required' });
    }

    try {
        const hashedIncomingToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: hashedIncomingToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.warn(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Token verification failed: Invalid, expired, or already used. Hashed token: ${hashedIncomingToken}`);
            return res.status(400).json({ message: 'Link is invalid or has expired.' });
        }

        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Token verified successfully for user: ${user.username || user._id}`);
        res.status(200).json({ message: 'Token is valid' });
    } catch (err) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Server error verifying token:`, err);
        console.error(`<<<<< CONTROLLER V6 - verifyResetToken - ERROR STACK: ${err.stack} >>>>>`);
        res.status(500).json({ message: 'Server error verifying token' });
    }
};


// ✅ 3. Reset password
const resetPassword = async (req, res, next) => {
    const currentV6Timestamp = new Date().toISOString(); // For V6 logs
    // V6 LOGS - VERY FIRST THING IN THE FUNCTION
    console.log(`<<<<< CONTROLLER V6 - HIT resetPassword - Timestamp: ${currentV6Timestamp} >>>>>`);

    const { token } = req.params;
    const { newPassword } = req.body;
    
    // Using your original currentTimestamp for your existing logs
    const currentOriginalTimestamp = new Date().toISOString(); 
    console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Attempting to reset password. Token from PATH: ${token ? token.substring(0, 10) + '...' : 'N/A'}, NewPassword from BODY: ${newPassword ? 'Present (length: ' + newPassword.length + ')' : 'Missing'}`);

    if (!token || !newPassword) {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Token (from path) or newPassword (from body) not provided.`);
        return res.status(400).json({ message: 'Reset token and new password are required.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] New password does not meet criteria.`);
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        console.log(`<<<<< CONTROLLER V6 - resetPassword - Attempting to hash incoming token from path: ${token ? token.substring(0,10)+'...' : 'N/A'} >>>>>`);
        const hashedIncomingToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedIncomingToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.warn(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Password reset failed: Invalid, expired, or token already used. Attempted hashed token: ${hashedIncomingToken}`);
            return res.status(400).json({ message: 'Password reset link is invalid or has expired.' });
        }

        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Token validated for user: ${user.username || user._id}. Proceeding to update password.`);
        user.password = await bcrypt.hash(newPassword, 12);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Password reset successful for user: ${user.username || user._id}.`);
        res.status(200).json({ message: 'Password has been reset successfully.' });

    } catch (err) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Error resetting password:`, err);
        console.error(`<<<<< CONTROLLER V6 - resetPassword - ERROR STACK: ${err.stack} >>>>>`); // Log stack trace for errors
        res.status(500).json({ message: 'An internal server error occurred while resetting the password. Please try again.' });
    }
};

module.exports = {
    requestPasswordReset,
    verifyResetToken,
    resetPassword
};
console.log("<<<<< CONTROLLER V6 - Module exported successfully >>>>>");
