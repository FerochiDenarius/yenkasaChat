// Controller/changepwd.controller.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user.model');

// ✅ Verify reset token (from request body)
const verifyResetToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Token required' });

  try {
    // 🔑 Hash incoming token to match stored version
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    res.status(200).json({ message: 'Token is valid' });
  } catch (err) {
    console.error('Error verifying reset token:', err);
    res.status(500).json({ message: 'Server error verifying token' });
  }
};

// ✅ Reset password (token comes from URL params)
const resetPassword = async (req, res) => {
  const { token } = req.params; 
  const { newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password required' });
  }

  try {
    // 🔑 Hash incoming token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // ✅ Hash new password
    user.password = await bcrypt.hash(newPassword, 10);

    // Clear reset fields
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();
    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ message: 'Error resetting password' });
  }
};

module.exports = {
  verifyResetToken,
  resetPassword
};
