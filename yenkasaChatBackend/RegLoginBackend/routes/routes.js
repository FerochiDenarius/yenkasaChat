const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user.model'); // ✅ Correct

const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || '1h';
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '7d';

// ✅ Helper to sanitize input and trim long strings
const sanitize = (val) =>
  typeof val === 'string' ? val.trim().substring(0, 255) : val;

// ✅ Register Route
router.post('/register', async (req, res) => {
  let { email, phone, username, location, password } = req.body;

  try {
    // ✅ Sanitize
    email = email ? sanitize(email.toLowerCase()) : null;
    phone = phone ? sanitize(phone) : null;
    username = sanitize(username);
    location = sanitize(location);
    password = sanitize(password);

    if (!username || !location || !password || (!email && !phone)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
        { username }
      ]
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      location,
      password: hashedPassword,
      ...(email && { email }),
      ...(phone && { phone })
    });

    await user.save();

    // ✅ Generate tokens immediately after register
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        location: user.location,
        verified: user.verified
      },
      token: accessToken,
      refreshToken
    });

  } catch (err) {
    console.error('❌ Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ✅ Login Route
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  try {
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const user = await User.findOne({
      $or: [
        { phone: identifier },
        { username: identifier },
        { email: identifier.toLowerCase() }
      ]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // ✅ Issue new tokens
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        location: user.location,
        verified: user.verified
      },
      token: accessToken,
      refreshToken
    });

  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
