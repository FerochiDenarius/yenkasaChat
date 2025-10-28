const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Community = require('../models/community');

// Fix users whose community field is a string instead of ObjectId
const fixCommunities = async (req, res) => {
  try {
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

    return res.json({ success: true, updated, message: `Updated ${updated} users.` });
  } catch (err) {
    console.error('❌ Error fixing community fields:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Allow both GET and POST for convenience
router.get('/', fixCommunities);
router.post('/', fixCommunities);

module.exports = router;
