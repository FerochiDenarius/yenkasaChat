// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // Import User model

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
    return res.status(401).json({ success: false, message: 'Access denied. Authorization header missing.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    console.warn(
      'Auth Middleware: Authorization header format is incorrect. ' +
      `Expected "Bearer <token>". Received: ${authHeader}`
    );
    return res.status(401).json({ success: false, message: 'Access denied. Token is missing or header format is incorrect.' });
  }

  const token = parts[1];
  console.log(`AUTH_DEBUG: Received token: ${token}`);

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
    const userFromDb = await User.findById(decodedPayload.userId).select('-password');
    if (!userFromDb) {
      console.warn(`Auth Middleware: User with ID ${decodedPayload.userId} not found in database.`);
      return res.status(401).json({ success: false, message: 'Access denied. User not found.' });
    }

    req.user = userFromDb;
    console.log(`Auth Middleware: User authenticated. User ID: ${req.user.id}, Username: ${req.user.username}`);

    next();
  } catch (err) {
    const serverTimestampAtError = Date.now();
    const serverDateAtError = new Date(serverTimestampAtError).toISOString();
    console.error(
      `AUTH_DEBUG: jwt.verify FAILED. Server Time: ${serverDateAtError} ` +
      `(Epoch_ms: ${serverTimestampAtError}). Error: ${err.name} - ${err.message}`
    );

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access denied. Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Access denied. Token is invalid.' });
    }

    return res.status(401).json({ success: false, message: 'Access denied. Could not verify token.' });
  }
};
