const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorizeRoles = require('../middleware/authorizeRoles');
const { isYkcLive } = require('../services/ykcEconomy.service');
const {
  upsertDailyAdMetrics,
  aggregateMonthlyAdRevenue,
  calculateAndStoreYkcPayouts
} = require('../services/adRevenue.service');
const {
  storeMonthlyEconomySnapshot,
  getTopCreators,
  getFraudAlerts
} = require('../services/revenueAnalytics.service');

router.use(auth);
router.use(authorizeRoles('ADMIN', 'SENIOR_DEV', 'MODERATOR'));

router.post('/ad-metrics', async (req, res) => {
  try {
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

router.get('/ad-metrics/summary', async (req, res) => {
  try {
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

router.get('/economy/summary', async (req, res) => {
  try {
    const summary = await storeMonthlyEconomySnapshot(req.query.month);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('[YKC Economy] summary failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.statusCode ? err.message : 'Failed to load economy summary'
    });
  }
});

router.get('/economy-summary', async (req, res) => {
  try {
    const summary = await storeMonthlyEconomySnapshot(req.query.month);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('[YKC Economy] summary failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.statusCode ? err.message : 'Failed to load economy summary'
    });
  }
});

router.get('/top-creators', async (req, res) => {
  try {
    const result = await getTopCreators({
      month: req.query.month,
      limit: req.query.limit
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[YKC Economy] top creators failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.statusCode ? err.message : 'Failed to load top creators'
    });
  }
});

router.get('/fraud-alerts', async (req, res) => {
  try {
    const result = await getFraudAlerts({ limit: req.query.limit });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[YKC Economy] fraud alerts failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.statusCode ? err.message : 'Failed to load fraud alerts'
    });
  }
});

router.post('/run-payout', async (req, res) => {
  try {
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
