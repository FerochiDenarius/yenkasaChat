const portal = require('../services/softOTechPortal.service');

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function portalAuth(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Missing portal token.' });
    const decoded = portal.verifyPortalToken(token);
    const client = await portal.getClientById(decoded.portalUserId);
    if (!client) return res.status(401).json({ success: false, message: 'Portal account not found.' });
    req.portalUser = client;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired portal token.' });
  }
}

function portalAdminOnly(req, res, next) {
  if (!req.portalUser?.is_admin && req.portalUser?.role !== 'senior_developer') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  return next();
}

module.exports = {
  bearerToken,
  portalAdminOnly,
  portalAuth,
};
