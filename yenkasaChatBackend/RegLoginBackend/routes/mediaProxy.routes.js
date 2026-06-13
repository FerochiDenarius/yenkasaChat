const express = require('express');
const multer = require('multer');

const mediaStorage = require('../services/mediaStorage.service');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 120 * 1024 * 1024 },
});

function mediaProxySecret() {
  return process.env.MEDIA_STORAGE_PROXY_SECRET ||
    process.env.GCS_MEDIA_PROXY_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    '';
}

function requireProxySecret(req, res, next) {
  const expected = mediaProxySecret();
  const provided = req.get('x-media-proxy-secret') || '';
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: 'Media proxy access denied.' });
  }
  return next();
}

router.post('/upload', requireProxySecret, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Media file is required.' });
  }

  try {
    const result = await mediaStorage.uploadToGcs(req.file, {
      folder: req.body.folder,
      type: req.body.type,
      resourceType: req.body.resourceType,
      prefix: req.body.prefix,
      area: req.body.area,
      contentType: req.body.contentType,
      objectName: req.body.objectName,
    });
    return res.json({ success: true, result });
  } catch (error) {
    console.error('[MediaProxy] GCS upload failed:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Media proxy upload failed.' });
  }
});

module.exports = router;
