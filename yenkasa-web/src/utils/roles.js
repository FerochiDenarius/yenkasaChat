const reviewerRoles = new Set([
  "admin",
  "moderator",
  "senior_developer",
  "senior_dev",
]);

const adminFeatureRoles = new Set(["admin", "moderator", "senior_developer", "senior_dev"]);

export function normalizeRoleValue(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return normalizeRoleValue(value[0]);
  }

  if (typeof value === "object") {
    return normalizeRoleValue(
      value.accessRole ||
        value.roleName ||
        value.role ||
        value.name ||
        value.permissions?.name ||
        value.permissions?.role
    );
  }

  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "developer") return "senior_developer";
  if (normalized === "senior") return "senior_developer";
  if (normalized === "senior_dev") return "senior_developer";
  if (normalized === "senior_developer") return "senior_developer";
  if (normalized === "junior") return "junior_developer";
  if (normalized === "admin") return "admin";
  if (normalized === "moderator") return "moderator";
  if (normalized === "user") return "user";
  return normalized;
}

export function getUserRole(user) {
  return normalizeRoleValue(
    user?.accessRole ||
      user?.roleName ||
      user?.role?.accessRole ||
      user?.role?.role ||
      user?.role?.name ||
      user?.role?.permissions?.name ||
      user?.permissions?.name ||
      user?.role
  );
}

export function canAccessAdminFeatures(user) {
  return adminFeatureRoles.has(getUserRole(user));
}

export function canReviewPosts(user) {
  const role = getUserRole(user);
  return (
    reviewerRoles.has(role) ||
    user?.role?.canApprove === true ||
    user?.role?.permissions?.canApprove === true ||
    user?.role?.permissions?.canApprovePost === true ||
    user?.permissions?.canApprove === true ||
    user?.permissions?.canApprovePost === true
  );
}
