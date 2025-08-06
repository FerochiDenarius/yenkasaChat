const nodemailer = require('nodemailer');
const crypto = require('crypto'); // For generating a reset token
const User = require('../models/user.model');

// Ensure dotenv is loaded if this file is run standalone or early
// require('dotenv').config(); // Typically done in server.js

// CORRECTED TRANSPORTER CONFIGURATION
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10), // Convert to number, default to 587 if not set
    secure: process.env.SMTP_SECURE === 'true',         // Evaluates to true if SMTP_SECURE is 'true', else false
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    logger: true, // Enable logging for debugging SMTP connection
    debug: true   // Enable debug output for SMTP connection
});

const sendPasswordResetEmail = async (req, res) => {
    console.log(`--- [CONTROLLER DEBUG ${new Date().toISOString()}] --- forgotPassword route handler ---`);
    const { email } = req.body;

    if (!email) {
        console.log(`--- [CONTROLLER VALIDATION] Email not provided in request body ---`);
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        console.log(`--- [CONTROLLER INFO] Searching for user with email: ${email} ---`);
        const user = await User.findOne({ email: email.toLowerCase() }); // Search with lowercase email for consistency

        if (!user) {
            // IMPORTANT: For security, don't reveal if an email exists or not.
            // Send a generic success message to prevent user enumeration.
            console.log(`--- [CONTROLLER WARN] Attempt to reset password for non-existent or unverified email: ${email} ---`);
            return res.status(200).json({ message: "If an account with that email exists and is verified, a password reset link has been sent." });
        }

        // Optional: Check if the user's email is verified if you have such a system
        // if (!user.isVerified) {
        //     console.log(`--- [CONTROLLER WARN] Attempt to reset password for unverified email: ${email} ---`);
        //     return res.status(200).json({ message: "Please verify your email address first. If an account with that email exists and is verified, a password reset link has been sent." });
        // }

        console.log(`--- [CONTROLLER INFO] User found: ${user.username}. Generating reset token... ---`);
        // 1. Generate a Reset Token
        const resetToken = crypto.randomBytes(32).toString('hex');
        // Store the HASHED token in the database for security
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000; // Token expires in 1 hour (3600000 ms)

        await user.save();
        console.log(`--- [CONTROLLER INFO] Reset token generated and user ${user.username} saved to DB. ---`);

        // 2. Create Reset URL for the email (uses the PLAIN token)
        // This URL should point to your frontend page that handles the token
        // e.g., https://yenkasa.xyz/reset-password-form?token=PLAINTEXTTOKEN
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password-page.html?token=${resetToken}`; // Using your .env variable for frontend URL
                                                                                              // and assuming a page like reset-password-page.html
                                                                                              // The token here is the *unhashed* one.

        // 3. Configure Email Options
        const mailOptions = {
            from: process.env.EMAIL_FROM || `"YenkasaChat" <${process.env.EMAIL_USER}>`, // Use EMAIL_FROM from .env
            to: user.email,
            subject: 'Password Reset Request for YenkasaChat',
            html: `<p>Hello ${user.username || 'there'},</p>
                   <p>You are receiving this email because you (or someone else) have requested the reset of the password for your YenkasaChat account.</p>
                   <p>Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>
                   <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                   <p>Thanks,<br/>The YenkasaChat Team</p>`,
            text: `Hello ${user.username || 'there'},\n\nYou are receiving this email because you (or someone else) have requested the reset of the password for your YenkasaChat account.\nPlease click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n\nThanks,\nThe YenkasaChat Team`
        };

        // 4. Send the Email
        console.log(`--- [CONTROLLER INFO] Attempting to send password reset email to: ${user.email} via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} ---`);
        console.log(`--- [CONTROLLER INFO] Using auth user: ${process.env.EMAIL_USER} ---`); // For debugging SMTP auth

        await transporter.sendMail(mailOptions);
        console.log(`--- [CONTROLLER SUCCESS] Password reset email sent successfully to: ${user.email}. Message ID: ${info.messageId} ---`);

        return res.status(200).json({ message: "If an account with that email exists and is verified, a password reset link has been sent." });

    } catch (error) {
        console.error(`--- [CONTROLLER ERROR] Error in sendPasswordResetEmail for ${email}: ${error.message} ---`);
        if (error.responseCode === 535) { // Specific check for authentication failure
            console.error("--- [CONTROLLER SMTP ERROR] Authentication failed with SMTP server. Check EMAIL_USER and EMAIL_PASS credentials. ---");
        } else if (error.code === 'ECONNECTION') {
            console.error("--- [CONTROLLER SMTP ERROR] Could not connect to SMTP server. Check SMTP_HOST and SMTP_PORT. ---");
        }
        console.error(error.stack); // Full stack trace

        // It's generally better not to expose detailed error messages to the client for security.
        return res.status(500).json({ message: "An error occurred. Please try again later." });
    }
};

module.exports = {
    sendPasswordResetEmail
};
