function normalizeRole(value) {
  if (!value) return '';

  if (Array.isArray(value)) {
    return normalizeRole(value[0]);
  }

  if (typeof value === 'object') {
    return normalizeRole(
      value.accessRole ||
        value.roleName ||
        value.role ||
        value.name ||
        value.permissions?.role ||
        value.permissions?.name
    );
  }

  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'SENIOR_DEVELOPER' || normalized === 'DEVELOPER') return 'SENIOR_DEV';
  if (normalized === 'JUNIOR_DEVELOPER') return 'JUNIOR_DEV';
  if (normalized === 'UNVERIFIED' || normalized === 'VERIFIED') return 'USER';
  return normalized;
}

function candidateRoles(user) {
  return [
    user?.accessRole,
    user?.roleName,
    user?.role?.accessRole,
    user?.role?.roleName,
    user?.role?.role,
    user?.role?.name,
    typeof user?.role === 'string' ? user.role : ''
  ].map(normalizeRole).filter(Boolean);
}

function authorizeRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles.map(normalizeRole));

  return (req, res, next) => {
    const roles = candidateRoles(req.user);
    const matchedRole = roles.find((role) => allowed.has(role));

    if (!req.user || !matchedRole) {
      console.warn('Unauthorized admin access attempt:', {
        userId: req.user?._id?.toString?.() || req.user?.id,
        role: roles[0] || 'UNKNOWN'
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    req.user.rbacRole = matchedRole;
    next();
  };
}

module.exports = authorizeRoles;
module.exports.normalizeRole = normalizeRole;
