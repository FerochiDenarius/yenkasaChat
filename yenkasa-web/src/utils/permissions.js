export const RANKS = Object.freeze({
  UNVERIFIED: "unverified",
  VERIFIED: "verified",
  RISING_STAR: "rising_star",
  LEGEND: "legend",
  ADMIN: "admin",
  MODERATOR: "moderator",
  JUNIOR_DEVELOPER: "junior_developer",
  SENIOR_DEVELOPER: "senior_developer",
});

const PERMISSIONS = Object.freeze({
  [RANKS.UNVERIFIED]: {},
  [RANKS.VERIFIED]: {},
  [RANKS.RISING_STAR]: {},
  [RANKS.LEGEND]: {},
  [RANKS.ADMIN]: {
    analyticsAccess: true,
    moderationAccess: true,
    rewardEconomyAccess: true,
    fraudMonitorAccess: true,
  },
  [RANKS.MODERATOR]: {
    analyticsAccess: true,
    moderationAccess: true,
    fraudMonitorAccess: true,
  },
  [RANKS.JUNIOR_DEVELOPER]: {
    analyticsAccess: true,
  },
  [RANKS.SENIOR_DEVELOPER]: {
    analyticsAccess: true,
    moderationAccess: true,
    rewardEconomyAccess: true,
    fraudMonitorAccess: true,
  },
});

export function normalizeRank(value) {
  if (!value) return RANKS.UNVERIFIED;

  if (Array.isArray(value)) {
    return normalizeRank(value[0]);
  }

  if (typeof value === "object") {
    return normalizeRank(
      value.accessRole ||
        value.roleName ||
        value.role ||
        value.name ||
        value.permissions?.name ||
        value.permissions?.role
    );
  }

  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized || normalized === "null" || normalized === "user") return RANKS.UNVERIFIED;
  if (normalized === "developer" || normalized === "senior" || normalized === "senior_dev") {
    return RANKS.SENIOR_DEVELOPER;
  }
  if (normalized === "junior" || normalized === "junior_dev") return RANKS.JUNIOR_DEVELOPER;
  if (normalized === "risingstar") return RANKS.RISING_STAR;
  return normalized;
}

export function getUserRank(user) {
  return normalizeRank(
    user?.accessRole ||
      user?.roleName ||
      user?.role?.accessRole ||
      user?.role?.role ||
      user?.role?.roleName ||
      user?.role?.name ||
      user?.role?.permissions?.name ||
      user?.permissions?.name ||
      user?.role
  );
}

export function getPermissions(userOrRank) {
  const rank = typeof userOrRank === "string" ? normalizeRank(userOrRank) : getUserRank(userOrRank);
  return {
    rank,
    analyticsAccess: false,
    moderationAccess: false,
    rewardEconomyAccess: false,
    fraudMonitorAccess: false,
    ...(PERMISSIONS[rank] || {}),
  };
}

export function canAccessAnalytics(user) {
  return getPermissions(user).analyticsAccess;
}

export function canModerate(user) {
  return getPermissions(user).moderationAccess;
}

export function canManageEconomy(user) {
  return getPermissions(user).rewardEconomyAccess;
}

export function canMonitorFraud(user) {
  return getPermissions(user).fraudMonitorAccess;
}
