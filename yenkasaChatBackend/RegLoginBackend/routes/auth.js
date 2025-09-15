// ✅ Debug startup log
console.log("✅✅✅ routes/auth.js - File loaded by server.js ✅✅✅");

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); 

// ✅ Sanitize helper
const sanitize = (val) =>
  typeof val === 'string' ? val.trim().substring(0, 255) : val;

// ✅ Environment secrets check
if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.error("❌❌❌ routes/auth.js - Missing ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET! ❌❌❌");
  throw new Error('ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET is not set in environment.');
}
console.log("routes/auth.js - Token secrets check passed");

const ACCESS_EXPIRES_IN = '120d';
const REFRESH_EXPIRES_IN = '120d';

// ✅ REGISTER
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

    // ✅ Issue tokens
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
      token: accessTokenValue,
      refreshToken: refreshTokenValue
    });

  } catch (err) {
    console.error('❌ Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected (e.g., email or username already exists)' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ✅ LOGIN
router.post('/login', async (req, res) => {
  console.log("✅✅✅ /api/auth/login - ROUTE HANDLER REACHED ✅✅✅");
  const { identifier, password } = req.body;

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

    // ✅ Generate tokens
    const accessTokenValue = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN }
    );

    const refreshTokenValue = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN }
    );

    user.refreshToken = refreshTokenValue;
    await user.save();

    res.json({
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
      refreshToken: refreshTokenValue
    });

  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ✅ Refresh Token
router.post('/token/refresh', async (req, res) => {
  console.log("✅✅✅ /api/auth/token/refresh - ROUTE HANDLER REACHED ✅✅✅");
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(payload.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET, // ✅ FIXED (was JWT_SECRET before)
      { expiresIn: ACCESS_EXPIRES_IN }
    );

    res.json({ token: newAccessToken, refreshToken });

  } catch (err) {
    console.error('❌ Token refresh error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

// ✅ Debug route
router.get('/ping', (req, res) => {
  res.json({ message: '✅ Auth route is working!' });
});

module.exports = router;
