const express = require('express');
const router = express.Router();
const metricsCtrl = require('../Controller/metrics.controller');
const auth = require('../middleware/auth');

router.get('/:userId/performance-metrics', auth, metricsCtrl.getUserPerformanceMetrics);
router.get('/:userId/post-metrics', auth, metricsCtrl.getUserPostsMetrics);
router.get('/:userId/post-metrics/:postId', auth, metricsCtrl.getSinglePostMetrics);

module.exports = router;
