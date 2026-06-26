const jwt = require('jsonwebtoken');

const User = require('../../../models/user.model');
const { getPermissions } = require('../../../middleware/permissions');
const portal = require('../../projectManagement/services/softOTechPortal.service');

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function publicUser(portalUser) {
  return {
    id: portalUser.id,
    email: portalUser.email,
    username: portalUser.fullName,
    rank: 'SENIOR_DEVELOPER',
    source: 'softotech_portal',
  };
}

async function portfolioAdminAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Portfolio admin login is required.' });
  }

  try {
    const decoded = portal.verifyPortalToken(token);
    const portalUser = await portal.getClientById(decoded.portalUserId);
    if (portalUser?.is_admin || portalUser?.role === 'senior_developer') {
      req.portfolioUser = publicUser(portalUser);
      return next();
    }
    return res.status(403).json({ success: false, error: 'Portfolio admin access requires admin or senior developer role.' });
  } catch (error) {
    // Continue to legacy Yenkasa app access token verification.
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decoded?.userId) {
      return res.status(401).json({ success: false, error: 'Invalid admin token.' });
    }
    const user = await User.findById(decoded.userId)
      .select('-password -refreshToken -emailVerificationCode -verificationCode -phoneVerificationCode -passwordResetToken -passwordResetExpires')
      .populate('role', 'role name accessRole roleName');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Admin user not found.' });
    }

    const permissions = getPermissions(user);
    if (!['ADMIN', 'SENIOR_DEVELOPER'].includes(permissions.rank)) {
      return res.status(403).json({ success: false, error: 'Portfolio admin access requires admin or senior developer role.' });
    }

    req.user = user;
    req.portfolioUser = {
      id: user._id?.toString?.() || user.id,
      email: user.email,
      username: user.username,
      rank: permissions.rank,
      source: 'yenkasa_app',
    };
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired portfolio admin token.' });
  }
}

module.exports = {
  portfolioAdminAuth,
};
