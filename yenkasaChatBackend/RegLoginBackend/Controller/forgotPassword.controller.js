const User = require('../models/User'); // Adjust path to your User model
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const sendPasswordResetEmail = async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // For security, respond with same message
            return res.status(200).json({ message: 'If your email is registered, a password reset link has been sent.' });
        }

        const token = jwt.sign({ id: user._id }, process.env.RESET_PASSWORD_SECRET, { expiresIn: '15m' });
        const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;

        // Configure your email service
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: `"YenkasaChat Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Reset your YenkasaChat password',
            html: `
                <p>Hello ${user.username},</p>
                <p>Click the link below to reset your password. It will expire in 15 minutes.</p>
                <a href="${resetLink}">${resetLink}</a>
            `,
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'Reset email sent' });

    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ message: 'Server error. Try again later.' });
    }
};

module.exports = { sendPasswordResetEmail };
