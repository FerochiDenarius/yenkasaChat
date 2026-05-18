// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // Import User model
const { getPermissions } = require('./permissions');
const { auditSecurityEvent } = require('../utils/securityAudit');

// ✅ Use ACCESS_TOKEN_SECRET instead of JWT_SECRET
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET) {
  console.error("❌ FATAL ERROR: ACCESS_TOKEN_SECRET is not defined in environment variables.");
  process.exit(1);
}

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    console.warn('Auth Middleware: No Authorization header present.');
    auditSecurityEvent('auth_missing_header', req);
    return res.status(401).json({ success: false, message: 'Access denied. Authorization header missing.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    console.warn('Auth Middleware: Authorization header format is incorrect.');
    auditSecurityEvent('auth_malformed_header', req);
    return res.status(401).json({ success: false, message: 'Access denied. Token is missing or header format is incorrect.' });
  }

  const token = parts[1];
  const maskedToken = `${token.slice(0, 8)}...${token.slice(-6)}`;
  console.log(`AUTH_DEBUG: Received token: ${maskedToken}`);

  const serverTimestampBeforeVerify = Date.now();
  const serverDateBeforeVerify = new Date(serverTimestampBeforeVerify).toISOString();
  let tokenIatISO = 'N/A', tokenExpISO = 'N/A', tokenUserIdFromDecode = 'N/A';

  try {
    // --- Pre-decode for debugging ---
    const preDecoded = jwt.decode(token);
    if (preDecoded && typeof preDecoded === 'object') {
      if (preDecoded.iat) tokenIatISO = new Date(preDecoded.iat * 1000).toISOString() + ` (Epoch: ${preDecoded.iat})`;
      if (preDecoded.exp) tokenExpISO = new Date(preDecoded.exp * 1000).toISOString() + ` (Epoch: ${preDecoded.exp})`;
      if (typeof preDecoded.userId !== 'undefined') tokenUserIdFromDecode = preDecoded.userId;
    }
    console.log(
      `AUTH_DEBUG: Attempting jwt.verify. Current Server Time: ${serverDateBeforeVerify} ` +
      `(Epoch_ms: ${serverTimestampBeforeVerify}). Pre-decoded Token Details -> ` +
      `UserID: ${tokenUserIdFromDecode}, IssuedAt: ${tokenIatISO}, ExpiresAt: ${tokenExpISO}`
    );

    // ✅ Verify using ACCESS_TOKEN_SECRET
    const decodedPayload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    console.log('AUTH_DEBUG: jwt.verify SUCCESS. Decoded JWT payload:', decodedPayload);

    if (!decodedPayload || typeof decodedPayload.userId === 'undefined') {
      console.error('Auth Middleware: userId missing in token payload.');
      return res.status(401).json({ success: false, message: 'Invalid token: userId missing in payload.' });
    }

    // ✅ Fetch user from DB
    const userFromDb = await User.findById(decodedPayload.userId)
      .select('-password -refreshToken -emailVerificationCode -verificationCode -phoneVerificationCode -passwordResetToken -passwordResetExpires')
      .populate('role', 'role name accessRole roleName');
    if (!userFromDb) {
      console.warn(`Auth Middleware: User with ID ${decodedPayload.userId} not found in database.`);
      auditSecurityEvent('auth_user_not_found', req, { tokenUserId: decodedPayload.userId });
      return res.status(401).json({ success: false, message: 'Access denied. User not found.' });
    }

    const tokenIssuedAtMs = decodedPayload.iat ? Number(decodedPayload.iat) * 1000 : null;
    const revocationDates = [
      userFromDb.sessionRevokedAt,
      userFromDb.accessTokenRevokedAt
    ].filter(Boolean).map((date) => new Date(date).getTime()).filter(Number.isFinite);
    const revokedAfterMs = revocationDates.length ? Math.max(...revocationDates) : null;

    if (tokenIssuedAtMs && revokedAfterMs && tokenIssuedAtMs < revokedAfterMs) {
      auditSecurityEvent('auth_revoked_access_token_used', req, {
        tokenUserId: decodedPayload.userId,
        tokenIssuedAt: new Date(tokenIssuedAtMs).toISOString(),
        revokedAfter: new Date(revokedAfterMs).toISOString()
      });
      return res.status(401).json({ success: false, message: 'Access denied. Session has been revoked.' });
    }

    req.user = userFromDb;
    const permissions = getPermissions(req.user);
    req.user.rank = permissions.rank;
    req.user.permissions = permissions;
    console.log(
      `Auth Middleware: User authenticated. User ID: ${req.user.id}, Username: ${req.user.username}, Rank: ${permissions.rank}`
    );

    next();
  } catch (err) {
    const serverTimestampAtError = Date.now();
    const serverDateAtError = new Date(serverTimestampAtError).toISOString();
    console.error(
      `AUTH_DEBUG: jwt.verify FAILED. Server Time: ${serverDateAtError} ` +
      `(Epoch_ms: ${serverTimestampAtError}). Error: ${err.name} - ${err.message}`
    );

    if (err.name === 'TokenExpiredError') {
      auditSecurityEvent('auth_access_token_expired', req, { tokenUserId: tokenUserIdFromDecode });
      return res.status(401).json({ success: false, message: 'Access denied. Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      auditSecurityEvent('auth_access_token_invalid', req, { tokenUserId: tokenUserIdFromDecode, reason: err.message });
      return res.status(401).json({ success: false, message: 'Access denied. Token is invalid.' });
    }

    auditSecurityEvent('auth_access_token_verify_failed', req, { tokenUserId: tokenUserIdFromDecode, reason: err.message });
    return res.status(401).json({ success: false, message: 'Access denied. Could not verify token.' });
  }
};
