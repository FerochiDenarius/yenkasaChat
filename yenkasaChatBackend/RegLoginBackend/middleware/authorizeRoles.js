const { normalizeRank, getUserRank } = require('./permissions');

function normalizeRole(value) {
  return normalizeRank(value);
}

function candidateRoles(user) {
  return [getUserRank(user)].filter(Boolean);
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
