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
router.get('/metrics', authMiddleware, requirePermission('analyticsAccess'), controller.getMetrics);
router.get('/event-stats', authMiddleware, requirePermission('analyticsAccess'), controller.getEventStats);

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
router.get('/admin/dead-letters', authMiddleware, requirePermission('analyticsAccess'), controller.getDeadLetters);
router.get('/admin/indexes', authMiddleware, requirePermission('analyticsAccess'), controller.getIndexes);
router.get('/admin/queue-health', authMiddleware, requirePermission('analyticsAccess'), controller.getQueueHealthSnapshot);
router.get('/admin/embeddings', authMiddleware, requirePermission('analyticsAccess'), controller.getEmbeddings);
router.get('/admin/failed-embeddings', authMiddleware, requirePermission('analyticsAccess'), controller.getFailedEmbeddings);
router.post('/admin/retrieve-inspect', authMiddleware, requirePermission('analyticsAccess'), controller.inspectRetrieval);
router.get('/admin/inspector', authMiddleware, requirePermission('analyticsAccess'), controller.getInspectorOverview);

module.exports = router;
