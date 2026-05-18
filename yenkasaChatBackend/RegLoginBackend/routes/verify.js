const jwt = require('jsonwebtoken');
const router = require('express').Router();
const User = require('../models/user.model'); 
const { auditSecurityEvent } = require('../utils/securityAudit');

// ✅ POST /api/auth/refresh-token
router.post('/', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    auditSecurityEvent('refresh_missing_token', req);
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    // ✅ Verify refresh token with the REFRESH secret
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user || user.refreshToken !== refreshToken) {
      auditSecurityEvent('refresh_token_mismatch', req, { tokenUserId: userId });
      if (user) {
        user.lastAuthAnomalyAt = new Date();
        await user.save();
      }
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const tokenIssuedAtMs = decoded.iat ? Number(decoded.iat) * 1000 : null;
    const revocationDates = [
      user.sessionRevokedAt,
      user.refreshTokenRevokedAt
    ].filter(Boolean).map((date) => new Date(date).getTime()).filter(Number.isFinite);
    const revokedAfterMs = revocationDates.length ? Math.max(...revocationDates) : null;

    if (tokenIssuedAtMs && revokedAfterMs && tokenIssuedAtMs < revokedAfterMs) {
      auditSecurityEvent('refresh_revoked_token_used', req, {
        tokenUserId: userId,
        tokenIssuedAt: new Date(tokenIssuedAtMs).toISOString(),
        revokedAfter: new Date(revokedAfterMs).toISOString()
      });
      user.lastAuthAnomalyAt = new Date();
      await user.save();
      return res.status(403).json({ message: 'Session has been revoked' });
    }

    // ✅ Issue new tokens
    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_EXPIRES_IN || '120d' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_EXPIRES_IN || '120d' }
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
      auditSecurityEvent('refresh_token_expired', req);
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    auditSecurityEvent('refresh_token_invalid', req, { reason: err.message });
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

module.exports = router;
