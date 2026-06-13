const express = require('express');
const multer = require('multer');

const auth = require('../middleware/auth');
const { getPermissions } = require('../middleware/permissions');
const { logUploadAudit } = require('../utils/cloudinaryMedia');
const mediaStorage = require('../services/mediaStorage.service');
const portfolioContent = require('../services/portfolioContent.service');

const router = express.Router();

const ALLOWED_PRODUCTS = new Set([
  'yenkasa-app',
  'yenkasa-store',
  'yenkasa-ai',
  'yenkasa-web',
  'ecosystem',
  'softotech-services',
  'client-projects',
  'future-products',
]);
const ALLOWED_TYPES = new Set(['screenshots', 'videos']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 120 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    cb(isImage || isVideo ? null : new Error('Only image and video uploads are supported.'), isImage || isVideo);
  },
});

function cleanSegment(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function portfolioAdminOnly(req, res, next) {
  const permissions = getPermissions(req.user);
  const allowed = ['ADMIN', 'SENIOR_DEVELOPER'].includes(permissions.rank);
  if (!allowed) {
    return res.status(403).json({ success: false, error: 'Portfolio admin access requires admin or senior developer role.' });
  }
  return next();
}

function resolveUploadTarget(req, file) {
  const product = cleanSegment(req.body.product, 'yenkasa-app');
  const requestedType = cleanSegment(req.body.type, 'screenshots');
  const inferredType = file.mimetype.startsWith('video/') ? 'videos' : 'screenshots';
  const type = ALLOWED_TYPES.has(requestedType) ? requestedType : inferredType;

  if (!ALLOWED_PRODUCTS.has(product)) {
    const error = new Error('Unsupported portfolio product.');
    error.statusCode = 400;
    throw error;
  }

  if (type === 'screenshots' && !file.mimetype.startsWith('image/')) {
    const error = new Error('Screenshot uploads must be image files.');
    error.statusCode = 400;
    throw error;
  }

  if (type === 'videos' && !file.mimetype.startsWith('video/')) {
    const error = new Error('Video uploads must be video files.');
    error.statusCode = 400;
    throw error;
  }

  return {
    product,
    type,
    folder: type === 'videos' ? 'videos' : 'posts',
    prefix: `portfolio-${product}-${type}`,
    resourceType: type === 'videos' ? 'video' : 'image',
  };
}

router.get('/admin/verify', auth, portfolioAdminOnly, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user?._id?.toString?.() || req.user?.id,
      username: req.user?.username,
      email: req.user?.email,
      rank: getPermissions(req.user).rank,
    },
  });
});

router.get('/content', async (req, res) => {
  try {
    const content = await portfolioContent.getContent();
    res.json({
      success: true,
      content,
      collection: portfolioContent.collectionName(),
    });
  } catch (err) {
    console.error('[PortfolioMedia] content load failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load portfolio content.' });
  }
});

router.put('/content', auth, portfolioAdminOnly, async (req, res) => {
  try {
    const content = await portfolioContent.saveContent(req.body?.content || req.body || {}, {
      id: req.user?._id?.toString?.() || req.user?.id,
      email: req.user?.email,
    });
    res.json({
      success: true,
      content,
      collection: portfolioContent.collectionName(),
    });
  } catch (err) {
    console.error('[PortfolioMedia] content save failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save portfolio content.' });
  }
});

router.post('/media', auth, portfolioAdminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No portfolio media file uploaded.' });
  }

  try {
    const target = resolveUploadTarget(req, req.file);
    const result = await mediaStorage.upload(req.file, {
      folder: target.folder,
      type: target.resourceType,
      prefix: target.prefix,
      area: `portfolio_${target.product}_${target.type}`,
    });
    logUploadAudit({ area: `portfolio_${target.product}_${target.type}`, file: req.file, result });

    res.json({
      success: true,
      product: target.product,
      type: target.type,
      title: req.body.title || req.file.originalname,
      url: result.secure_url,
      publicId: result.public_id,
      folder: target.folder,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      bytes: result.bytes,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[PortfolioMedia] media upload failed:', err.message);
    res.status(statusCode).json({ error: statusCode === 500 ? 'Failed to upload portfolio media.' : err.message });
  }
});

module.exports = router;
