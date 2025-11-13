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

// ✅ REGISTER (auto-join 1 local community)
router.post('/register', async (req, res) => {
  console.log("✅✅✅ /api/auth/register - ROUTE HANDLER REACHED ✅✅✅");
  let { email, phoneNumber, username, location, password, communityId } = req.body;

  try {
    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = username ? sanitize(username.toLowerCase()) : null;
    location = location ? sanitize(location) : null;
    password = password ? sanitize(password) : null;

    // ✅ Validate inputs
    if (!username || !location || !password || (!email && !phoneNumber) || !communityId) {
      return res.status(400).json({ message: 'Missing required fields (including communityId)' });
    }

    // ✅ Validate community
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    if (!community.isApproved) {
      return res.status(403).json({ message: 'Community not approved yet' });
    }

    // (Optional) ✅ If you have a `type` field (e.g. "local" | "interest")
    if (community.type && community.type.toLowerCase() !== "local") {
      return res.status(403).json({ message: 'You can only join a local community at registration' });
    }

    // ✅ Check for existing user duplicates
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

    // ✅ Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      location,
      password: hashedPassword,
      joinedCommunities: [communityId], // auto-join local community
      community: communityId,           // set as current
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
    });

    await newUser.save();

    // ✅ Add user to community members
    if (!community.members.includes(newUser._id)) {
      community.members.push(newUser._id);
      await community.incrementMemberCount();
      await community.save();
    }

    // ✅ Generate JWT tokens
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

    // ✅ Response
    res.status(201).json({
      success: true,
      message: 'Registration successful! You have joined your local community.',
      user: {
        _id: newUser._id,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        username: newUser.username,
        location: newUser.location,
        verified: newUser.verified,
        joinedCommunities: newUser.joinedCommunities,
      },
      token: accessTokenValue,
      refreshToken: refreshTokenValue
    });

  } catch (err) {
    console.error('❌ Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected (email, phone or username already exists)' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});


// ✅ LOGIN
// ✅ LOGIN (permanent fix for role ref bug)
router.post('/login', async (req, res) => {
  console.log("✅ /api/auth/login - ROUTE HANDLER REACHED ✅");
  const { identifier, password } = req.body;

  try {
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const trimmedIdentifier = identifier.trim();
    const identifierForEmailQuery = trimmedIdentifier.toLowerCase();

    // 🔹 Include role in query for possible populate
    let user = await User.findOne({
      $or: [
        { email: identifierForEmailQuery },
        { phoneNumber: trimmedIdentifier },
        { username: new RegExp(`^${trimmedIdentifier}$`, 'i') },
      ],
    })
      .select('+refreshToken')
      .populate('role'); // ✅ populate Permission reference if valid

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 🔹 MIGRATION FIX: if user.role is a string or invalid, correct it on the fly
    const Permission = require('../models/permissions.model');

    if (!user.role || typeof user.role === 'string') {
      const normalized = (user.role || 'user').toString().trim().toLowerCase().replace(/\s+/g, '_');
      const defaultPerm = await Permission.findOne({ role: normalized }) || await Permission.findOne({ role: 'user' });

      user.role = defaultPerm ? defaultPerm._id : null;
      await user.save(); // 🔹 Persist fix so next login is clean
      user = await User.findById(user._id).populate('role'); // repopulate after fixing
      console.log(`🩵 Auto-fixed user role for ${user.username} → ${user.role?.role}`);
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

    // ✅ Update refresh token
    user.refreshToken = refreshTokenValue;
    await user.save();

    // ✅ Return clean JSON with role details
   res.json({
  user: {
    _id: user._id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    phone: user.phoneNumber,
    username: user.username,
    location: user.location,
    verified: user.verified,
    playerId: user.playerId || null,
    role: user.role || {},               // 👈 send full Permission object
    // optional: send string separately if needed
    roleName: user.role?.role || 'user',
  },
  token: accessTokenValue,
  refreshToken: refreshTokenValue,
});


  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});


// ✅ Debug route
router.get('/ping', (req, res) => {
  res.json({ message: '✅ Auth route is working!' });
});

module.exports = router;
