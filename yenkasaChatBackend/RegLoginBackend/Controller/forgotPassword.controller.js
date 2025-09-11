require('dotenv').config(); // Ensures .env variables are loaded for local development
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/user.model'); // Adjust path if necessary

// --- Nodemailer Transporter Configuration ---
// It's good practice to ensure required SMTP environment variables are present
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
for (const varName of requiredSmtpVars) {
    if (!process.env[varName]) {
        console.error(`FATAL ERROR: Missing required SMTP environment variable: ${varName}. Email functionality will be disabled.`);
        // In a real app, you might prevent the app from starting or disable email features
    }
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10), // Default to 587 if not specified
    secure: process.env.SMTP_SECURE === 'true', // Use true if port is 465, false for 587/25
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Optional: Add more robust error handling or connection testing for the transporter
    // logger: process.env.NODE_ENV === 'development', // Uncomment for nodemailer logs in dev
    // debug: process.env.NODE_ENV === 'development',  // Uncomment for nodemailer debug output in dev
});

// --- Controller Function ---
const sendPasswordResetEmail = async (req, res) => {
    const { email } = req.body;
    const controllerTag = `[FORGOT_PWD_CONTROLLER - ${new Date().toISOString()}]`;

    console.log(`${controllerTag} Received password reset request for email: ${email}`);

    if (!email || typeof email !== 'string') {
        console.warn(`${controllerTag} Validation Error: Email not provided or invalid format.`);
        return res.status(400).json({ message: 'Email is required and must be a string.' });
    }

    // It's good practice to validate the FRONTEND_URL environment variable
    if (!process.env.FRONTEND_URL || typeof process.env.FRONTEND_URL !== 'string' || !process.env.FRONTEND_URL.startsWith('http')) {
        console.error(`${controllerTag} FATAL ERROR: FRONTEND_URL environment variable is missing, invalid, or not an HTTP(S) URL. Value: [${process.env.FRONTEND_URL}]`);
        // This is a server configuration error, so we shouldn't proceed with user-facing success.
        return res.status(500).json({ message: 'Server configuration error. Unable to process password reset.' });
    }


    try {
        const lowerCaseEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: lowerCaseEmail });

        if (!user) {
            // IMPORTANT: To prevent email enumeration attacks, always return a generic success message
            // regardless of whether the user was found or not.
            // Log the attempt internally for monitoring.
            console.log(`${controllerTag} User with email "${lowerCaseEmail}" not found. Sending generic response.`);
            return res.status(200).json({
                message: 'If an account with that email exists, a password reset link has been sent.',
            });
        }

        // Optional: Implement email verification check if your system supports it
        // if (!user.isEmailVerified) {
        //     console.log(`${controllerTag} User "${user.username || user._id}" email not verified. Sending generic response.`);
        //     return res.status(200).json({
        //         message: 'If an account with that email exists and is verified, a password reset link has been sent.',
        //     });
        // }

        console.log(`${controllerTag} User "${user.username || user._id}" found. Generating reset token...`);

        // 1. Generate Plain Reset Token (for the email link)
        const plainResetToken = crypto.randomBytes(32).toString('hex');

        // 2. Hash the Token (for storing in the database)
        // This is a security measure. Never store the plain token if you can avoid it.
        const hashedResetToken = crypto.createHash('sha256').update(plainResetToken).digest('hex');

        // 3. Set Token and Expiry on User Object
        user.passwordResetToken = hashedResetToken;
        user.passwordResetExpires = Date.now() + 3600000; // Token valid for 1 hour (3,600,000 ms)

        await user.save();
        console.log(`${controllerTag} Reset token generated and user "${user.username || user._id}" saved to DB.`);

        // 4. Construct the Full Reset URL
        // Example: https://www.yourfrontend.com/reset-password?token=PLAINTEXTTOKEN
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${plainResetToken}`;
        console.log(`${controllerTag} Constructed reset URL: ${resetUrl}`);

        // 5. Prepare Email Options
        const mailOptions = {
            from: process.env.EMAIL_FROM || `"YenkasaChat Support" <${process.env.EMAIL_USER}>`, // Fallback FROM name
            to: user.email, // Use the email from the user object to ensure correct casing
            subject: 'Your YenkasaChat Password Reset Request',
            text: `Hello ${user.username || 'YenkasaChat User'},\n\n` +
                  `You requested a password reset for your YenkasaChat account.\n` +
                  `Please click the link below to set a new password. This link is valid for 1 hour:\n` +
                  `${resetUrl}\n\n` +
                  `If you did not request this password reset, please ignore this email. Your password will remain unchanged.\n\n` +
                  `Thanks,\nThe YenkasaChat Team`,
            html: `<p>Hello ${user.username || 'YenkasaChat User'},</p>` +
                  `<p>You requested a password reset for your YenkasaChat account.</p>` +
                  `<p>Please click the link below to set a new password. This link is valid for 1 hour:</p>` +
                  `<p><a href="${resetUrl}" target="_blank">Reset Your Password</a></p>` + // Added target="_blank"
                  `<p>If the link above doesn't work, copy and paste this URL into your browser:</p>` +
                  `<p>${resetUrl}</p>` +
                  `<p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>` +
                  `<p>Thanks,<br/>The YenkasaChat Team</p>`,
        };

        // 6. Send the Email
        console.log(`${controllerTag} Attempting to send password reset email to: ${user.email} via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
        // For security, avoid logging EMAIL_PASS. EMAIL_USER might be okay for debugging in dev.
        if (process.env.NODE_ENV === 'development') {
            console.log(`${controllerTag} [DEV ONLY] Using SMTP auth user: ${process.env.EMAIL_USER}`);
        }

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`${controllerTag} Password reset email sent successfully to: ${user.email}. Message ID: ${info.messageId || 'N/A'}`);
        } catch (emailError) {
            console.error(`${controllerTag} SMTP Error: Failed to send password reset email to ${user.email}. Error: ${emailError.message}`, emailError);
            // Even if email fails, from the user's perspective who requested, the initial part "worked".
            // We've logged the error. The generic message below is still appropriate.
            // If email sending is critical, you might return a 500 here, but it could confuse the user.
        }

        return res.status(200).json({
            message: 'If an account with that email exists and is verified, a password reset link has been sent.',
        });

    } catch (error) {
        // Catch all other unexpected errors
        console.error(`${controllerTag} Unexpected error during password reset process for email "${email}": ${error.message}`, error);
        // It's crucial not to expose detailed error messages to the client in production.
        return res.status(500).json({ message: 'An internal server error occurred. Please try again later.' });
    }
};

module.exports = {
    sendPasswordResetEmail,
};
