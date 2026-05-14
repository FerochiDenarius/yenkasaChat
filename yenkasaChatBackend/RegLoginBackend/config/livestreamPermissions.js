const STAFF_UNLIMITED_ROLES = new Set([
  'senior_developer',
  'admin',
  'moderator',
  'junior_developer',
  'staff',
  'support',
  'analyst'
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

const ACTIVE_CREATOR_ROLES = new Set(STAFF_UNLIMITED_ROLES);

function normalizeRole(role) {
  return role?.toString?.().trim().toLowerCase().replace(/[\s-]+/g, '_') || '';
}

function getUserRoleSet(user) {
  const roleObject = user?.role && typeof user.role === 'object' ? user.role : null;
  return new Set([
    normalizeRole(user?.staffRole),
    normalizeRole(user?.roleName),
    normalizeRole(user?.accessRole),
    normalizeRole(roleObject?.roleName),
    normalizeRole(roleObject?.name),
    normalizeRole(roleObject?.accessRole),
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
  const staffRole = Array.from(roles).find(role => STAFF_UNLIMITED_ROLES.has(role));
  if (!staffRole) {
    return {
      allowed: false,
      reason: 'Only Yenkasa staff can start livestreams. You can still watch active livestreams.'
    };
  }

  return {
    allowed: true,
    role: staffRole,
    maxDurationMinutes: null,
    unlimited: true
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
