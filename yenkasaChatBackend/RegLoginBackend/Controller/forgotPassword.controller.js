const nodemailer = require('nodemailer');
const crypto = require('crypto'); // For generating a reset token
const User = require('../models/user.model');

// Ensure dotenv is loaded if this file is run standalone or early
// require('dotenv').config(); // Typically done in server.js, which is preferred

// TRANSPORTER CONFIGURATION
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === 'true', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    logger: process.env.NODE_ENV === 'development', // Enable logging only in development
    debug: process.env.NODE_ENV === 'development'   // Enable debug output only in development
});

const sendPasswordResetEmail = async (req, res) => {
    console.log(`--- [CONTROLLER DEBUG ${new Date().toISOString()}] --- forgotPassword.controller.js: sendPasswordResetEmail handler ---`);
    const { email } = req.body;

    if (!email) {
        console.log(`--- [CONTROLLER VALIDATION] Email not provided in request body ---`);
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        const lowerCaseEmail = email.toLowerCase();
        console.log(`--- [CONTROLLER INFO] Searching for user with email: ${lowerCaseEmail} ---`);
        const user = await User.findOne({ email: lowerCaseEmail });

        if (!user) {
            console.log(`--- [CONTROLLER WARN] Attempt to reset password for non-existent or unverified email: ${lowerCaseEmail} ---`);
            return res.status(200).json({ message: "If an account with that email exists and is verified, a password reset link has been sent." });
        }

        // Optional: Check if the user's email is verified if you have such a system
        // if (!user.isVerified) {
        //     console.log(`--- [CONTROLLER WARN] Attempt to reset password for unverified email: ${lowerCaseEmail} ---`);
        //     return res.status(200).json({ message: "Please verify your email address first. If an account with that email exists and is verified, a password reset link has been sent." });
        // }

        console.log(`--- [CONTROLLER INFO] User found: ${user.username || user._id}. Generating reset token... ---`);
        
        // 1. Generate a Reset Token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000; // Token expires in 1 hour (3600000 ms)

        await user.save();
        console.log(`--- [CONTROLLER INFO] Reset token generated and user ${user.username || user._id} saved to DB. ---`);

        // 2. Create Reset URL for the email (uses the PLAIN token)
        // Ensure process.env.FRONTEND_URL is set to https://www.yenkasa.xyz
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        console.log(`--- [CONTROLLER INFO] Generated Reset URL: ${resetUrl} ---`);


        // 3. Configure Email Options
        const mailOptions = {
            from: process.env.EMAIL_FROM || `"YenkasaChat" <${process.env.EMAIL_USER}>`,
            to: user.email, // Use the email from the user object to ensure correct casing if needed
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
        if (process.env.NODE_ENV === 'development') { // Log auth user only in dev for security
            console.log(`--- [CONTROLLER INFO (Dev)] Using auth user: ${process.env.EMAIL_USER} ---`);
        }

        const info = await transporter.sendMail(mailOptions); // Assign result to get messageId
        console.log(`--- [CONTROLLER SUCCESS] Password reset email sent successfully to: ${user.email}. Message ID: ${info.messageId || 'N/A'} ---`);

        return res.status(200).json({ message: "If an account with that email exists and is verified, a password reset link has been sent." });

    } catch (error) {
        console.error(`--- [CONTROLLER ERROR] Error in sendPasswordResetEmail for ${email}: ${error.message} ---`);
        if (error.responseCode === 535 || (error.code && error.code.includes('AUTH'))) { // Broader check for auth errors
            console.error("--- [CONTROLLER SMTP ERROR] Authentication failed with SMTP server. Check EMAIL_USER and EMAIL_PASS credentials. Response: " + (error.response || 'N/A'));
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
            console.error("--- [CONTROLLER SMTP ERROR] Could not connect to SMTP server or connection timed out. Check SMTP_HOST and SMTP_PORT. ---");
        }
        console.error("Full error stack:", error.stack);

        return res.status(500).json({ message: "An error occurred while trying to send the password reset email. Please try again later." });
    }
};

module.exports = {
    sendPasswordResetEmail
};
