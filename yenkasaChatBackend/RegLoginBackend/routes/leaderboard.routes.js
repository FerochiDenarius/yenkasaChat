const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user.model');

router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const users = await User.find({})
      .select('username profileImage ykcEarnedThisMonth totalQualifiedViews totalMonetizableOpportunities')
      .sort({ ykcEarnedThisMonth: -1, totalMonetizableOpportunities: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      leaderboard: users.map((user, index) => ({
        rank: index + 1,
        userId: user._id,
        username: user.username,
        profileImage: user.profileImage,
        ykcEarnedThisMonth: Number(user.ykcEarnedThisMonth || 0),
        totalQualifiedViews: Number(user.totalQualifiedViews || 0),
        totalMonetizableOpportunities: Number(user.totalMonetizableOpportunities || 0)
      }))
    });
  } catch (err) {
    console.error('[YKC Leaderboard] failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
