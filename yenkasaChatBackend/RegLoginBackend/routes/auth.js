// ✅ Debug startup log
console.log("✅✅✅ routes/auth.js - File loaded by server.js ✅✅✅");

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); 
const Community = require('../models/community.model');


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

router.post('/register', async (req, res) => {
  console.log("🔥 /api/auth/register HIT");
  console.log("📩 Incoming body:", req.body);

  let { email, phoneNumber, username, location, password, communityId, country } = req.body;

  try {
    console.log("🔎 Before sanitize:", { email, phoneNumber, username, location, password, communityId, country });

    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = username ? sanitize(username.toLowerCase()) : null;
    location = location ? sanitize(location) : null;
    password = password ? sanitize(password) : null;

    console.log("✨ After sanitize:", { email, phoneNumber, username, location, password, communityId, country });

    // 🌍 COUNTRY VALIDATION
    const allowedCountries = ["Ghana", "Nigeria"];

    country = country ? sanitize(country) : "Ghana";
    console.log("🌍 Normalized country (raw):", country);

    const normalizedCountry = country.trim().toLowerCase();
    const selectedCountry = allowedCountries.find(
      allowedCountry => allowedCountry.toLowerCase() === normalizedCountry
    );
    console.log("🌍 Normalized country (lowercase):", normalizedCountry);

    if (!selectedCountry) {
      console.log("❌ Country not in allowed list:", country);
      return res.status(400).json({
        success: false,
        message: "Registration is currently available only in Ghana and Nigeria."
      });
    }

    // Validate required
    console.log("🔍 Checking required fields…");
    if (!username || !location || !password || (!email && !phoneNumber) || !communityId) {
      console.log("❌ Missing fields:", { username, location, password, email, phoneNumber, communityId });
      return res.status(400).json({ message: 'Missing required fields (including communityId)' });
    }

    console.log("🔍 Checking community:", communityId);
    const community = await Community.findById(communityId);
    if (!community || !community.isApproved) {
      console.log("❌ Community invalid:", communityId);
      return res.status(403).json({ message: 'Community not valid or not approved' });
    }

    const communityCountry = (community.country || "Ghana").trim().toLowerCase();
    if (communityCountry !== selectedCountry.toLowerCase()) {
      console.log("❌ Community country mismatch:", {
        selectedCountry,
        communityCountry: community.country,
        communityId
      });
      return res.status(400).json({
        success: false,
        message: `Selected community is not available for ${selectedCountry}.`
      });
    }

    console.log("🔍 Checking duplicates...");
    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
        { username },
      ],
    });

    if (existingUser) {
      console.log("❌ Duplicate user found:", existingUser._id);
      return res.status(409).json({ message: 'User already exists' });
    }

    console.log("🔐 Hashing password…");
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("🆕 Creating user…");
    const newUser = new User({
      username,
      location,
      country: selectedCountry,
      password: hashedPassword,
      community: communityId,
      joinedCommunities: [communityId],
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
    });

    await newUser.save();
    console.log("🎉 User created successfully:", newUser._id);

    // 🔥 THIS WAS MISSING — MUST RETURN A RESPONSE
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: newUser._id,
    });

  } catch (err) {
    console.error('❌ Register error:', err);
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
