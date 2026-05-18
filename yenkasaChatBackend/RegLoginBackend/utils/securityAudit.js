const buckets = new Map();

function normalizeRoleKey(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function roleKeysForUser(user = {}) {
  return [
    user.staffRole,
    user.roleName,
    user.accessRole,
    user.role?.role,
    user.role?.name,
    user.permissions?.rank,
    user.rank
  ].map(normalizeRoleKey).filter(Boolean);
}

function hasAnyRole(user, allowedRoles = []) {
  const allowed = new Set(allowedRoles.map(normalizeRoleKey));
  return roleKeysForUser(user).some((role) => allowed.has(role));
}

function auditSecurityEvent(event, req, details = {}) {
  const user = req?.user || {};
  console.warn("[SecurityAudit]", {
    event,
    userId: user.id || user._id || null,
    username: user.username || null,
    roles: roleKeysForUser(user),
    ip: req?.ip || req?.socket?.remoteAddress || null,
    userAgent: req?.get?.("user-agent") || null,
    path: req?.originalUrl || req?.url || null,
    method: req?.method || null,
    timestamp: new Date().toISOString(),
    ...details
  });
}

function requireRoles(allowedRoles, options = {}) {
  const label = options.label || "restricted_endpoint";

  return (req, res, next) => {
    if (hasAnyRole(req.user, allowedRoles)) {
      return next();
    }

    auditSecurityEvent("unauthorized_restricted_endpoint", req, {
      label,
      allowedRoles: allowedRoles.map(normalizeRoleKey)
    });

    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "You do not have permission to perform this action."
    });
  };
}

function createMemoryRateLimiter({ windowMs = 60_000, max = 20, label = "rate_limit" } = {}) {
  return (req, res, next) => {
    const userId = req.user?.id || req.user?._id || "anonymous";
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${label}:${userId}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      auditSecurityEvent("rate_limit_exceeded", req, { label, count: bucket.count });
      return res.status(429).json({
        success: false,
        error: "Too many requests",
        message: "Please wait before trying again."
      });
    }

    return next();
  };
}

module.exports = {
  auditSecurityEvent,
  createMemoryRateLimiter,
  hasAnyRole,
  normalizeRoleKey,
  requireRoles,
  roleKeysForUser
};
