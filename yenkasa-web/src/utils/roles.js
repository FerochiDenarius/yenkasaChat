import {
  canAccessAnalytics,
  canModerate,
  getPermissions,
  getUserRank,
  normalizeRank,
} from "./permissions";

export const normalizeRoleValue = normalizeRank;
export const getUserRole = getUserRank;

export function canAccessAdminFeatures(user) {
  const permissions = getPermissions(user);
  return permissions.analyticsAccess || permissions.moderationAccess || permissions.rewardEconomyAccess;
}

export function canReviewPosts(user) {
  return canModerate(user);
}

export { canAccessAnalytics, canModerate, getPermissions };
