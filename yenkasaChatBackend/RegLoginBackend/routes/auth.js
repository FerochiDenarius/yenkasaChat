// ✅ Debug startup log
console.log("✅✅✅ routes/auth.js - File loaded by server.js ✅✅✅");

const express = require('express');
console.log("routes/auth.js - express required");
const router = express.Router();
console.log("routes/auth.js - router created");
const bcrypt = require('bcryptjs'); // Or bcrypt
console.log("routes/auth.js - bcrypt required");
const jwt = require('jsonwebtoken');
console.log("routes/auth.js - jwt required");
const User = require('../models/user.model'); // Ensure this path is correct
console.log("routes/auth.js - User model required, path: ../models/user.model");
// const { verifyResetToken, resetPassword } = require('../Controller/changepwd.controller'); // You might not need these here if they are on their own routes

// ✅ Sanitize helper
const sanitize = (val) =>
  typeof val === 'string' ? val.trim().substring(0, 255) : val;

// ✅ Environment secrets check
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.error("❌❌❌ routes/auth.js - Missing JWT_SECRET or REFRESH_TOKEN_SECRET! ❌❌❌");
  throw new Error('JWT_SECRET or REFRESH_TOKEN_SECRET is not set in environment.');
}
console.log("routes/auth.js - JWT secrets check passed");

const ACCESS_EXPIRES_IN = '1h'; // Ensure these are defined
const REFRESH_EXPIRES_IN = '7d'; // Ensure these are defined

// ✅ REGISTER
console.log("routes/auth.js - Defining POST /register route");
router.post('/register', async (req, res) => {
  // ... your existing /register route code ...
  // (No changes were made here in the previous suggestion for case-insensitive login)
  console.log("✅✅✅ /api/auth/register - ROUTE HANDLER REACHED ✅✅✅");
  let { email, phoneNumber, username, location, password } = req.body;

  try {
    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = username ? sanitize(username.toLowerCase()) : null; // Stays lowercase for registration consistency
    location = location ? sanitize(location) : null;
    password = password ? sanitize(password) : null;

    if (!username || !location || !password || (!email && !phoneNumber)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
        { username }, // Matches stored lowercase username
      ],
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      location,
      password: hashedPassword,
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
    });

    await newUser.save();
    console.log("routes/auth.js - /register: New user saved successfully.");

    res.status(201).json({
      _id: newUser._id,
      email: newUser.email,
      phoneNumber: newUser.phoneNumber,
      username: newUser.username,
      location: newUser.location,
      verified: newUser.verified,
    });

  } catch (err) {
    console.error('❌ Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected (e.g., email or username already exists)' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});


// ✅ LOGIN with Access + Refresh Token (<<<<< THIS IS THE MODIFIED SECTION)
console.log("routes/auth.js - Defining POST /login route");
router.post('/login', async (req, res) => {
  console.log("✅✅✅ /api/auth/login - ROUTE HANDLER REACHED ✅✅✅");
  const { identifier, password } = req.body;
  console.log(`routes/auth.js - /login: Received identifier: ${identifier}, password: ${password ? '******' : '[MISSING]'}`);

  try {
    if (!identifier || !password) {
      console.log('Login attempt failed: Missing identifier or password.');
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const trimmedIdentifier = identifier.trim();
    const identifierForEmailQuery = trimmedIdentifier.toLowerCase();

    console.log(`Login attempt for identifier: "${trimmedIdentifier}"`);
    console.log(` -> Searching for email as: "${identifierForEmailQuery}" (case-insensitive due to stored lowercase)`);
    console.log(` -> Searching for username as: "${trimmedIdentifier}" (case-insensitive via regex)`);
    console.log(` -> Searching for phone as: "${trimmedIdentifier}" (exact match)`);

    const user = await User.findOne({
      $or: [
        { email: identifierForEmailQuery }, 
        { phoneNumber: trimmedIdentifier }, 
        { username: new RegExp(`^${trimmedIdentifier}$`, 'i') } 
      ],
    }).select('+refreshToken'); // Ensure password is also selected if not by default

    if (!user) {
      console.log(`Login failed: User not found for identifier: "${trimmedIdentifier}"`);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log(`routes/auth.js - /login: User found: ${user.username} (ID: ${user._id})`);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Password mismatch for user: ${user.username || identifier}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`Login successful for user: ${user.username}`);

    const accessTokenValue = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN,
    });
    const refreshTokenValue = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_EXPIRES_IN,
    });
    console.log(`routes/auth.js - /login: Tokens created for user ${user.username}`);

    try {
      user.refreshToken = refreshTokenValue;
      await user.save();
      console.log(`Refresh token saved for user: ${user.username}`);
    } catch (saveError) {
      console.error(`❌ Error saving refresh token for user ${user.username}:`, saveError.message);
    }

    const responsePayload = {
      user: {
        _id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        phone: user.phoneNumber,
        username: user.username,
        location: user.location,
        verified: user.verified,
        playerId: user.playerId || null
      },
      token: accessTokenValue,       
      accessToken: accessTokenValue, 
      refreshToken: refreshTokenValue
    };
    console.log('✅ Sending login success response payload:', JSON.stringify(responsePayload, null, 2));
    res.json(responsePayload);

  } catch (err) {
    console.error('❌ Login error (main catch block):', err.message);
    console.error(err.stack);
    res.status(500).json({ message: 'Server error during login' });
  }
});
// (END OF MODIFIED /login SECTION >>>>>)


// ✅ Refresh Token Endpoint
console.log("routes/auth.js - Defining POST /refresh-token route"); // Update log message
router.post('/refresh-token', async (req, res) => { // <<<< CHANGE THIS LINE
  console.log("✅✅✅ /api/auth/refresh-token - ROUTE HANDLER REACHED ✅✅✅"); // Update log message
  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.log("routes/auth.js - /refresh-token: Refresh token missing from request.");
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log(`routes/auth.js - /refresh-token: Refresh token payload verified for userId: ${payload.userId}`);

    // It's good practice to ensure the token from the DB still matches
    // This helps invalidate tokens if a user's refresh token is compromised or reissued.
    const user = await User.findById(payload.userId).select('+refreshToken'); // Make sure refreshToken is selected

    if (!user) {
        console.warn(`Refresh token attempt for non-existent user ID: ${payload.userId}.`);
        return res.status(403).json({ message: 'Invalid refresh token (user not found)' });
    }
    
    // Compare the received refreshToken with the one stored in the database
    if (user.refreshToken !== refreshToken) {
        console.warn(`Refresh token mismatch for user ${user._id}. Token in DB might have been updated or revoked.`);
        // Optionally, you might want to clear the user.refreshToken here for security if it's a very old/compromised token.
        // await User.updateOne({ _id: user._id }, { $unset: { refreshToken: "" } });
        return res.status(403).json({ message: 'Invalid refresh token (token mismatch - potentially revoked or reissued)' });
    }
    console.log(`routes/auth.js - /refresh-token: User found and refresh token matches DB for userId: ${user._id}`);


    const newAccessToken = jwt.sign({ userId: payload.userId }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN,
    });
    console.log(`routes/auth.js - /refresh-token: New access token generated for userId: ${user._id}`);

    // It's common to also send back the new access token under the key "accessToken"
    // and potentially a new refresh token if you implement refresh token rotation.
    // For now, just sending "token" and "accessToken" for compatibility with your client.
    res.json({ token: newAccessToken, accessToken: newAccessToken });

  } catch (err) {
    console.error('❌ Token refresh error:', err.message);
    if (err.name === 'TokenExpiredError') {
      // If the refresh token itself is expired, the user MUST log in again.
      // You might want to clear the refresh token from the DB here too.
      // await User.updateOne({ _id: jwt.decode(refreshToken)?.userId }, { $unset: { refreshToken: "" } });
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token (malformed or signature issue)' });
    }
    res.status(500).json({ message: 'Server error during token refresh' });
  }
});

// ✅ Debug route
console.log("routes/auth.js - Defining GET /ping route");
router.get('/ping', (req, res) => {
  console.log("✅✅✅ /api/auth/ping - ROUTE HANDLER REACHED ✅✅✅");
  res.json({ message: '✅ Auth route is working!' });
});

// ✅ Temporary debug: header inspection
router.post('/debug-headers', (req, res) => {
  console.log("DEBUG /debug-headers - headers:", req.headers);
  res.json({ headers: req.headers });
});

console.log("routes/auth.js - module.exports = router");
module.exports = router; // <<<<< MAKE SURE THIS LINE IS PRESENT AND AT THE END
