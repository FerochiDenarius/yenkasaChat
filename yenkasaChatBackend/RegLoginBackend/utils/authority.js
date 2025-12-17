const Permission = require("../models/permissions.model");

/**
 * Normalize role using Permission model
 */
const normalizeRole = (role) => {
  return Permission.normalize(role);
};

/**
 * Get numeric rank for a role
 * Higher number = higher authority
 */
const getRoleRank = (role) => {
  const r = normalizeRole(role);
  return Permission.rankOrder.indexOf(r);
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
  return Permission.canAffect(targetRole, actorRole);
};

/**
 * Capability shortcuts (thin wrappers)
 */
const canApprove = (role) => Permission.canApprove(role);
const canSuspend = (role) => Permission.canSuspend(role);
const canAssignRoles = (role) => Permission.canAssignRoles(role);

module.exports = {
  normalizeRole,
  getRoleRank,
  hasMinimumRole,
  canAffectUser,
  canApprove,
  canSuspend,
  canAssignRoles,
};
