// routes/auth/resetPassword.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../../models/user.model');

router.post('/', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password required' });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

module.exports = router;
