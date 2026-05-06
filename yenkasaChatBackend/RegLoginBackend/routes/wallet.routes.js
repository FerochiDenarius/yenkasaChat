const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user.model');
const { GO_LIVE_DATE, isYkcLive } = require('../services/ykcEconomy.service');

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('username walletId coinsBalance ykcBalance ykcEarnedThisMonth ykcLastReset totalQualifiedViews totalMonetizableOpportunities')
      .lean();

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const totalCoins = Number(user.coinsBalance || 0);
    const ykcBalance = Number(user.ykcBalance ?? totalCoins);

    return res.json({
      success: true,
      username: user.username,
      walletId: user.walletId,
      totalCoins,
      legacyCoins: totalCoins,
      ykcBalance,
      ykcEarnedThisMonth: Number(user.ykcEarnedThisMonth || 0),
      ykcLastReset: user.ykcLastReset,
      totalQualifiedViews: Number(user.totalQualifiedViews || 0),
      totalMonetizableOpportunities: Number(user.totalMonetizableOpportunities || 0),
      goLiveDate: GO_LIVE_DATE.toISOString(),
      payoutsEnabled: isYkcLive()
    });
  } catch (err) {
    console.error('[Wallet] failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch wallet' });
  }
});

module.exports = router;
