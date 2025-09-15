const jwt = require('jsonwebtoken');
const router = require('express').Router();
const User = require('../models/user.model'); 

// ✅ POST /api/auth/refresh-token
router.post('/', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    // ✅ Verify refresh token with the REFRESH secret
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // ✅ Issue new tokens
    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_EXPIRES_IN || '1h' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_EXPIRES_IN || '7d' }
    );

    // ✅ Store new refresh token in DB
    user.refreshToken = newRefreshToken;
    await user.save();

    return res.status(200).json({
      token: newAccessToken,       // ✅ matches frontend `TokenResponse`
      refreshToken: newRefreshToken
    });

  } catch (err) {
    console.error('❌ Refresh token error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

module.exports = router;
