const { RANK_ORDER, normalizeRank } = require("../middleware/permissions");

/**
 * Normalize role using Permission model
 */
const normalizeRole = (role) => {
  return normalizeRank(role).toLowerCase();
};

/**
 * Get numeric rank for a role
 * Higher number = higher authority
 */
const getRoleRank = (role) => {
  const r = normalizeRank(role);
  return RANK_ORDER.indexOf(r);
};

/**
 * Check if acting role has at least required role
 * Example: hasMinimumRole(actor, "admin")
 */
const hasMinimumRole = (actorRole, requiredRole) => {
  const actorRank = getRoleRank(actorRole);
  const requiredRank = getRoleRank(requiredRole);
  return actorRank >= requiredRank;
};

/**
 * Check if actor can affect target (must outrank)
 * Used for suspend / revoke / delete user
 */
const canAffectUser = (actorRole, targetRole) => {
  const actorRank = getRoleRank(actorRole);
  const targetRank = getRoleRank(targetRole);
  return actorRank > targetRank;
};

/**
 * Capability shortcuts (thin wrappers)
 */
const canApprove = (role) => hasMinimumRole(role, "moderator");
const canSuspend = (role) => hasMinimumRole(role, "junior_developer");
const canAssignRoles = (role) => hasMinimumRole(role, "moderator");

module.exports = {
  normalizeRole,
  getRoleRank,
  hasMinimumRole,
  canAffectUser,
  canApprove,
  canSuspend,
  canAssignRoles,
};
