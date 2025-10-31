// routes/appverification.routes.js - PHASED VERIFICATION SYSTEM (updated to use controller)
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const appVerificationController = require('../Controller/appVerification.controller');

// ✅ Fetch full verification dashboard
router.get('/dashboard', authMiddleware, appVerificationController.getDashboard);

// ✅ Track daily login progress
router.post('/track-login', authMiddleware, appVerificationController.trackLogin);

// ✅ Track ad views
router.post('/track-ad-view', authMiddleware, appVerificationController.trackAdView);

// ✅ Verify phase progression (monthly or manual)
router.post('/check-phase-advancement', authMiddleware, appVerificationController.checkPhaseAdvancement);

// ✅ Update verification metrics from external services
router.post('/update-metrics', authMiddleware, appVerificationController.updateMetrics);

// ✅ Fetch verification progress percentage
router.get('/progress', authMiddleware, appVerificationController.getProgress);

module.exports = router;
