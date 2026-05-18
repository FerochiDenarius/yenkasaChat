const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const appVerificationController = require('../Controller/appVerification.controller');
const { createMemoryRateLimiter } = require('../utils/securityAudit');

const metricWriteLimiter = createMemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 12,
  label: 'app_verification_metric_write'
});

// ✅ GET /app-verification/dashboard
router.get('/dashboard', auth, appVerificationController.getDashboard);

// ✅ POST /app-verification/track-login
router.post('/track-login', auth, appVerificationController.trackLogin);

// ✅ POST /app-verification/track-ad-view
router.post('/track-ad-view', auth, metricWriteLimiter, appVerificationController.trackAdView);

// ✅ POST /app-verification/update-metrics
router.post('/update-metrics', auth, metricWriteLimiter, appVerificationController.updateMetrics);

// ✅ POST /app-verification/check-phase-advancement
router.post('/check-phase-advancement', auth, appVerificationController.checkPhaseAdvancement);

// ✅ GET /app-verification/progress
router.get('/progress', auth, appVerificationController.getProgress);

module.exports = router;
