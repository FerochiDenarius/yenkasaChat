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

const STAFF_ROLES = new Set(['moderator', 'admin', 'junior_developer', 'senior_developer']);
const PUBLIC_ROLE_PRIORITY = [
  'campus_influencer',
  'premium_seller',
  'business_account',
  'brand_ambassador',
  'top_vendor',
  'legend',
  'rising_star',
  'verified_creator'
];

function normalizeRoleKey(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getEffectiveRoleName(user) {
  const staffRole = normalizeRoleKey(user.staffRole);
  if (STAFF_ROLES.has(staffRole)) return staffRole;

  const publicRoles = new Set((user.publicRoles || []).map(normalizeRoleKey));
  const publicRole = PUBLIC_ROLE_PRIORITY.find(role => publicRoles.has(role));
  if (publicRole) return publicRole;

  return normalizeRoleKey(user.roleName || user.accessRole || user.role?.role || user.role) || 'unverified';
}

router.post('/register', async (req, res) => {
  console.log("🔥 /api/auth/register HIT");
  console.log("📩 Incoming body:", req.body);

  let { email, phoneNumber, username, location, password, communityId, communityIds, country } = req.body;

  try {
    console.log("🔎 Before sanitize:", { email, phoneNumber, username, location, password, communityId, communityIds, country });

    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = username ? sanitize(username.toLowerCase()) : null;
    location = location ? sanitize(location) : null;
    password = password ? sanitize(password) : null;

    console.log("✨ After sanitize:", { email, phoneNumber, username, location, password, communityId, communityIds, country });

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
    const requestedCommunityIds = Array.isArray(communityIds)
      ? communityIds
      : (communityId ? [communityId] : []);
    const selectedCommunityIds = [...new Set(
      requestedCommunityIds
        .map(id => id?.toString().trim())
        .filter(Boolean)
    )];

    if (!username || !location || !password || (!email && !phoneNumber) || selectedCommunityIds.length === 0) {
      console.log("❌ Missing fields:", { username, location, password, email, phoneNumber, communityId, communityIds });
      return res.status(400).json({ message: 'Missing required fields (including communityId)' });
    }

    if (selectedCommunityIds.length > 2) {
      return res.status(400).json({
        success: false,
        message: "You can select up to 2 communities at signup."
      });
    }

    console.log("🔍 Checking communities:", selectedCommunityIds);
    const communities = await Community.find({
      _id: { $in: selectedCommunityIds },
      isApproved: true
    });

    if (communities.length !== selectedCommunityIds.length) {
      console.log("❌ Community invalid:", selectedCommunityIds);
      return res.status(403).json({ message: 'Community not valid or not approved' });
    }

    const invalidCountryCommunity = communities.find((community) => {
      const communityCountry = (community.country || "").trim().toLowerCase();
      return communityCountry !== selectedCountry.toLowerCase();
    });

    if (invalidCountryCommunity) {
      console.log("❌ Community country mismatch:", {
        selectedCountry,
        communityCountry: invalidCountryCommunity.country,
        communityId: invalidCountryCommunity._id
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
      community: selectedCommunityIds[0],
      joinedCommunities: selectedCommunityIds,
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
    });

    await newUser.save();
    await Community.updateMany(
      { _id: { $in: selectedCommunityIds }, members: { $ne: newUser._id } },
      { $addToSet: { members: newUser._id } }
    );
    await Promise.all(
      selectedCommunityIds.map(async (id) => {
        const count = await User.countDocuments({ joinedCommunities: id });
        await Community.findByIdAndUpdate(id, { memberCount: count });
      })
    );
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
      const normalized = getEffectiveRoleName(user)
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      const defaultPerm = await Permission.findOne({ role: normalized }) || await Permission.findOne({ role: 'unverified' });

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
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip || req.socket?.remoteAddress || '';
    user.lastLoginUserAgent = (req.get('user-agent') || '').slice(0, 300);
    await user.save();

    const effectiveRoleName = getEffectiveRoleName(user);
    if (STAFF_ROLES.has(effectiveRoleName) && (user.roleName !== effectiveRoleName || user.accessRole !== effectiveRoleName.toUpperCase())) {
      user.roleName = effectiveRoleName;
      user.accessRole = effectiveRoleName.toUpperCase();
      await user.save();
    }

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
    roleName: effectiveRoleName,
    accessRole: user.accessRole || effectiveRoleName.toUpperCase(),
    staffRole: user.staffRole || null,
    publicRoles: user.publicRoles || [],
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
