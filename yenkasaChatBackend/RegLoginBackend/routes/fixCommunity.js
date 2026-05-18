const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Community = require('../models/community.model');
const authMiddleware = require('../middleware/auth');
const {
  auditSecurityEvent,
  createMemoryRateLimiter,
  requireRoles
} = require('../utils/securityAudit');

const maintenanceLimiter = createMemoryRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 3,
  label: 'fix_community'
});
const maintenanceOnly = requireRoles(['admin', 'senior_developer'], { label: 'fix_community' });

// Fix users whose community field is a string instead of ObjectId
const fixCommunities = async (req, res) => {
  try {
    auditSecurityEvent('maintenance_fix_communities_started', req);
    const users = await User.find({ community: { $type: 'string' } });
    let updated = 0;

    for (const user of users) {
      const community = await Community.findOne({ name: user.community });
      if (community) {
        user.community = community._id;
        await user.save();
        updated++;
        console.log(`✅ Updated ${user.username} -> ${community.name}`);
      } else {
        console.log(`⚠️ No matching community for ${user.username} (${user.community})`);
      }
    }

    auditSecurityEvent('maintenance_fix_communities_completed', req, { updated });
    return res.json({ success: true, updated, message: `Updated ${updated} users.` });
  } catch (err) {
    console.error('❌ Error fixing community fields:', err);
    return res.status(500).json({ error: err.message });
  }
};

router.get('/', authMiddleware, maintenanceLimiter, maintenanceOnly, fixCommunities);
router.post('/', authMiddleware, maintenanceLimiter, maintenanceOnly, fixCommunities);

module.exports = router;
