const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

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

    // ✅ Required field checks
    if (!username || !location || !password || (!email && !phone)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // ✅ Check for existing user
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

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Dynamically build user object
    const userObj = {
      username,
      location,
      password: hashedPassword,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {})
    };

    const user = new User(userObj);
    await user.save();

    res.status(201).json({
      id: user._id,
      email: user.email,
      phone: user.phone,
      username: user.username,
      location: user.location,
      verified: user.verified
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

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing in environment");
      return res.status(500).json({ message: 'Server config error' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        location: user.location,
        verified: user.verified
      },
      token
    });

  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
