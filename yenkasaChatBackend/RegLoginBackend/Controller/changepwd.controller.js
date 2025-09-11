// Controller/changepwd.controller.js
// Assuming this file now handles the ENTIRE flow:
// 1. Requesting the password reset email
// 2. Verifying the token from the link
// 3. Setting the new password

require('dotenv').config(); // Good to have at the top if not already done by server.js
const bcrypt = require('bcryptjs'); // Assuming you use bcrypt for password hashing
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user.model'); // Ensure path is correct

const controllerTag = `[CHANGE_PWD_CONTROLLER - ${new Date().toISOString()}]`; // For logging

// --- Nodemailer Transporter Configuration (Consolidated) ---
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
for (const varName of requiredSmtpVars) {
    if (!process.env[varName]) {
        console.error(`${controllerTag} FATAL ERROR: Missing required SMTP environment variable: ${varName}. Email functionality will be disabled.`);
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
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    const currentTimestamp = new Date().toISOString(); // For consistent logging time
    console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Received password reset request for email: ${email}`);


    if (!email || typeof email !== 'string') {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Validation Error: Email not provided or invalid format.`);
        return res.status(400).json({ message: 'Email is required and must be a string.' });
    }

    // --- FIX 1: Validate and use FRONTEND_URL ---
    if (!process.env.FRONTEND_URL || typeof process.env.FRONTEND_URL !== 'string' || !process.env.FRONTEND_URL.startsWith('http')) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] FATAL ERROR: FRONTEND_URL environment variable is missing, invalid, or not an HTTP(S) URL. Value: [${process.env.FRONTEND_URL}]`);
        return res.status(500).json({ message: 'Server configuration error. Unable to process password reset.' });
    }

    try {
        const lowerCaseEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: lowerCaseEmail });

        if (!user) {
            console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] User with email "${lowerCaseEmail}" not found. Sending generic response for security.`);
            return res.status(200).json({ // Generic message for security
                message: 'If an account with that email exists, a password reset link has been sent.',
            });
        }

        // --- FIX 2: Implement Secure Token Hashing ---
        // a. Generate Plain Reset Token (for the email link)
        const plainResetToken = crypto.randomBytes(32).toString('hex');

        // b. Hash the Token (for storing in the database)
        const hashedResetToken = crypto.createHash('sha256').update(plainResetToken).digest('hex');

        // c. Set HASHED Token and Expiry on User Object
        user.passwordResetToken = hashedResetToken; // Store the HASHED token
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour expiry (3,600,000 ms)

        await user.save();
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Hashed reset token generated and user "${user.username || user._id}" saved to DB.`);

        // Build reset link (pointing to your frontend) using the PLAIN token
        // --- FIX 1 (Applied): Use FRONTEND_URL ---
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${plainResetToken}`;
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Constructed reset URL: ${resetUrl}`);


        // Send email
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || `"YenkasaChat Support" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "YenkasaChat Password Reset Request", // Clearer Subject
            html: `<p>Hello ${user.username || 'YenkasaChat User'},</p>
                   <p>You requested a password reset for your YenkasaChat account.</p>
                   <p>Please click the link below to set a new password. This link is valid for 1 hour:</p>
                   <p><a href="${resetUrl}" target="_blank">Reset Your Password</a></p>
                   <p>If the link above doesn't work, copy and paste this URL into your browser:</p>
                   <p>${resetUrl}</p>
                   <p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
                   <p>Thanks,<br/>The YenkasaChat Team</p>`,
            text: `Hello ${user.username || 'YenkasaChat User'},\n\n` +
                  `You requested a password reset for your YenkasaChat account.\n` +
                  `Please click the link below to set a new password. This link is valid for 1 hour:\n` +
                  `${resetUrl}\n\n` +
                  `If you did not request this password reset, please ignore this email. Your password will remain unchanged.\n\n` +
                  `Thanks,\nThe YenkasaChat Team`
        });

        console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Password reset email sent successfully to: ${user.email}.`);
        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (err) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Error in requestPasswordReset for ${email}:`, err);
        res.status(500).json({ message: 'Error sending password reset email. Please try again later.' });
    }
};


// ✅ 2. Verify reset token (Optional - often combined with resetPassword)
// If you keep this, it also needs to handle hashed tokens if it's meant to be a standalone check.
// However, the `resetPassword` function below will perform the necessary token validation.
const verifyResetToken = async (req, res) => {
    const { token } = req.body; // Assuming token is sent in the body for verification
    const currentTimestamp = new Date().toISOString();
    console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Verifying reset token (plain): ${token ? token.substring(0, 10) + '...' : 'N/A'}`);


    if (!token) {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Token not provided for verification.`);
        return res.status(400).json({ message: 'Token required' });
    }

    try {
        // --- FIX 2 (Applied): Hash incoming token for comparison ---
        const hashedIncomingToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedIncomingToken, // Compare against stored HASHED token
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.warn(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Token verification failed: Invalid, expired, or already used. Hashed token: ${hashedIncomingToken}`);
            return res.status(400).json({ message: 'Link is invalid or has expired.' }); // User-friendly message
        }

        console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Token verified successfully for user: ${user.username || user._id}`);
        res.status(200).json({ message: 'Token is valid' }); // Or perhaps userId or email for the next step
    } catch (err) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Server error verifying token:`, err);
        res.status(500).json({ message: 'Server error verifying token' });
    }
};


// ✅ 3. Reset password (after user clicks link and submits new password)
const resetPassword = async (req, res) => {
    // How you get the token depends on your frontend call after link click.
    // It might be in req.body if your frontend sends it in a POST request body,
    // or req.params.token if it's part of the URL path like /api/reset-password/:token
    // For consistency, let's assume it's in the body for this example, along with the new password.
    const { token, newPassword } = req.body;
    const currentTimestamp = new Date().toISOString();
    console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Attempting to reset password with token (plain): ${token ? token.substring(0, 10) + '...' : 'N/A'}`);


    if (!token || !newPassword) {
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Token or new password not provided for reset.`);
        return res.status(400).json({ message: 'Reset token and new password are required.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) { // Example validation
        console.warn(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] New password does not meet criteria.`);
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }


    try {
        // --- FIX 2 (Applied): Hash incoming token for comparison ---
        const hashedIncomingToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedIncomingToken, // Compare against stored HASHED token
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.warn(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Password reset failed: Invalid, expired, or token already used. Hashed token: ${hashedIncomingToken}`);
            return res.status(400).json({ message: 'Password reset link is invalid or has expired.' });
        }

        console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Token validated for user: ${user.username || user._id}. Proceeding to update password.`);

        // Hash the new password before saving
        user.password = await bcrypt.hash(newPassword, 12); // Use appropriate salt rounds

        // Clear the reset token fields as it's now used
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        // Optionally, if you have an emailVerified field and this action confirms it:
        // user.emailVerified = true;

        await user.save();
        console.log(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Password reset successful for user: ${user.username || user._id}.`);
        res.status(200).json({ message: 'Password has been reset successfully.' });

    } catch (err) {
        console.error(`[CHANGE_PWD_CONTROLLER - ${currentTimestamp}] Error resetting password:`, err);
        res.status(500).json({ message: 'Error resetting password. Please try again.' });
    }
};

module.exports = {
    requestPasswordReset,
    verifyResetToken, // You might not need this if resetPassword does the full validation
    resetPassword
};
