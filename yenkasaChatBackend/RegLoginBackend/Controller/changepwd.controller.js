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

// --- Nodemailer Transporter Configuration (Consolidated) ---
// (No changes needed here, but ensure it's robust)
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
for (const varName of requiredSmtpVars) {
    if (!process.env[varName]) {
        console.error(`<<<<< CONTROLLER V6 - ${controllerTag} FATAL ERROR: Missing required SMTP environment variable: ${varName}. Email functionality will be disabled. >>>>>`);
    }
}
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


// --- Functions ---

// ✅ 1. Request password reset (send email with token)
const requestPasswordReset = async (req, res, next) => { // Added next for consistency if routes file passes it
    const currentV6Timestamp = new Date().toISOString();
    console.log(`<<<<< CONTROLLER V6 - HIT requestPasswordReset - Timestamp: ${currentV6Timestamp} >>>>>`);
    console.log(`<<<<< CONTROLLER V6 - requestPasswordReset - req.body IS: ${JSON.stringify(req.body)} >>>>>`);

    const { email } = req.body;
    // Using your original currentTimestamp for your existing logs
    const currentOriginalTimestamp = new Date().toISOString();
    console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Received password reset request for email: ${email}`);

    if (!email || typeof email !== 'string') {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Validation Error: Email not provided or invalid format.`);
        return res.status(400).json({ message: 'Email is required and must be a string.' });
    }

    if (!process.env.FRONTEND_URL || typeof process.env.FRONTEND_URL !== 'string' || !process.env.FRONTEND_URL.startsWith('http')) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] FATAL ERROR: FRONTEND_URL environment variable is missing, invalid, or not an HTTP(S) URL. Value: [${process.env.FRONTEND_URL}]`);
        return res.status(500).json({ message: 'Server configuration error. Unable to process password reset.' });
    }

    try {
        const lowerCaseEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: lowerCaseEmail });

        if (!user) {
            console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] User with email "${lowerCaseEmail}" not found. Sending generic response for security.`);
            return res.status(200).json({
                message: 'If an account with that email exists, a password reset link has been sent.',
            });
        }

        const plainResetToken = crypto.randomBytes(32).toString('hex');
        const hashedResetToken = crypto.createHash('sha256').update(plainResetToken).digest('hex');
        user.passwordResetToken = hashedResetToken;
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save();
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Hashed reset token generated and user "${user.username || user._id}" saved to DB.`);

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${plainResetToken}`;
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Constructed reset URL: ${resetUrl}`);

        await transporter.sendMail({
            from: process.env.EMAIL_FROM || `"YenkasaChat Support" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "YenkasaChat Password Reset Request",
            html: `<p>Hello ${user.username || 'YenkasaChat User'},</p><p>You requested a password reset...</p><p><a href="${resetUrl}">Reset Your Password</a></p><p>${resetUrl}</p><p>If you did not request...</p><p>Thanks,<br/>The YenkasaChat Team</p>`,
            text: `Hello ${user.username || 'YenkasaChat User'},\n\nYou requested a password reset...\n${resetUrl}\n\nIf you did not request...\n\nThanks,\nThe YenkasaChat Team`
        });

        console.log(`[CHANGE_PWD_CONTROLLER - ${currentOriginalTimestamp}] Password reset email sent successfully to: ${user.email}.`);
        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

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
    console.log(`<<<<< CONTROLLER V6 - verifyResetToken - req.body IS: ${JSON.stringify(req.body)} >>>>>`);

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
    console.log("<<<<< CONTROLLER V6 - INSIDE resetPassword (START) - req.params IS: ", JSON.stringify(req.params), ">>>>>");
    console.log("<<<<< CONTROLLER V6 - INSIDE resetPassword (START) - req.body IS: ", JSON.stringify(req.body), ">>>>>");

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
        console.log(`<<<<< CONTROLLER V6 - resetPassword - Hashed incoming token: ${hashedIncomingToken} >>>>>`);
        
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
