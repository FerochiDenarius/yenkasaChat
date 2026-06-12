// ✅ Debug startup log
console.log("✅✅✅ routes/auth.js - File loaded by server.js ✅✅✅");

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); 
const Community = require('../models/community.model');
const ActivityLog = require('../models/activityLog.model');
const { applyPrivilegedRole } = require('../services/adminBootstrap.service');
const {
  buildCountryVerification,
  normalizeCountryLabel,
  recordCountrySecuritySignal
} = require('../services/regionalRewards.service');
const { publishIntelligenceEvent } = require('../src/intelligence/services/eventPublisher.service');


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

function utcStartOfDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function resolveIdentifierType(identifier = '') {
  const value = String(identifier || '').trim();
  if (!value) return 'unknown';
  if (value.includes('@')) return 'email';
  if (/^\+?\d[\d\s-]{5,}$/.test(value)) return 'phone';
  return 'username';
}

function publishLoginAttemptEvent(req, details = {}) {
  publishIntelligenceEvent({
    eventType: 'login_attempt',
    source: 'yenkasa_app',
    userId: details.userId || null,
    metadata: {
      status: details.status || 'failed',
      reason: details.reason || '',
      identifierType: details.identifierType || 'unknown',
      roleName: details.roleName || '',
      ip: req.ip || req.socket?.remoteAddress || '',
      userAgent: (req.get('user-agent') || '').slice(0, 240),
      country: details.country || '',
      detectedCountry: details.detectedCountry || '',
      countryMismatch: Boolean(details.countryMismatch),
      countrySwitchSuspected: Boolean(details.countrySwitchSuspected),
    },
  });
}

function publishSuspiciousActivityEvent(req, details = {}) {
  publishIntelligenceEvent({
    eventType: 'suspicious_activity',
    source: 'yenkasa_app',
    userId: details.userId || null,
    metadata: {
      activity: details.activity || 'auth_anomaly',
      reason: details.reason || '',
      ip: req.ip || req.socket?.remoteAddress || '',
      userAgent: (req.get('user-agent') || '').slice(0, 240),
      country: details.country || '',
      detectedCountry: details.detectedCountry || '',
      countryMismatch: Boolean(details.countryMismatch),
      countrySwitchSuspected: Boolean(details.countrySwitchSuspected),
    },
  });
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

    const countryContext = await buildCountryVerification(req, {
      clientCountry: selectedCountry,
      currentCountry: selectedCountry
    });

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
      verifiedCountry: countryContext.detectedCountry || '',
      detectedCountry: countryContext.detectedCountry || '',
      countryConfidence: countryContext.countryConfidence,
      countryVerificationStatus: countryContext.verificationStatus,
      countryLastVerifiedAt: countryContext.detectedCountry ? new Date() : null,
      password: hashedPassword,
      community: selectedCommunityIds[0],
      joinedCommunities: selectedCommunityIds,
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
    });

    await applyPrivilegedRole(newUser);
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

    const sameIpAccountCreations = countryContext.ipAddress
      ? await ActivityLog.countDocuments({
          action: 'ACCOUNT_CREATED',
          ipAddress: countryContext.ipAddress,
          timestamp: { $gte: utcStartOfDay(new Date()) }
        })
      : 0;

    await recordCountrySecuritySignal({
      req,
      userId: newUser._id,
      action: 'ACCOUNT_CREATED',
      country: selectedCountry,
      detectedCountry: countryContext.detectedCountry,
      verifiedCountry: newUser.verifiedCountry,
      countryConfidence: newUser.countryConfidence,
      suspicious: Boolean(countryContext.countrySwitchSuspected || sameIpAccountCreations >= 5),
      metadata: {
        registrationCountry: selectedCountry,
        detectedCountry: countryContext.detectedCountry || '',
        sameIpAccountCreations
      }
    });

    console.log("🎉 User created successfully:", newUser._id);

    // 🔥 THIS WAS MISSING — MUST RETURN A RESPONSE
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: newUser._id,
      country: newUser.country,
      verifiedCountry: newUser.verifiedCountry || '',
      detectedCountry: newUser.detectedCountry || '',
      countryConfidence: newUser.countryConfidence || 0,
      countryVerificationStatus: newUser.countryVerificationStatus || 'unknown'
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
      publishLoginAttemptEvent(req, {
        status: 'failed',
        reason: 'missing_credentials',
        identifierType: resolveIdentifierType(identifier),
      });
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
      publishLoginAttemptEvent(req, {
        status: 'failed',
        reason: 'user_not_found',
        identifierType: resolveIdentifierType(trimmedIdentifier),
      });
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      publishLoginAttemptEvent(req, {
        userId: user._id.toString(),
        status: 'failed',
        reason: 'invalid_credentials',
        identifierType: resolveIdentifierType(trimmedIdentifier),
        roleName: getEffectiveRoleName(user),
        country: user.country || '',
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const countryContext = await buildCountryVerification(req, {
      clientCountry: user.country,
      currentCountry: user.country,
      userId: user._id
    });
    const existingVerifiedCountry = normalizeCountryLabel(user.verifiedCountry);
    const detectedCountry = countryContext.detectedCountry || '';
    const countryMismatch = Boolean(detectedCountry) && existingVerifiedCountry
      ? normalizeCountryLabel(detectedCountry).toLowerCase() !== existingVerifiedCountry.toLowerCase()
      : false;

    if (detectedCountry) {
      user.detectedCountry = detectedCountry;
      user.countryConfidence = Math.max(Number(user.countryConfidence || 0), Number(countryContext.countryConfidence || 0));
      if (!existingVerifiedCountry) {
        user.verifiedCountry = detectedCountry;
        user.countryVerificationStatus = 'geoip_verified';
        user.countryLastVerifiedAt = new Date();
      }
      if (countryMismatch || countryContext.countrySwitchSuspected) {
        user.lastCountrySwitchAt = new Date();
      }
      await user.save();

      await recordCountrySecuritySignal({
        req,
        userId: user._id,
        action: 'LOGIN_COUNTRY_CHECK',
        country: user.country,
        detectedCountry,
        verifiedCountry: user.verifiedCountry,
        countryConfidence: user.countryConfidence,
        suspicious: countryMismatch || Boolean(countryContext.countrySwitchSuspected),
        metadata: {
          verificationStatus: user.countryVerificationStatus,
          currentCountry: user.country,
          detectedCountry
        }
      });
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
    const privilegedRoleApplied = await applyPrivilegedRole(user);
    const roleNameAfterPrivilegeCheck = getEffectiveRoleName(user);
    if (privilegedRoleApplied || (STAFF_ROLES.has(roleNameAfterPrivilegeCheck) && (user.roleName !== roleNameAfterPrivilegeCheck || user.accessRole !== roleNameAfterPrivilegeCheck.toUpperCase()))) {
      user.roleName = roleNameAfterPrivilegeCheck;
      user.accessRole = roleNameAfterPrivilegeCheck.toUpperCase();
      await user.save();
    }

    const finalRoleName = getEffectiveRoleName(user);

    publishLoginAttemptEvent(req, {
      userId: user._id.toString(),
      status: 'success',
      reason: '',
      identifierType: resolveIdentifierType(trimmedIdentifier),
      roleName: finalRoleName,
      country: user.country || '',
      detectedCountry,
      countryMismatch,
      countrySwitchSuspected: Boolean(countryContext.countrySwitchSuspected),
    });

    if (countryMismatch || countryContext.countrySwitchSuspected) {
      publishSuspiciousActivityEvent(req, {
        userId: user._id.toString(),
        activity: 'login_country_anomaly',
        reason: countryMismatch ? 'country_mismatch' : 'country_switch_suspected',
        country: user.country || '',
        detectedCountry,
        countryMismatch,
        countrySwitchSuspected: Boolean(countryContext.countrySwitchSuspected),
      });
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
    roleName: finalRoleName,
    accessRole: user.accessRole || finalRoleName.toUpperCase(),
    staffRole: user.staffRole || null,
    publicRoles: user.publicRoles || [],
    country: user.country,
    verifiedCountry: user.verifiedCountry || '',
    detectedCountry: user.detectedCountry || '',
    countryConfidence: user.countryConfidence || 0,
    countryVerificationStatus: user.countryVerificationStatus || 'unknown',
  },
  token: accessTokenValue,
  refreshToken: refreshTokenValue,
});


  } catch (err) {
    console.error('❌ Login error:', err);
    publishLoginAttemptEvent(req, {
      status: 'failed',
      reason: 'server_error',
      identifierType: resolveIdentifierType(identifier),
    });
    res.status(500).json({ message: 'Server error during login' });
  }
});


// ✅ Debug route
router.get('/ping', (req, res) => {
  res.json({ message: '✅ Auth route is working!' });
});

module.exports = router;
