const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user.model');

// ✅ Sanitize helper
const sanitize = (val) =>
  typeof val === 'string' ? val.trim().substring(0, 255) : val;

if (!process.env.JWT_SECRET || !process.env.REFRESH_SECRET) {
  throw new Error('❌ JWT_SECRET or REFRESH_SECRET is not set in environment.');
}

const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

// In-memory store (for production, use DB or Redis)
const refreshTokens = new Map();

// ✅ REGISTER
router.post('/register', async (req, res) => {
  let { email, phoneNumber, username, location, password } = req.body;

  try {
    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = sanitize(username.toLowerCase());
    location = sanitize(location);
    password = sanitize(password);

    if (!username || !location || !password || (!email && !phoneNumber)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
        { username }
      ]
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
      ...(phoneNumber && { phoneNumber })
    });

    await newUser.save();

    res.status(201).json({
      _id: newUser._id,
      email: newUser.email,
      phoneNumber: newUser.phoneNumber,
      username: newUser.username,
      location: newUser.location,
      verified: newUser.verified
    });

  } catch (err) {
    console.error('❌ Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ✅ LOGIN with Access + Refresh Token
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  try {
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const identifierLower = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [
        { email: identifierLower },
        { phoneNumber: identifier },
        { username: identifierLower }
      ]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Create tokens
    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN
    });

    const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRES_IN
    });

    // Store refreshToken in DB)
 user.refreshToken = refreshToken;
await user.save();


    res.json({
      user: {
        _id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        username: user.username,
        location: user.location,
        verified: user.verified
      },
      accessToken,
      refreshToken
    });

  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ✅ Refresh Token Endpoint
router.post('/token/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    
    const user = await User.findById(payload.userId);
if (!user || user.refreshToken !== refreshToken) {
  return res.status(403).json({ message: 'Invalid refresh token' });
}


    const newAccessToken = jwt.sign({ userId: payload.userId }, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('❌ Token refresh error:', err.message);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// ✅ Debug route
router.get('/ping', (req, res) => {
  res.json({ message: '✅ Auth route is working!' });
});

module.exports = router;
