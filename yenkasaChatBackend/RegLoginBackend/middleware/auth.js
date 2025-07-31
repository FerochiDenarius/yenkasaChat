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
    console.warn('Auth Middleware: No Authorization header present.'); // More descriptive log
    return res.status(401).json({ success: false, message: 'Access denied. Authorization header missing.' });
  }

  // Check if the header starts with 'Bearer ' (case-insensitive for 'Bearer')
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    console.warn('Auth Middleware: Authorization header format is incorrect. Expected "Bearer <token>". Received:', authHeader);
    return res.status(401).json({ success: false, message: 'Access denied. Token is missing or header format is incorrect.' });
  }

  const token = parts[1];

  try {
    // Verify the token using the secret from environment variables
    const decodedPayload = jwt.verify(token, JWT_SECRET);

    // --- CRITICAL PART for req.user.id ---
    // Log the decoded payload to see its structure during debugging
    console.log('Auth Middleware: Decoded JWT payload:', decodedPayload);

    // Your JWT payload, when created during login, should contain a field like 'userId'.
    // e.g., jwt.sign({ userId: user._id, ... }, JWT_SECRET, ...);
    
    if (!decodedPayload || typeof decodedPayload.userId === 'undefined') {
      console.error('Auth Middleware: userId NOT FOUND or is undefined in decoded JWT payload.');
      return res.status(401).json({ success: false, message: 'Invalid token: User identifier (userId) missing in token payload.' });
    }

    // Set req.user to an object that explicitly has an 'id' property
    // This makes it consistent with your chat routes expecting req.user.id
    req.user = { id: decodedPayload.userId }; 


    console.log(`Auth Middleware: User authenticated. Attached user ID to req.user.id: ${req.user.id}`);
    next(); // Proceed to the next middleware or route handler

  } catch (err) {
    console.error('Auth Middleware: Token verification failed or token is invalid.', err.name, err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access denied. Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      // This can be due to malformed token, invalid signature etc.
      return res.status(401).json({ success: false, message: 'Access denied. Token is invalid.' });
    }
    // For other unexpected errors during token verification
    return res.status(401).json({ success: false, message: 'Access denied. Could not verify token.' });
  }
};
