// routes/auth/verifyResetToken.js
const express = require('express');
const router = express.Router();
const User = require('../../models/user.model');

router.get('/', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Missing token' });

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } // still valid
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    return res.status(200).json({ message: 'Valid token', userId: user._id });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
