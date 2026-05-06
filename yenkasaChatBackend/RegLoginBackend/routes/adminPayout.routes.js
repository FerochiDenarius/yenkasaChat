const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isYkcLive } = require('../services/ykcEconomy.service');
const {
  upsertDailyAdMetrics,
  aggregateMonthlyAdRevenue,
  calculateAndStoreYkcPayouts
} = require('../services/adRevenue.service');

function isAdmin(user) {
  return ['admin', 'senior_developer'].includes((user?.roleName || '').toString().toLowerCase());
}

router.post('/ad-metrics', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const metric = await upsertDailyAdMetrics(req.body);
    return res.json({ success: true, metric });
  } catch (err) {
    console.error('[AdMetrics] save failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.statusCode ? err.message : 'Failed to save ad metrics'
    });
  }
});

router.get('/ad-metrics/summary', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const summary = await aggregateMonthlyAdRevenue(req.query.month);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('[AdMetrics] summary failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.statusCode ? err.message : 'Failed to load ad metrics summary'
    });
  }
});

router.post('/run-payout', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    if (!isYkcLive()) {
      return res.status(423).json({ success: false, error: 'YKC payouts are disabled before go-live' });
    }

    const rewardPoolOverride = req.body.revenuePool ?? req.body.revenue;
    const result = await calculateAndStoreYkcPayouts({
      month: req.body.month,
      rewardPoolOverride
    });

    return res.json({
      success: true,
      calculated: true,
      stored: true,
      month: result.month,
      totalRevenue: result.totalRevenue,
      totalImpressions: result.totalImpressions,
      totalRequests: result.totalRequests,
      rewardPool: result.rewardPool,
      totalEligibleYkc: result.totalEligibleYkc,
      ykcValue: result.ykcValue,
      payouts: result.payouts
    });
  } catch (err) {
    console.error('[YKC Payout] calculation failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.statusCode ? err.message : 'Failed to calculate payout'
    });
  }
});

module.exports = router;
