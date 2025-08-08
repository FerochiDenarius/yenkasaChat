// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  process.exit(1); // Exit if secret is missing, as JWT cannot function.
}

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    console.warn('Auth Middleware: No Authorization header present.');
    return res.status(401).json({ success: false, message: 'Access denied. Authorization header missing.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    console.warn('Auth Middleware: Authorization header format is incorrect. Expected "Bearer <token>". Received:', authHeader);
    return res.status(401).json({ success: false, message: 'Access denied. Token is missing or header format is incorrect.' });
  }

  const token = parts[1];

  // --- START PHASE 1 DIAGNOSTIC LOGGING ---
  console.log(`AUTH_DEBUG: Received token: ${token}`); // Log the raw token

  const serverTimestampBeforeVerify = Date.now();
  const serverDateBeforeVerify = new Date(serverTimestampBeforeVerify).toISOString();
  let tokenIatISO = 'N/A', tokenExpISO = 'N/A', tokenUserId = 'N/A';

  try {
    // Decode just to log iat/exp/userId without verifying yet (signature/expiry not checked here)
    const preDecoded = jwt.decode(token); // Does not throw error if token is malformed, returns null
    if (preDecoded && typeof preDecoded === 'object') {
      if (preDecoded.iat) {
        tokenIatISO = new Date(preDecoded.iat * 1000).toISOString() + ` (Epoch: ${preDecoded.iat})`;
      }
      if (preDecoded.exp) {
        tokenExpISO = new Date(preDecoded.exp * 1000).toISOString() + ` (Epoch: ${preDecoded.exp})`;
      }
      if (typeof preDecoded.userId !== 'undefined') {
        tokenUserId = preDecoded.userId;
      }
    } else {
        console.log('AUTH_DEBUG: jwt.decode() returned null or not an object. Token might be malformed or not a JWT.');
    }

    console.log(`AUTH_DEBUG: Attempting jwt.verify. Current Server Time: ${serverDateBeforeVerify} (Epoch_ms: ${serverTimestampBeforeVerify}). Decoded Token Details -> UserID: ${tokenUserId}, IssuedAt: ${tokenIatISO}, ExpiresAt: ${tokenExpISO}`);
    // --- END PRE-VERIFICATION LOGGING ---

    // Verify the token using the secret from environment variables
    const decodedPayload = jwt.verify(token, JWT_SECRET); // The actual verification

    // --- POST-VERIFICATION LOGGING (SUCCESS) ---
    console.log('AUTH_DEBUG: jwt.verify SUCCESS. Decoded JWT payload:', decodedPayload);
    // --- END POST-VERIFICATION LOGGING (SUCCESS) ---

    if (!decodedPayload || typeof decodedPayload.userId === 'undefined') {
      console.error('Auth Middleware Critical Error: userId NOT FOUND or is undefined in successfully verified JWT payload. This should not happen if verify succeeded.');
      return res.status(401).json({ success: false, message: 'Invalid token: User identifier (userId) missing in token payload after verification.' });
    }

    req.user = { id: decodedPayload.userId };
    console.log(`Auth Middleware: User authenticated. Attached user ID to req.user.id: ${req.user.id}`);
    next();

  } catch (err) {
    // --- ERROR LOGGING ---
    const serverTimestampAtError = Date.now();
    const serverDateAtError = new Date(serverTimestampAtError).toISOString();
    console.error(`AUTH_DEBUG: jwt.verify FAILED. Server Time At Error: ${serverDateAtError} (Epoch_ms: ${serverTimestampAtError}). Error Name: ${err.name}. Error Message: ${err.message}.`);
    // Log additional details if available from the error object
    if (err.name === 'TokenExpiredError' && err.expiredAt) {
        console.error(`AUTH_DEBUG: TokenExpiredError details - expiredAt: ${new Date(err.expiredAt).toISOString()}`);
    }
    // --- END ERROR LOGGING ---

    // Your existing error handling
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access denied. Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Access denied. Token is invalid.' });
    }
    return res.status(401).json({ success: false, message: 'Access denied. Could not verify token.' });
  }
};
