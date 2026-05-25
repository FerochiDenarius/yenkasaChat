const express = require('express');

const authMiddleware = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/permissions');
const controller = require('../controllers/yme.controller');
const {
  batchEventLimiter,
  retrievalLimiter,
  singleEventLimiter,
  validateBatchEventRequest,
  validatePayloadSize,
  validateRetrieveRequest,
  validateSingleEventRequest,
} = require('../middleware/yme.middleware');

const router = express.Router();

router.get('/health', controller.getHealth);

router.post(
  '/events',
  authMiddleware,
  singleEventLimiter,
  validatePayloadSize,
  validateSingleEventRequest,
  controller.postEvent,
);
router.post(
  '/events/batch',
  authMiddleware,
  batchEventLimiter,
  validatePayloadSize,
  validateBatchEventRequest,
  controller.postEventBatch,
);
router.get('/profile/:userId', authMiddleware, controller.getProfile);
router.post(
  '/retrieve',
  authMiddleware,
  retrievalLimiter,
  validatePayloadSize,
  validateRetrieveRequest,
  controller.retrieveContext,
);
router.post('/consolidate/:userId', authMiddleware, controller.triggerConsolidation);

router.get('/admin/events', authMiddleware, requirePermission('analyticsAccess'), controller.getRecentEvents);
router.get('/admin/users/search', authMiddleware, requirePermission('analyticsAccess'), controller.searchUsers);
router.get('/admin/logs', authMiddleware, requirePermission('analyticsAccess'), controller.getLogs);
router.get('/admin/metrics', authMiddleware, requirePermission('analyticsAccess'), controller.getMetrics);
router.get('/admin/indexes', authMiddleware, requirePermission('analyticsAccess'), controller.getIndexes);
router.get('/admin/queue-health', authMiddleware, requirePermission('analyticsAccess'), controller.getQueueHealthSnapshot);
router.get('/admin/embeddings', authMiddleware, requirePermission('analyticsAccess'), controller.getEmbeddings);
router.get('/admin/failed-embeddings', authMiddleware, requirePermission('analyticsAccess'), controller.getFailedEmbeddings);
router.post('/admin/retrieve-inspect', authMiddleware, requirePermission('analyticsAccess'), controller.inspectRetrieval);
router.get('/admin/inspector', authMiddleware, requirePermission('analyticsAccess'), controller.getInspectorOverview);
router.get('/admin/observability', authMiddleware, requirePermission('analyticsAccess'), controller.getObservability);
router.get('/admin/observability/live-errors', authMiddleware, requirePermission('analyticsAccess'), controller.getLiveErrors);
router.get('/admin/observability/dashboard', authMiddleware, requirePermission('analyticsAccess'), controller.getObservabilityDashboard);

module.exports = router;
