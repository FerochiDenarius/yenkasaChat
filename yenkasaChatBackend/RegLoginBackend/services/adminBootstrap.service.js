const Permission = require('../models/permissions.model');

const DEFAULT_PRIVILEGED_ADMIN_EMAILS = [
  'ki.longrich@gmail.com',
  'kofiinspirion@gmail.com',
  'ofosumenyabrightkofi@gmail.com',
  'ferochidenarius@gmail.com',
  'joanaamoquandoh21@gmail.com',
  'kwesihudson12@gmail.com',
];

function configuredAdminEmails() {
  const raw = process.env.SOFTOTECH_ADMIN_EMAILS || process.env.ADMIN_EMAILS || DEFAULT_PRIVILEGED_ADMIN_EMAILS.join(',');
  return new Set(
    String(raw)
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isPrivilegedAdminEmail(email) {
  return configuredAdminEmails().has(normalizeEmail(email));
}

async function applyPrivilegedRole(user) {
  if (!user || !isPrivilegedAdminEmail(user.email)) return false;

  const permission = await Permission.findOne({ role: 'senior_developer' }).select('_id').lean().catch(() => null);
  user.staffRole = 'senior_developer';
  user.roleName = 'senior_developer';
  user.accessRole = 'SENIOR_DEVELOPER';
  if (permission?._id) user.role = permission._id;
  return true;
}

module.exports = {
  DEFAULT_PRIVILEGED_ADMIN_EMAILS,
  applyPrivilegedRole,
  configuredAdminEmails,
  isPrivilegedAdminEmail,
};
