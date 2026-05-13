const STAFF_UNLIMITED_ROLES = new Set([
  'senior_developer',
  'admin',
  'moderator',
  'junior_developer'
]);

const RANK_DURATION_LIMITS_MINUTES = {
  verified_creator: 20,
  verified: 20,
  rising_star: 40,
  yklegend: 50,
  legend: 50,
  business_account: 60,
  premium_seller: 70,
  campus_influencer: 80
};

const ACTIVE_CREATOR_ROLES = new Set([
  'senior_developer'
]);

function normalizeRole(role) {
  return role?.toString?.().trim().toLowerCase().replace(/[\s-]+/g, '_') || '';
}

function getUserRoleSet(user) {
  return new Set([
    normalizeRole(user?.staffRole),
    normalizeRole(user?.roleName),
    normalizeRole(user?.accessRole),
    ...(Array.isArray(user?.publicRoles) ? user.publicRoles.map(normalizeRole) : [])
  ].filter(Boolean));
}

function hasActiveSuspension(user) {
  return user?.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now();
}

function canStartLivestream(user) {
  if (!user || hasActiveSuspension(user)) {
    return {
      allowed: false,
      reason: 'Your account is not eligible to start livestreams.'
    };
  }

  const roles = getUserRoleSet(user);
  const activeRole = Array.from(roles).find(role => ACTIVE_CREATOR_ROLES.has(role));
  if (!activeRole) {
    return {
      allowed: false,
      reason: 'Your account is not eligible to start livestreams.'
    };
  }

  const unlimitedRole = Array.from(roles).find(role => STAFF_UNLIMITED_ROLES.has(role));
  if (unlimitedRole) {
    return {
      allowed: true,
      role: unlimitedRole,
      maxDurationMinutes: null,
      unlimited: true
    };
  }

  const limitedRole = Array.from(roles).find(role => RANK_DURATION_LIMITS_MINUTES[role]);
  return {
    allowed: true,
    role: limitedRole || activeRole,
    maxDurationMinutes: limitedRole ? RANK_DURATION_LIMITS_MINUTES[limitedRole] : null,
    unlimited: !limitedRole
  };
}

module.exports = {
  ACTIVE_CREATOR_ROLES,
  RANK_DURATION_LIMITS_MINUTES,
  STAFF_UNLIMITED_ROLES,
  canStartLivestream,
  getUserRoleSet,
  normalizeRole
};
