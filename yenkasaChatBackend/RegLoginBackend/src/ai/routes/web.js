const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const aiWebController = require('../controllers/aiWeb.controller');
const { createAiRateLimiter } = require('../utils/rateLimit');

const router = express.Router();
const aiRateLimiter = createAiRateLimiter();
const uploadDir = path.join(os.tmpdir(), 'yenkasa-ai-web-ingest');

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    files: 10,
    fileSize: 25 * 1024 * 1024,
  },
});

router.get('/health', aiRateLimiter, aiWebController.health);
router.post('/chat', aiRateLimiter, aiWebController.chat);
router.post('/ingest', aiRateLimiter, upload.array('files', 10), aiWebController.ingest);
router.get('/ingest/jobs', aiRateLimiter, aiWebController.ingestJobs);

module.exports = router;
