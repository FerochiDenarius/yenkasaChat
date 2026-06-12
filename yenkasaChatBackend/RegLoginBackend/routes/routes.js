const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user.model'); // ✅ Correct
const { applyPrivilegedRole } = require('../services/adminBootstrap.service');
const {
  buildCountryVerification,
  normalizeCountryLabel,
  recordCountrySecuritySignal
} = require('../services/regionalRewards.service');

const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || '1h';
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '7d';

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
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getEffectiveRoleName(user) {
  const staffRole = normalizeRoleKey(user.staffRole);
  if (STAFF_ROLES.has(staffRole)) return staffRole;

  const publicRoles = new Set((user.publicRoles || []).map(normalizeRoleKey));
  const publicRole = PUBLIC_ROLE_PRIORITY.find(role => publicRoles.has(role));
  if (publicRole) return publicRole;

  return normalizeRoleKey(user.roleName || user.accessRole || user.role?.role || user.role) || 'unverified';
}

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

    const countryContext = await buildCountryVerification(req, { currentCountry: 'Ghana' });

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
      country: 'Ghana',
      verifiedCountry: countryContext.detectedCountry || '',
      detectedCountry: countryContext.detectedCountry || '',
      countryConfidence: countryContext.countryConfidence,
      countryVerificationStatus: countryContext.verificationStatus,
      countryLastVerifiedAt: countryContext.detectedCountry ? new Date() : null,
      password: hashedPassword,
      ...(email && { email }),
      ...(phone && { phone })
    });

    await applyPrivilegedRole(user);
    await user.save();

    await recordCountrySecuritySignal({
      req,
      userId: user._id,
      action: 'ACCOUNT_CREATED',
      country: user.country,
      detectedCountry: countryContext.detectedCountry,
      verifiedCountry: user.verifiedCountry,
      countryConfidence: user.countryConfidence,
      suspicious: Boolean(countryContext.countrySwitchSuspected),
      metadata: { legacyRoute: true }
    });

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
        verified: user.verified,
        country: user.country,
        verifiedCountry: user.verifiedCountry || '',
        detectedCountry: user.detectedCountry || '',
        countryConfidence: user.countryConfidence || 0,
        countryVerificationStatus: user.countryVerificationStatus || 'unknown',
        roleName: getEffectiveRoleName(user),
        accessRole: user.accessRole || getEffectiveRoleName(user).toUpperCase(),
        staffRole: user.staffRole || null,
        publicRoles: user.publicRoles || []
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

    const countryContext = await buildCountryVerification(req, {
      clientCountry: user.country,
      currentCountry: user.country,
      userId: user._id
    });
    if (countryContext.detectedCountry) {
      const detectedCountry = countryContext.detectedCountry;
      const existingVerifiedCountry = normalizeCountryLabel(user.verifiedCountry);
      const mismatch = existingVerifiedCountry
        ? normalizeCountryLabel(detectedCountry).toLowerCase() !== existingVerifiedCountry.toLowerCase()
        : false;

      user.detectedCountry = detectedCountry;
      user.countryConfidence = Math.max(Number(user.countryConfidence || 0), Number(countryContext.countryConfidence || 0));
      if (!existingVerifiedCountry) {
        user.verifiedCountry = detectedCountry;
        user.countryVerificationStatus = 'geoip_verified';
        user.countryLastVerifiedAt = new Date();
      }
      if (mismatch || countryContext.countrySwitchSuspected) {
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
        suspicious: mismatch || Boolean(countryContext.countrySwitchSuspected),
        metadata: {
          verificationStatus: user.countryVerificationStatus,
          currentCountry: user.country
        }
      });
    }

    await applyPrivilegedRole(user);
    await user.save();

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
        verified: user.verified,
        country: user.country,
        verifiedCountry: user.verifiedCountry || '',
        detectedCountry: user.detectedCountry || '',
        countryConfidence: user.countryConfidence || 0,
        countryVerificationStatus: user.countryVerificationStatus || 'unknown',
        roleName: getEffectiveRoleName(user),
        accessRole: user.accessRole || getEffectiveRoleName(user).toUpperCase(),
        staffRole: user.staffRole || null,
        publicRoles: user.publicRoles || []
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
