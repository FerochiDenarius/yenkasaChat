const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const auth = require('../../../middleware/auth');
const aiController = require('../controllers/ai.controller');
const { createAiRateLimiter } = require('../utils/rateLimit');
const {
  getRelayStatus,
  probeRelayTargetHealth,
} = require('../../intelligence/services/eventPublisher.service');

const router = express.Router();
const aiRateLimiter = createAiRateLimiter();
const uploadDir = path.join(os.tmpdir(), 'yenkasa-ai-ingest');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    files: 10,
    fileSize: 25 * 1024 * 1024
  }
});

router.get('/modes', auth, aiController.getModes);
router.get('/suggestions', auth, aiRateLimiter, aiController.getSuggestions);
router.get('/relay/health', auth, async (req, res, next) => {
  try {
    const includeProbe = String(req.query.probe || '').toLowerCase() === 'true';
    const relay = getRelayStatus();
    const target = includeProbe ? await probeRelayTargetHealth() : null;
    const healthy = relay.circuit.state !== 'open' && (target == null || target.ok === true);

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      relay,
      target,
    });
  } catch (error) {
    next(error);
  }
});
router.get('/conversations/:conversationId/history', auth, aiRateLimiter, aiController.getConversationHistory);
router.post('/moderate', auth, aiRateLimiter, aiController.moderate);
router.post('/chat', auth, aiRateLimiter, aiController.chat);
router.post('/chat/stream', auth, aiRateLimiter, aiController.streamChat);
router.post('/knowledge/ingest', auth, aiRateLimiter, upload.array('files', 10), aiController.ingestKnowledge);

module.exports = router;
