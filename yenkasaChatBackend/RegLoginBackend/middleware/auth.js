// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // <--- IMPORT YOUR USER MODEL

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
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
    console.warn('Auth Middleware: Authorization header format is incorrect. Expected "Bearer <token>". Received:', authHeader);
    return res.status(401).json({ success: false, message: 'Access denied. Token is missing or header format is incorrect.' });
  }

  const token = parts[1];
  console.log(`AUTH_DEBUG: Received token: ${token}`);

  // ... (your existing pre-verification logging can stay) ...
  const serverTimestampBeforeVerify = Date.now();
  const serverDateBeforeVerify = new Date(serverTimestampBeforeVerify).toISOString();
  let tokenIatISO = 'N/A', tokenExpISO = 'N/A', tokenUserIdFromDecode = 'N/A';

  try {
    const preDecoded = jwt.decode(token);
    if (preDecoded && typeof preDecoded === 'object') {
      if (preDecoded.iat) tokenIatISO = new Date(preDecoded.iat * 1000).toISOString() + ` (Epoch: ${preDecoded.iat})`;
      if (preDecoded.exp) tokenExpISO = new Date(preDecoded.exp * 1000).toISOString() + ` (Epoch: ${preDecoded.exp})`;
      if (typeof preDecoded.userId !== 'undefined') tokenUserIdFromDecode = preDecoded.userId;
    } else {
        console.log('AUTH_DEBUG: jwt.decode() returned null or not an object.');
    }
    console.log(`AUTH_DEBUG: Attempting jwt.verify. Current Server Time: ${serverDateBeforeVerify} (Epoch_ms: ${serverTimestampBeforeVerify}). Pre-decoded Token Details -> UserID: ${tokenUserIdFromDecode}, IssuedAt: ${tokenIatISO}, ExpiresAt: ${tokenExpISO}`);


    const decodedPayload = jwt.verify(token, JWT_SECRET);
    console.log('AUTH_DEBUG: jwt.verify SUCCESS. Decoded JWT payload:', decodedPayload);

    if (!decodedPayload || typeof decodedPayload.userId === 'undefined') {
      console.error('Auth Middleware Critical Error: userId NOT FOUND or is undefined in successfully verified JWT payload.');
      return res.status(401).json({ success: false, message: 'Invalid token: User identifier (userId) missing in token payload.' });
    }

    // --- START: MODIFICATION TO FETCH USER ---
    const userFromDb = await User.findById(decodedPayload.userId).select('-password'); // Exclude password
    // You can be more specific with .select('username _id someOtherField') if needed

    if (!userFromDb) {
      console.warn(`Auth Middleware: User with ID ${decodedPayload.userId} from token not found in database.`);
      return res.status(401).json({ success: false, message: 'Access denied. User associated with token not found.' });
    }

    req.user = userFromDb; // Attach the full user object (or selected fields)
    // Now req.user will have .id (which is ._id from MongoDB), .username, etc.
    console.log(`Auth Middleware: User authenticated. Attached user object to req.user. User ID: ${req.user.id}, Username: ${req.user.username}`);
    // --- END: MODIFICATION TO FETCH USER ---

    next();

  } catch (err) {
    // ... (your existing error logging and handling can stay) ...
    const serverTimestampAtError = Date.now();
    const serverDateAtError = new Date(serverTimestampAtError).toISOString();
    console.error(`AUTH_DEBUG: jwt.verify FAILED or DB lookup failed. Server Time At Error: ${serverDateAtError} (Epoch_ms: ${serverTimestampAtError}). Error Name: ${err.name}. Error Message: ${err.message}.`);
    if (err.name === 'TokenExpiredError' && err.expiredAt) {
        console.error(`AUTH_DEBUG: TokenExpiredError details - expiredAt: ${new Date(err.expiredAt).toISOString()}`);
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access denied. Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Access denied. Token is invalid.' });
    }
    // Generic error for other cases, including the user not found in DB from our modification
    return res.status(401).json({ success: false, message: 'Access denied. Could not verify token or user.' });
  }
};
