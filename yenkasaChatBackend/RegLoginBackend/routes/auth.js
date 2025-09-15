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

const ACCESS_EXPIRES_IN = '120d';   // or '120d'
const REFRESH_EXPIRES_IN = '120d'; // keep refresh slightly longer


// ✅ REGISTERconsole.log("routes/auth.js - Defining POST /register route");
router.post('/register', async (req, res) => {
  console.log("✅✅✅ /api/auth/register - ROUTE HANDLER REACHED ✅✅✅");
  let { email, phoneNumber, username, location, password } = req.body;

  try {
    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = username ? sanitize(username.toLowerCase()) : null;
    location = location ? sanitize(location) : null;
    password = password ? sanitize(password) : null;

    if (!username || !location || !password || (!email && !phoneNumber)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
        { username },
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

    // ✅ Issue tokens right after registration
    const accessTokenValue = jwt.sign(
      { userId: newUser._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN }
    );

    const refreshTokenValue = jwt.sign(
      { userId: newUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN }
    );

    newUser.refreshToken = refreshTokenValue;
    await newUser.save();

    // ✅ Respond with user + tokens
    res.status(201).json({
      user: {
        _id: newUser._id,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        username: newUser.username,
        location: newUser.location,
        verified: newUser.verified,
        playerId: newUser.playerId || null
      },
      token: accessTokenValue,        // ✅ matches LoginResponse
      refreshToken: refreshTokenValue // ✅ matches LoginResponse
    });

  } catch (err) {
    console.error('❌ Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected (e.g., email or username already exists)' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});



// ✅ LOGIN with Access + Refresh Token (<<<<< THIS IS THE MODIFIED SECTION)// ✅ LOGIN with Access + Refresh Token
console.log("routes/auth.js - Defining POST /login route");
router.post('/login', async (req, res) => {
  console.log("✅✅✅ /api/auth/login - ROUTE HANDLER REACHED ✅✅✅");
  const { identifier, password } = req.body;
  console.log(`routes/auth.js - /login: Received identifier: ${identifier}, password: ${password ? '******' : '[MISSING]'}`);

  try {
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const trimmedIdentifier = identifier.trim();
    const identifierForEmailQuery = trimmedIdentifier.toLowerCase();

    const user = await User.findOne({
      $or: [
        { email: identifierForEmailQuery },
        { phoneNumber: trimmedIdentifier },
        { username: new RegExp(`^${trimmedIdentifier}$`, 'i') }
      ],
    }).select('+refreshToken');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate tokens
    const accessTokenValue = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET, // ✅ use correct secret
      { expiresIn: ACCESS_EXPIRES_IN }
    );

    const refreshTokenValue = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN }
    );

    // Save refresh token
    user.refreshToken = refreshTokenValue;
    await user.save();

    // Response payload (matches frontend LoginResponse)
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
      token: accessTokenValue,       // ✅ matches Android LoginResponse
      refreshToken: refreshTokenValue // ✅ matches Android LoginResponse
    };

    res.json(responsePayload);

  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});



// ✅ Refresh Token Endpoint
console.log("routes/auth.js - Defining POST /token/refresh route");
router.post('/token/refresh', async (req, res) => {
  // ... your existing /token/refresh route code ...
  console.log("✅✅✅ /api/auth/token/refresh - ROUTE HANDLER REACHED ✅✅✅");
  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.log("routes/auth.js - /token/refresh: Refresh token missing from request.");
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log(`routes/auth.js - /token/refresh: Refresh token payload verified for userId: ${payload.userId}`);

    const user = await User.findById(payload.userId).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      console.warn(`Refresh token mismatch or user not found for refresh. User ID: ${payload.userId}. Token provided: ${refreshToken}. Token in DB: ${user ? user.refreshToken : 'N/A'}`);
      return res.status(403).json({ message: 'Invalid refresh token (token mismatch or user not found)' });
    }
    console.log(`routes/auth.js - /token/refresh: User found and refresh token matches DB for userId: ${user._id}`);

    const newAccessToken = jwt.sign({ userId: payload.userId }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN,
    });
    console.log(`routes/auth.js - /token/refresh: New access token generated for userId: ${user._id}`);

    res.json({ token: newAccessToken, accessToken: newAccessToken });

  } catch (err) {
    console.error('❌ Token refresh error:', err.message);
    if (err.name === 'TokenExpiredError') {
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
