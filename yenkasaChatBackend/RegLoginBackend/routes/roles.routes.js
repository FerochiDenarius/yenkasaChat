// routes/roles.routes.js

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const Permission = require('../models/permissions.model');
const RoleActivationCode = require('../models/roleActivationCode.model');

const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args),
};

const STAFF_ROLES = {
  moderator: { label: 'Moderator', codePrefix: 'MOD' },
  admin: { label: 'Admin', codePrefix: 'ADM' },
  junior_developer: { label: 'Junior Developer', codePrefix: 'JDEV' },
  senior_developer: { label: 'Senior Developer', codePrefix: 'SDEV' },
};

const PUBLIC_ROLES = {
  verified_creator: { label: 'Verified Creator', codePrefix: 'VER', legacyRole: 'verified' },
  rising_star: { label: 'Rising Star', codePrefix: 'RSTAR', legacyRole: 'rising_star' },
  legend: { label: 'Legend', codePrefix: 'LEG', legacyRole: 'legend' },
  top_vendor: { label: 'Top Vendor', codePrefix: 'VEND' },
  business_account: { label: 'Business Account', codePrefix: 'BIZ' },
  premium_seller: { label: 'Premium Seller', codePrefix: 'PREM' },
  campus_influencer: { label: 'Campus Influencer', codePrefix: 'CAMP' },
  brand_ambassador: { label: 'Brand Ambassador', codePrefix: 'BRAND' },
};

const ROLE_ALIASES = {
  mod: 'moderator',
  moderator_id: 'moderator',
  adm: 'admin',
  administrator: 'admin',
  admin_id: 'admin',
  jdev: 'junior_developer',
  junior_dev: 'junior_developer',
  junior_developer_id: 'junior_developer',
  sdev: 'senior_developer',
  senior_dev: 'senior_developer',
  senior_developer_id: 'senior_developer',
  super_admin: 'senior_developer',
  superadmin: 'senior_developer',
  verified: 'verified_creator',
  verified_creator_id: 'verified_creator',
  legend_id: 'legend',
  business: 'business_account',
  business_id: 'business_account',
  premium: 'premium_seller',
  premium_seller_id: 'premium_seller',
  campus: 'campus_influencer',
  campus_influencer_id: 'campus_influencer',
};

function normalizeRoleKey(role) {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[normalized] || normalized;
}

function getEffectiveRole(user) {
  return Permission.normalize(
    user?.staffRole ||
      user?.roleName ||
      user?.accessRole ||
      user?.role ||
      'unverified'
  );
}

function toAccessRole(roleKey) {
  return String(roleKey || 'unverified').toUpperCase();
}

function roleLevel(roleKey) {
  return Permission.rankOrder.indexOf(Permission.normalize(roleKey));
}

function isStaffRole(roleKey) {
  return Object.prototype.hasOwnProperty.call(STAFF_ROLES, roleKey);
}

function isPublicRole(roleKey) {
  return Object.prototype.hasOwnProperty.call(PUBLIC_ROLES, roleKey);
}

function canActorAffectRole(actor, targetRole) {
  const actorRole = getEffectiveRole(actor);
  const target = Permission.normalize(targetRole);
  return roleLevel(actorRole) > roleLevel(target);
}

function canActorGrantStaffRole(actor, targetRole) {
  const actorRole = getEffectiveRole(actor);
  const target = Permission.normalize(targetRole);
  if (actorRole === 'senior_developer') return isStaffRole(target);
  return canActorAffectRole(actor, target);
}

function canActorAffectUser(actor, target) {
  return canActorAffectRole(actor, getEffectiveRole(target));
}

function canGenerateCode(actor, roleKey) {
  const actorRole = getEffectiveRole(actor);

  if (isStaffRole(roleKey)) {
    return canActorGrantStaffRole(actor, roleKey);
  }

  if (isPublicRole(roleKey)) {
    return ['admin', 'senior_developer'].includes(actorRole);
  }

  return false;
}

function codeSafeUser(user) {
  return {
    userId: user._id,
    username: user.username,
    email: user.email,
    profileImage: user.profileImage,
    roleName: user.roleName,
    accessRole: user.accessRole,
    staffRole: user.staffRole,
    publicRoles: user.publicRoles || [],
    suspendedUntil: user.suspendedUntil,
  };
}

async function setLegacyRoleFields(user, roleKey) {
  const permission = await Permission.findOne({ role: roleKey }).select('_id role').lean();
  user.roleName = roleKey;
  user.accessRole = toAccessRole(roleKey);
  user.staffRole = isStaffRole(roleKey) ? roleKey : user.staffRole || null;
  if (permission?._id) user.role = permission._id;
}

async function applyRole(user, roleKey) {
  if (isStaffRole(roleKey)) {
    await setLegacyRoleFields(user, roleKey);
    await user.save();
    return;
  }

  if (!isPublicRole(roleKey)) {
    const err = new Error('Unsupported role.');
    err.statusCode = 400;
    throw err;
  }

  const roles = new Set(user.publicRoles || []);
  roles.add(roleKey);
  user.publicRoles = Array.from(roles);

  if (roleKey === 'verified_creator') {
    user.verified = true;
  }

  const legacyRole = PUBLIC_ROLES[roleKey].legacyRole;
  const currentRole = getEffectiveRole(user);
  const currentIsStaff = isStaffRole(currentRole);
  if (legacyRole && !currentIsStaff && roleLevel(legacyRole) > roleLevel(currentRole)) {
    await setLegacyRoleFields(user, legacyRole);
  }

  await user.save();
}

async function clearRole(user, roleKey) {
  if (isStaffRole(roleKey)) {
    const permission = await Permission.findOne({ role: 'unverified' }).select('_id').lean();
    user.staffRole = null;
    user.roleName = 'unverified';
    user.accessRole = 'UNVERIFIED';
    if (permission?._id) user.role = permission._id;
    await user.save();
    return;
  }

  if (isPublicRole(roleKey)) {
    user.publicRoles = (user.publicRoles || []).filter((role) => role !== roleKey);
    await user.save();
  }
}

function buildCode(roleKey) {
  const config = STAFF_ROLES[roleKey] || PUBLIC_ROLES[roleKey];
  const category = isStaffRole(roleKey) ? 'STF' : 'GEN';
  const suffix = crypto.randomBytes(4).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase();
  return `YNK-${category}-${config.codePrefix}-${suffix}`;
}

async function createUniqueCode(roleKey, generatedBy) {
  const roleCategory = isStaffRole(roleKey) ? 'staff' : 'public';
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildCode(roleKey);
    try {
      return await RoleActivationCode.create({
        code,
        roleKey,
        roleCategory,
        generatedBy,
        expiresAt,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  const err = new Error('Unable to generate unique role code.');
  err.statusCode = 500;
  throw err;
}

function sendForbidden(res, message = 'Access denied.') {
  return res.status(403).json({ success: false, error: message, message });
}

// --------------------------------------------
// Role dashboard user search
// --------------------------------------------
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    if (!actor || !['admin', 'senior_developer'].includes(getEffectiveRole(actor))) {
      return sendForbidden(res);
    }

    const search = String(req.query.search || req.query.q || '').trim();
    const scope = String(req.query.scope || 'staff').toLowerCase();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    const query = {};
    const searchFilter = search
      ? {
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : null;

    if (search) {
      query.$and = [searchFilter];
    }

    if (scope === 'staff') {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { staffRole: { $in: Object.keys(STAFF_ROLES) } },
            { roleName: { $in: Object.keys(STAFF_ROLES) } },
            { accessRole: { $in: Object.keys(STAFF_ROLES).map(toAccessRole) } },
          ],
        },
      ];
    } else if (scope === 'general') {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { staffRole: { $exists: false } },
            { staffRole: null },
            { staffRole: { $nin: Object.keys(STAFF_ROLES) } },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('username email profileImage role roleName accessRole staffRole publicRoles suspendedUntil')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('role', 'role name accessRole roleName')
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      users: users.map(codeSafeUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Role user search failed:', err);
    res.status(500).json({ success: false, error: 'Server error loading role users.' });
  }
});

// --------------------------------------------
// Generate one-use role activation code
// --------------------------------------------
router.post('/generate-code', authMiddleware, async (req, res) => {
  try {
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    const roleKey = normalizeRoleKey(req.body.roleKey || req.body.role);

    if (!isStaffRole(roleKey) && !isPublicRole(roleKey)) {
      return res.status(400).json({ success: false, error: 'Unsupported role code type.' });
    }

    if (!actor || !canGenerateCode(actor, roleKey)) {
      return sendForbidden(res, 'You cannot generate this role code.');
    }

    const generated = await createUniqueCode(roleKey, actor._id);
    const config = STAFF_ROLES[roleKey] || PUBLIC_ROLES[roleKey];

    logger.info(`${actor.username} generated ${roleKey} activation code ${generated.code}`);
    res.status(201).json({
      success: true,
      code: generated.code,
      roleKey,
      roleLabel: config.label,
      roleCategory: generated.roleCategory,
      expiresAt: generated.expiresAt,
      expiresInDays: 7,
    });
  } catch (err) {
    logger.error('Generate role code failed:', err);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Server error generating role code.' });
  }
});

router.get('/generated-codes', authMiddleware, async (req, res) => {
  try {
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    if (!actor || !['admin', 'senior_developer'].includes(getEffectiveRole(actor))) {
      return sendForbidden(res);
    }

    const codes = await RoleActivationCode.find({ generatedBy: actor._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      codes: codes.map((item) => ({
        code: item.code,
        roleKey: item.roleKey,
        roleLabel: (STAFF_ROLES[item.roleKey] || PUBLIC_ROLES[item.roleKey])?.label || item.roleKey,
        roleCategory: item.roleCategory,
        expiresAt: item.expiresAt,
        usedAt: item.usedAt,
      })),
    });
  } catch (err) {
    logger.error('Generated role codes failed:', err);
    res.status(500).json({ success: false, error: 'Server error loading generated codes.' });
  }
});

// --------------------------------------------
// Activate one-use role code from profile
// --------------------------------------------
router.post('/activate-code', authMiddleware, async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, error: 'Activation code is required.' });
    }

    const activation = await RoleActivationCode.findOneAndUpdate(
      { code, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date(), usedBy: req.user._id } },
      { new: true }
    );

    if (!activation) {
      return res.status(400).json({ success: false, error: 'Code is invalid, expired, or already used.' });
    }

    const user = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    await applyRole(user, activation.roleKey);

    const updated = await User.findById(user._id)
      .select('-password -refreshToken')
      .populate('role', 'role name accessRole roleName')
      .lean();

    logger.info(`${user.username} activated ${activation.roleKey} with ${activation.code}`);
    res.json({
      success: true,
      message: 'Role activated successfully.',
      roleKey: activation.roleKey,
      roleLabel: (STAFF_ROLES[activation.roleKey] || PUBLIC_ROLES[activation.roleKey])?.label || activation.roleKey,
      user: updated,
    });
  } catch (err) {
    logger.error('Activate role code failed:', err);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Server error activating role code.' });
  }
});

// --------------------------------------------
// Grant / remove role from dashboard or legacy callers
// --------------------------------------------
router.post('/grant/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const roleKey = normalizeRoleKey(req.body.roleKey || req.body.role);
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    const target = await User.findById(userId).populate('role', 'role name accessRole roleName');

    if (!actor || !target) return res.status(404).json({ success: false, error: 'Actor or target not found.' });
    if (!isStaffRole(roleKey) && !isPublicRole(roleKey)) return res.status(400).json({ success: false, error: 'Unsupported role.' });
    if (!canActorAffectUser(actor, target)) return sendForbidden(res, 'Cannot affect equal or higher rank user.');
    if (isStaffRole(roleKey) && !canActorGrantStaffRole(actor, roleKey)) return sendForbidden(res, 'Cannot grant equal or higher role.');
    if (isPublicRole(roleKey) && !['admin', 'senior_developer'].includes(getEffectiveRole(actor))) {
      return sendForbidden(res, 'Not allowed to grant public roles.');
    }

    await applyRole(target, roleKey);
    logger.info(`${actor.username} granted '${roleKey}' to ${target.username}`);
    res.json({ success: true, message: `Role '${roleKey}' granted to ${target.username}`, user: codeSafeUser(target) });
  } catch (err) {
    logger.error('Grant role failed:', err);
    res.status(err.statusCode || 500).json({ success: false, error: 'Server error during role assignment.' });
  }
});

router.post('/remove/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const roleKey = normalizeRoleKey(req.body.roleKey || req.body.role);
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    const target = await User.findById(userId).populate('role', 'role name accessRole roleName');

    if (!actor || !target) return res.status(404).json({ success: false, error: 'Actor or target not found.' });
    if (!isStaffRole(roleKey) && !isPublicRole(roleKey)) return res.status(400).json({ success: false, error: 'Unsupported role.' });
    if (!canActorAffectUser(actor, target)) return sendForbidden(res, 'Cannot affect equal or higher rank user.');
    if (isStaffRole(roleKey) && !canActorGrantStaffRole(actor, roleKey)) return sendForbidden(res, 'Cannot remove equal or higher role.');

    await clearRole(target, roleKey);
    logger.info(`${actor.username} removed '${roleKey}' from ${target.username}`);
    res.json({ success: true, message: `Role '${roleKey}' removed from ${target.username}`, user: codeSafeUser(target) });
  } catch (err) {
    logger.error('Remove role failed:', err);
    res.status(500).json({ success: false, error: 'Server error during role removal.' });
  }
});

// Legacy revoke endpoint keeps previous behavior.
router.post('/revoke/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    const target = await User.findById(userId).populate('role', 'role name accessRole roleName');

    if (!actor || !target) return res.status(404).json({ success: false, error: 'Actor or target not found.' });
    if (!canActorAffectUser(actor, target)) return sendForbidden(res, 'Cannot revoke equal or higher rank user.');

    const roleKey = normalizeRoleKey(req.body.roleKey || req.body.role || getEffectiveRole(target));
    if (!isStaffRole(roleKey) && !isPublicRole(roleKey)) return res.status(400).json({ success: false, error: 'Unsupported role.' });
    if (isStaffRole(roleKey) && !canActorGrantStaffRole(actor, roleKey)) return sendForbidden(res, 'Cannot revoke equal or higher role.');

    await clearRole(target, roleKey);
    logger.info(`${actor.username} revoked '${roleKey}' from ${target.username}`);
    res.json({ success: true, message: `Role revoked for ${target.username}`, user: codeSafeUser(target) });
  } catch (err) {
    logger.error('Legacy revoke role failed:', err);
    res.status(500).json({ success: false, error: 'Server error during role revocation.' });
  }
});

// --------------------------------------------
// Suspend / unsuspend
// --------------------------------------------
router.post('/suspend/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const days = Number(req.body.days || 7);
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    const target = await User.findById(userId).populate('role', 'role name accessRole roleName');

    if (!actor || !target) return res.status(404).json({ success: false, error: 'Actor or target not found.' });
    if (!['moderator', 'admin', 'junior_developer', 'senior_developer'].includes(getEffectiveRole(actor))) {
      return sendForbidden(res, 'Not allowed to suspend users.');
    }
    if (!canActorAffectUser(actor, target)) return sendForbidden(res, 'Cannot suspend equal or higher rank user.');
    if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ success: false, error: 'Invalid suspension duration.' });

    target.suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await target.save();

    logger.info(`${actor.username} suspended ${target.username} for ${days} day(s).`);
    res.json({ success: true, message: `${target.username} suspended for ${days} day(s).`, suspendedUntil: target.suspendedUntil });
  } catch (err) {
    logger.error('Suspend user failed:', err);
    res.status(500).json({ success: false, error: 'Server error during suspension.' });
  }
});

router.post('/unsuspend/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const actor = await User.findById(req.user._id).populate('role', 'role name accessRole roleName');
    const target = await User.findById(userId).populate('role', 'role name accessRole roleName');

    if (!actor || !target) return res.status(404).json({ success: false, error: 'Actor or target not found.' });
    if (!['moderator', 'admin', 'junior_developer', 'senior_developer'].includes(getEffectiveRole(actor))) {
      return sendForbidden(res, 'Not allowed to unsuspend users.');
    }
    if (!canActorAffectUser(actor, target)) return sendForbidden(res, 'Cannot unsuspend equal or higher rank user.');

    target.suspendedUntil = null;
    await target.save();
    logger.info(`${actor.username} unsuspended ${target.username}.`);
    res.json({ success: true, message: `${target.username} unsuspended.` });
  } catch (err) {
    logger.error('Unsuspend user failed:', err);
    res.status(500).json({ success: false, error: 'Server error during unsuspension.' });
  }
});

router.get('/check-suspension/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const suspended = Boolean(user.suspendedUntil && user.suspendedUntil > new Date());
    res.json({ success: true, suspended, suspendedUntil: user.suspendedUntil });
  } catch (err) {
    logger.error('Check suspension failed:', err);
    res.status(500).json({ success: false, error: 'Server error checking suspension.' });
  }
});

module.exports = router;
