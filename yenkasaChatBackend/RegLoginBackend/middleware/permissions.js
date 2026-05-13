const RANKS = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
  RISING_STAR: 'RISING_STAR',
  LEGEND: 'LEGEND',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  JUNIOR_DEVELOPER: 'JUNIOR_DEVELOPER',
  SENIOR_DEVELOPER: 'SENIOR_DEVELOPER'
});

const RANK_ORDER = [
  RANKS.UNVERIFIED,
  RANKS.VERIFIED,
  RANKS.RISING_STAR,
  RANKS.LEGEND,
  RANKS.MODERATOR,
  RANKS.ADMIN,
  RANKS.JUNIOR_DEVELOPER,
  RANKS.SENIOR_DEVELOPER
];

const PERMISSIONS = Object.freeze({
  [RANKS.UNVERIFIED]: {},
  [RANKS.VERIFIED]: {},
  [RANKS.RISING_STAR]: {},
  [RANKS.LEGEND]: {},
  [RANKS.ADMIN]: {
    analyticsAccess: true,
    moderationAccess: true,
    rewardEconomyAccess: true,
    fraudMonitorAccess: true
  },
  [RANKS.MODERATOR]: {
    analyticsAccess: true,
    moderationAccess: true,
    fraudMonitorAccess: true
  },
  [RANKS.JUNIOR_DEVELOPER]: {
    analyticsAccess: true
  },
  [RANKS.SENIOR_DEVELOPER]: {
    analyticsAccess: true,
    moderationAccess: true,
    rewardEconomyAccess: true,
    fraudMonitorAccess: true
  }
});

const REVIEWER_RANKS = Object.freeze([
  RANKS.ADMIN,
  RANKS.MODERATOR,
  RANKS.JUNIOR_DEVELOPER,
  RANKS.SENIOR_DEVELOPER
]);

function normalizeRank(value) {
  if (!value) return RANKS.UNVERIFIED;

  if (Array.isArray(value)) {
    return normalizeRank(value[0]);
  }

  if (typeof value === 'object') {
    return normalizeRank(
      value.accessRole ||
        value.roleName ||
        value.role ||
        value.name ||
        value.permissions?.role ||
        value.permissions?.name
    );
  }

  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!normalized || normalized === 'NULL') return RANKS.UNVERIFIED;
  if (normalized === 'USER') return RANKS.UNVERIFIED;
  if (normalized === 'VERIFIED_CREATOR') return RANKS.VERIFIED;
  if (normalized === 'SENIOR' || normalized === 'SENIOR_DEV' || normalized === 'DEVELOPER') {
    return RANKS.SENIOR_DEVELOPER;
  }
  if (normalized === 'JUNIOR' || normalized === 'JUNIOR_DEV') return RANKS.JUNIOR_DEVELOPER;
  if (normalized === 'RISINGSTAR') return RANKS.RISING_STAR;
  if (RANKS[normalized]) return RANKS[normalized];
  return normalized;
}

function getUserRank(user) {
  const staffRank = normalizeRank(user?.staffRole);
  if (RANK_ORDER.includes(staffRank) && RANK_ORDER.indexOf(staffRank) >= RANK_ORDER.indexOf(RANKS.MODERATOR)) {
    return staffRank;
  }

  const publicRanks = (user?.publicRoles || [])
    .map(normalizeRank)
    .filter((rank) => RANK_ORDER.includes(rank));

  const candidates = [
    user?.roleName,
    user?.accessRole,
    user?.role?.accessRole,
    user?.role?.roleName,
    user?.role?.role,
    user?.role?.name,
    typeof user?.role === 'string' ? user.role : '',
    ...publicRanks
  ]
    .map(normalizeRank)
    .filter(Boolean);

  const knownRanks = candidates.filter((rank) => RANK_ORDER.includes(rank));
  if (!knownRanks.length) return candidates[0] || RANKS.UNVERIFIED;

  return knownRanks.reduce((highest, rank) => (
    RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(highest) ? rank : highest
  ), RANKS.UNVERIFIED);
}

function getPermissions(userOrRank) {
  const rank = typeof userOrRank === 'string' ? normalizeRank(userOrRank) : getUserRank(userOrRank);
  return {
    rank,
    rankLevel: RANK_ORDER.indexOf(rank),
    analyticsAccess: false,
    moderationAccess: false,
    rewardEconomyAccess: false,
    fraudMonitorAccess: false,
    ...(PERMISSIONS[rank] || {})
  };
}

function hasPermission(user, permission) {
  return getPermissions(user)[permission] === true;
}

function canAccessAnalytics(user) {
  return hasPermission(user, 'analyticsAccess');
}

function canModerate(user) {
  return hasPermission(user, 'moderationAccess');
}

function canManageEconomy(user) {
  return hasPermission(user, 'rewardEconomyAccess');
}

function canApproveContent(user) {
  return REVIEWER_RANKS.includes(getPermissions(user).rank);
}

function canCreateAd(user) {
  return user?.verified === true || canApproveContent(user);
}

function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = getPermissions(req.user);
    console.log('[RBAC] permission check', {
      userId: req.user?._id?.toString?.() || req.user?.id,
      rank: permissions.rank,
      permission,
      allowed: permissions[permission] === true
    });

    if (!req.user || permissions[permission] !== true) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    req.user.rank = permissions.rank;
    req.user.permissions = permissions;
    next();
  };
}

module.exports = {
  RANKS,
  RANK_ORDER,
  PERMISSIONS,
  REVIEWER_RANKS,
  normalizeRank,
  getUserRank,
  getPermissions,
  hasPermission,
  canAccessAnalytics,
  canModerate,
  canManageEconomy,
  canApproveContent,
  canCreateAd,
  requirePermission
};
