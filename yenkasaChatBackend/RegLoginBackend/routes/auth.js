const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const Community = require('../models/community.model');
const ActivityLog = require('../models/activityLog.model');
const {
  buildCountryVerification,
  normalizeCountryLabel,
  recordCountrySecuritySignal,
} = require('../services/regionalRewards.service');
const { createLogger } = require('../src/yme/observability/logger');

const router = express.Router();
const logger = createLogger('auth.route', {
  sourceModule: 'http.auth',
});

const sanitize = (value) =>
  typeof value === 'string' ? value.trim().substring(0, 255) : value;

function classifyIdentifier(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return 'unknown';
  if (normalized.includes('@')) return 'email';
  if (/^\+?\d+$/.test(normalized)) return 'phone';
  return 'username';
}

if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  logger.error('Auth secrets are missing from the environment.', {
    data: {
      fatal: true,
    },
  });
  throw new Error('ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET is not set in environment.');
}

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
  'verified_creator',
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
  const publicRole = PUBLIC_ROLE_PRIORITY.find((role) => publicRoles.has(role));
  if (publicRole) return publicRole;

  return normalizeRoleKey(user.roleName || user.accessRole || user.role?.role || user.role) || 'unverified';
}

function utcStartOfDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

router.post('/register', async (req, res) => {
  let { email, phoneNumber, username, location, password, communityId, communityIds, country } =
    req.body;

  try {
    email = email ? sanitize(email.toLowerCase()) : null;
    phoneNumber = phoneNumber ? sanitize(phoneNumber) : null;
    username = username ? sanitize(username.toLowerCase()) : null;
    location = location ? sanitize(location) : null;
    password = password ? sanitize(password) : null;

    const allowedCountries = ['Ghana', 'Nigeria'];
    country = country ? sanitize(country) : 'Ghana';
    const normalizedCountry = country.trim().toLowerCase();
    const selectedCountry = allowedCountries.find(
      (allowedCountry) => allowedCountry.toLowerCase() === normalizedCountry,
    );

    if (!selectedCountry) {
      logger.track({
        message: 'Registration blocked because the selected country is not allowed.',
        severity: 'WARN',
        req,
        data: {
          statusCode: 400,
          country,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_register_country_blocked',
          severity: 'warn',
          statusCode: 400,
        },
      });
      return res.status(400).json({
        success: false,
        message: 'Registration is currently available only in Ghana and Nigeria.',
      });
    }

    const countryContext = await buildCountryVerification(req, {
      clientCountry: selectedCountry,
      currentCountry: selectedCountry,
    });

    const requestedCommunityIds = Array.isArray(communityIds)
      ? communityIds
      : communityId
        ? [communityId]
        : [];
    const selectedCommunityIds = [
      ...new Set(
        requestedCommunityIds.map((id) => id?.toString().trim()).filter(Boolean),
      ),
    ];

    if (
      !username ||
      !location ||
      !password ||
      (!email && !phoneNumber) ||
      selectedCommunityIds.length === 0
    ) {
      logger.track({
        message: 'Registration payload is missing required fields.',
        severity: 'WARN',
        req,
        data: {
          statusCode: 400,
          hasEmail: Boolean(email),
          hasPhoneNumber: Boolean(phoneNumber),
          hasCommunitySelection: selectedCommunityIds.length > 0,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_register_missing_fields',
          severity: 'warn',
          statusCode: 400,
        },
      });
      return res
        .status(400)
        .json({ message: 'Missing required fields (including communityId)' });
    }

    if (selectedCommunityIds.length > 2) {
      logger.track({
        message: 'Registration payload exceeded community selection limits.',
        severity: 'WARN',
        req,
        data: {
          statusCode: 400,
          selectedCommunityCount: selectedCommunityIds.length,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_register_too_many_communities',
          severity: 'warn',
          statusCode: 400,
        },
      });
      return res.status(400).json({
        success: false,
        message: 'You can select up to 2 communities at signup.',
      });
    }

    const communities = await Community.find({
      _id: { $in: selectedCommunityIds },
      isApproved: true,
    });

    if (communities.length !== selectedCommunityIds.length) {
      logger.track({
        message: 'Registration blocked because a selected community is invalid or not approved.',
        severity: 'WARN',
        req,
        data: {
          statusCode: 403,
          selectedCommunityCount: selectedCommunityIds.length,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_register_invalid_community',
          severity: 'warn',
          statusCode: 403,
        },
      });
      return res.status(403).json({ message: 'Community not valid or not approved' });
    }

    const invalidCountryCommunity = communities.find((community) => {
      const communityCountry = (community.country || '').trim().toLowerCase();
      return communityCountry !== selectedCountry.toLowerCase();
    });

    if (invalidCountryCommunity) {
      logger.track({
        message:
          'Registration blocked because the community country does not match the selected country.',
        severity: 'WARN',
        req,
        data: {
          statusCode: 400,
          selectedCountry,
          communityCountry: invalidCountryCommunity.country,
          communityId: invalidCountryCommunity._id.toString(),
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_register_country_mismatch',
          severity: 'warn',
          statusCode: 400,
        },
      });
      return res.status(400).json({
        success: false,
        message: `Selected community is not available for ${selectedCountry}.`,
      });
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
        { username },
      ],
    });

    if (existingUser) {
      logger.track({
        message: 'Registration blocked because the account already exists.',
        severity: 'WARN',
        req,
        userId: existingUser._id.toString(),
        data: {
          statusCode: 409,
          hasEmail: Boolean(email),
          hasPhoneNumber: Boolean(phoneNumber),
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_register_duplicate',
          severity: 'warn',
          statusCode: 409,
        },
      });
      return res.status(409).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    await newUser.save();
    await Community.updateMany(
      { _id: { $in: selectedCommunityIds }, members: { $ne: newUser._id } },
      { $addToSet: { members: newUser._id } },
    );
    await Promise.all(
      selectedCommunityIds.map(async (id) => {
        const count = await User.countDocuments({ joinedCommunities: id });
        await Community.findByIdAndUpdate(id, { memberCount: count });
      }),
    );

    const sameIpAccountCreations = countryContext.ipAddress
      ? await ActivityLog.countDocuments({
          action: 'ACCOUNT_CREATED',
          ipAddress: countryContext.ipAddress,
          timestamp: { $gte: utcStartOfDay(new Date()) },
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
        sameIpAccountCreations,
      },
    });

    logger.track({
      message: 'User registration succeeded.',
      severity: 'INFO',
      req,
      userId: newUser._id.toString(),
      data: {
        statusCode: 201,
        selectedCountry,
        selectedCommunityCount: selectedCommunityIds.length,
        countryVerificationStatus: newUser.countryVerificationStatus || 'unknown',
      },
      event: {
        category: 'auth_event',
        eventName: 'auth_register_success',
        severity: 'info',
        statusCode: 201,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: newUser._id,
      country: newUser.country,
      verifiedCountry: newUser.verifiedCountry || '',
      detectedCountry: newUser.detectedCountry || '',
      countryConfidence: newUser.countryConfidence || 0,
      countryVerificationStatus: newUser.countryVerificationStatus || 'unknown',
    });
  } catch (err) {
    logger.track({
      message: 'Registration request failed.',
      severity: 'ERROR',
      req,
      error: err,
      data: {
        statusCode: err.code === 11000 ? 409 : 500,
      },
      event: {
        category: 'auth_event',
        eventName: err.code === 11000 ? 'auth_register_duplicate' : 'auth_register_error',
        severity: err.code === 11000 ? 'warn' : 'error',
        statusCode: err.code === 11000 ? 409 : 500,
      },
    });
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: 'Duplicate entry detected (email, phone or username already exists)' });
    }
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  try {
    if (!identifier || !password) {
      logger.track({
        message: 'Login payload is missing credentials.',
        severity: 'WARN',
        req,
        data: {
          statusCode: 400,
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_login_missing_credentials',
          severity: 'warn',
          statusCode: 400,
        },
      });
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const trimmedIdentifier = identifier.trim();
    const identifierForEmailQuery = trimmedIdentifier.toLowerCase();

    let user = await User.findOne({
      $or: [
        { email: identifierForEmailQuery },
        { phoneNumber: trimmedIdentifier },
        { username: new RegExp(`^${trimmedIdentifier}$`, 'i') },
      ],
    })
      .select('+refreshToken')
      .populate('role');

    if (!user) {
      logger.track({
        message: 'Login failed because the account was not found.',
        severity: 'WARN',
        req,
        data: {
          statusCode: 404,
          identifierType: classifyIdentifier(trimmedIdentifier),
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_login_user_not_found',
          severity: 'warn',
          statusCode: 404,
        },
      });
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.track({
        message: 'Login failed because the password did not match.',
        severity: 'WARN',
        req,
        userId: user._id.toString(),
        data: {
          statusCode: 401,
          identifierType: classifyIdentifier(trimmedIdentifier),
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_login_invalid_credentials',
          severity: 'warn',
          statusCode: 401,
        },
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const countryContext = await buildCountryVerification(req, {
      clientCountry: user.country,
      currentCountry: user.country,
      userId: user._id,
    });
    const existingVerifiedCountry = normalizeCountryLabel(user.verifiedCountry);
    const detectedCountry = countryContext.detectedCountry || '';
    const countryMismatch = Boolean(detectedCountry) && existingVerifiedCountry
      ? normalizeCountryLabel(detectedCountry).toLowerCase() !==
        existingVerifiedCountry.toLowerCase()
      : false;

    if (detectedCountry) {
      user.detectedCountry = detectedCountry;
      user.countryConfidence = Math.max(
        Number(user.countryConfidence || 0),
        Number(countryContext.countryConfidence || 0),
      );
      if (!existingVerifiedCountry) {
        user.verifiedCountry = detectedCountry;
        user.countryVerificationStatus = 'geoip_verified';
        user.countryLastVerifiedAt = new Date();
      }
      if (countryMismatch || countryContext.countrySwitchSuspected) {
        user.lastCountrySwitchAt = new Date();
      }
      await user.save();

      if (countryMismatch || countryContext.countrySwitchSuspected) {
        logger.track({
          message: 'Login triggered a country anomaly signal.',
          severity: 'WARN',
          req,
          userId: user._id.toString(),
          data: {
            statusCode: 200,
            currentCountry: user.country,
            detectedCountry,
            verificationStatus: user.countryVerificationStatus,
          },
          event: {
            category: 'auth_event',
            eventName: 'auth_login_country_anomaly',
            severity: 'warn',
            statusCode: 200,
          },
        });
      }

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
          detectedCountry,
        },
      });
    }

    const Permission = require('../models/permissions.model');

    if (!user.role || typeof user.role === 'string') {
      const normalized = getEffectiveRoleName(user).toString().trim().toLowerCase().replace(/\s+/g, '_');
      const defaultPerm =
        (await Permission.findOne({ role: normalized })) ||
        (await Permission.findOne({ role: 'unverified' }));

      user.role = defaultPerm ? defaultPerm._id : null;
      await user.save();
      user = await User.findById(user._id).populate('role');

      logger.track({
        message: 'User role reference was repaired during login.',
        severity: 'WARN',
        req,
        userId: user._id.toString(),
        data: {
          statusCode: 200,
          repairedRole: user.role?.role || '',
        },
        event: {
          category: 'auth_event',
          eventName: 'auth_role_repaired_during_login',
          severity: 'warn',
          statusCode: 200,
        },
      });
    }

    const accessTokenValue = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN },
    );

    const refreshTokenValue = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN },
    );

    user.refreshToken = refreshTokenValue;
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip || req.socket?.remoteAddress || '';
    user.lastLoginUserAgent = (req.get('user-agent') || '').slice(0, 300);
    await user.save();

    const effectiveRoleName = getEffectiveRoleName(user);
    if (
      STAFF_ROLES.has(effectiveRoleName) &&
      (user.roleName !== effectiveRoleName ||
        user.accessRole !== effectiveRoleName.toUpperCase())
    ) {
      user.roleName = effectiveRoleName;
      user.accessRole = effectiveRoleName.toUpperCase();
      await user.save();
    }

    logger.track({
      message: 'Login succeeded.',
      severity: 'INFO',
      req,
      userId: user._id.toString(),
      data: {
        statusCode: 200,
        identifierType: classifyIdentifier(trimmedIdentifier),
        roleName: effectiveRoleName,
        country: user.country,
        countryVerificationStatus: user.countryVerificationStatus || 'unknown',
      },
      event: {
        category: 'auth_event',
        eventName: 'auth_login_success',
        severity: 'info',
        statusCode: 200,
      },
    });

    return res.json({
      user: {
        _id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        phone: user.phoneNumber,
        username: user.username,
        location: user.location,
        verified: user.verified,
        playerId: user.playerId || null,
        role: user.role || {},
        roleName: effectiveRoleName,
        accessRole: user.accessRole || effectiveRoleName.toUpperCase(),
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
    logger.track({
      message: 'Login request failed unexpectedly.',
      severity: 'ERROR',
      req,
      error: err,
      data: {
        statusCode: 500,
      },
      event: {
        category: 'auth_event',
        eventName: 'auth_login_error',
        severity: 'error',
        statusCode: 500,
      },
    });
    return res.status(500).json({ message: 'Server error during login' });
  }
});

router.get('/ping', (_req, res) => {
  res.json({ message: 'Auth route is working.' });
});

module.exports = router;
