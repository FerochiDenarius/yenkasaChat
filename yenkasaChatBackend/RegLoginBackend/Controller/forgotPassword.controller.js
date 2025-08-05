    const nodemailer = require('nodemailer');
    const crypto = require('crypto'); // For generating a reset token
    const User = require('../models/user.model'); 
   
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,        // e.g., smtp.sendgrid.net or smtp.gmail.com
    port: process.env.SMTP_PORT || 465, // 587 for TLS, 465 for SSL
    secure: true,                      // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

    const sendPasswordResetEmail = async (req, res) => {
        console.log(`--- [CONTROLLER DEBUG ${new Date().toISOString()}] --- forgotPassword ---`);
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        try {
            const user = await User.findOne({ email });
            if (!user) {
                // IMPORTANT: For security, don't reveal if an email exists or not.
                // Send a generic success message to prevent user enumeration.
                console.log(`--- [CONTROLLER WARN] Attempt to reset password for non-existent email: ${email} ---`);
                return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
            }

            // 1. Generate a Reset Token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            const passwordResetExpires = Date.now() + 3600000; // Token expires in 1 hour

            user.passwordResetToken = passwordResetToken;
            user.passwordResetExpires = passwordResetExpires;
            await user.save(); // Make sure to handle potential errors from save()

            // 2. Create Reset URL (adjust your frontend URL)
            // This URL should point to a page on your frontend where the user can enter a new password.
            // Example: http://yourfrontend.com/reset-password/THE_TOKEN_YOU_GENERATED
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`; // Store FRONTEND_URL in env

            // 3. Configure Email Options
            const mailOptions = {
                from: `"Your App Name" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`, // Sender address (verified with your email provider)
                to: user.email,
                subject: 'Password Reset Request',
                html: `<p>You are receiving this email because you (or someone else) have requested the reset of a password for your account.</p>
                       <p>Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:</p>
                       <p><a href="${resetUrl}">${resetUrl}</a></p>
                       <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`
                // You can also use a 'text' field for a plain-text version
            };

            // 4. Send the Email
            console.log(`--- [CONTROLLER DEBUG] Attempting to send password reset email to: ${user.email} ---`);
            await transporter.sendMail(mailOptions);
            console.log(`--- [CONTROLLER INFO] Password reset email sent successfully to: ${user.email} ---`);

            return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });

        } catch (error) {
            console.error(`--- [CONTROLLER ERROR] Error in sendPasswordResetEmail for ${email}: ${error.message} ---`);
            console.error(error.stack);
            
            return res.status(500).json({ message: "An error occurred while attempting to send the password reset email. Please try again later." });
        }
    };

    module.exports = {
        sendPasswordResetEmail
    };
    