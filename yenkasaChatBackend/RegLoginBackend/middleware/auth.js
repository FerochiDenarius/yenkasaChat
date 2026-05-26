// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // Import User model
const { getPermissions } = require('./permissions');
const { auditSecurityEvent } = require('../utils/securityAudit');
const { createLogger } = require('../src/yme/observability/logger');

// ✅ Use ACCESS_TOKEN_SECRET instead of JWT_SECRET
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const logger = createLogger('auth.middleware', {
  sourceModule: 'middleware.auth',
});

if (!ACCESS_TOKEN_SECRET) {
  logger.error('ACCESS_TOKEN_SECRET is not defined.', {
    data: {
      fatal: true,
    },
  });
  process.exit(1);
}

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    logger.track({
      message: 'Authorization header missing.',
      severity: 'WARN',
      req,
      data: {
        statusCode: 401,
      },
      event: {
        category: 'auth_event',
        eventName: 'auth_missing_header',
        severity: 'warn',
        statusCode: 401,
      },
    });
    auditSecurityEvent('auth_missing_header', req);
    return res.status(401).json({ success: false, message: 'Access denied. Authorization header missing.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    logger.track({
      message: 'Authorization header format is incorrect.',
      severity: 'WARN',
      req,
      data: {
        statusCode: 401,
      },
      event: {
        category: 'auth_event',
        eventName: 'auth_malformed_header',
        severity: 'warn',
        statusCode: 401,
      },
    });
    auditSecurityEvent('auth_malformed_header', req);
    return res.status(401).json({ success: false, message: 'Access denied. Token is missing or header format is incorrect.' });
  }

  const token = parts[1];

  const serverTimestampBeforeVerify = Date.now();
  let tokenIatISO = 'N/A', tokenExpISO = 'N/A', tokenUserIdFromDecode = 'N/A';

  try {
    // --- Pre-decode for debugging ---
    const preDecoded = jwt.decode(token);
    if (preDecoded && typeof preDecoded === 'object') {
      if (preDecoded.iat) tokenIatISO = new Date(preDecoded.iat * 1000).toISOString() + ` (Epoch: ${preDecoded.iat})`;
      if (preDecoded.exp) tokenExpISO = new Date(preDecoded.exp * 1000).toISOString() + ` (Epoch: ${preDecoded.exp})`;
      if (typeof preDecoded.userId !== 'undefined') tokenUserIdFromDecode = preDecoded.userId;
    }

    // ✅ Verify using ACCESS_TOKEN_SECRET
    const decodedPayload = jwt.verify(token, ACCESS_TOKEN_SECRET);

    if (!decodedPayload || typeof decodedPayload.userId === 'undefined') {
      logger.track({
        message: 'Token payload is missing userId.',
        severity: 'ERROR',
        req,
        data: {
          statusCode: 401,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_payload_missing_user_id',
          severity: 'error',
          statusCode: 401,
        },
      });
      return res.status(401).json({ success: false, message: 'Invalid token: userId missing in payload.' });
    }

    // ✅ Fetch user from DB
    const userFromDb = await User.findById(decodedPayload.userId)
      .select('-password -refreshToken -emailVerificationCode -verificationCode -phoneVerificationCode -passwordResetToken -passwordResetExpires')
      .populate('role', 'role name accessRole roleName');
    if (!userFromDb) {
      logger.track({
        message: 'Authenticated user was not found in the database.',
        severity: 'WARN',
        req,
        userId: decodedPayload.userId,
        data: {
          statusCode: 401,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_user_not_found',
          severity: 'warn',
          statusCode: 401,
        },
      });
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
      logger.track({
        message: 'Revoked access token was used.',
        severity: 'WARN',
        req,
        userId: decodedPayload.userId,
        data: {
          statusCode: 401,
          tokenIssuedAt: new Date(tokenIssuedAtMs).toISOString(),
          revokedAfter: new Date(revokedAfterMs).toISOString(),
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_revoked_access_token_used',
          severity: 'warn',
          statusCode: 401,
        },
      });
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

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.track({
        message: 'Access token expired.',
        severity: 'WARN',
        req,
        userId: tokenUserIdFromDecode,
        data: {
          statusCode: 401,
          tokenIssuedAt: tokenIatISO,
          tokenExpiresAt: tokenExpISO,
          serverTimestampMs: serverTimestampBeforeVerify,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_access_token_expired',
          severity: 'warn',
          statusCode: 401,
        },
      });
      auditSecurityEvent('auth_access_token_expired', req, { tokenUserId: tokenUserIdFromDecode });
      return res.status(401).json({ success: false, message: 'Access denied. Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.track({
        message: 'Access token invalid.',
        severity: 'WARN',
        req,
        userId: tokenUserIdFromDecode,
        error: err,
        data: {
          statusCode: 401,
          tokenIssuedAt: tokenIatISO,
          tokenExpiresAt: tokenExpISO,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_access_token_invalid',
          severity: 'warn',
          statusCode: 401,
        },
      });
      auditSecurityEvent('auth_access_token_invalid', req, { tokenUserId: tokenUserIdFromDecode, reason: err.message });
      return res.status(401).json({ success: false, message: 'Access denied. Token is invalid.' });
    }

    logger.track({
      message: 'Access token verification failed.',
      severity: 'ERROR',
      req,
      userId: tokenUserIdFromDecode,
      error: err,
      data: {
        statusCode: 401,
        tokenIssuedAt: tokenIatISO,
        tokenExpiresAt: tokenExpISO,
      },
      event: {
        category: 'auth_event',
        eventName: 'auth_access_token_verify_failed',
        severity: 'error',
        statusCode: 401,
      },
    });
    auditSecurityEvent('auth_access_token_verify_failed', req, { tokenUserId: tokenUserIdFromDecode, reason: err.message });
    return res.status(401).json({ success: false, message: 'Access denied. Could not verify token.' });
  }
};
