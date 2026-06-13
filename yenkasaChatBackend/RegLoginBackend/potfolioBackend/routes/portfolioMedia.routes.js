const express = require('express');
const multer = require('multer');

const { portfolioAdminAuth } = require('../middleware/portfolioAdminAuth.middleware');
const { logUploadAudit } = require('../../utils/cloudinaryMedia');
const mediaStorage = require('../../services/mediaStorage.service');
const portfolioContent = require('../services/portfolioContent.service');
const portal = require('../../services/softOTechPortal.service');
const { isPrivilegedAdminEmail } = require('../../services/adminBootstrap.service');

const router = express.Router();

const PRODUCT_ID_ALIASES = {
  'yenkasa-app': 'app',
  'yenkasa-store': 'store',
  'yenkasa-ai': 'ai',
  'yenkasa-web': 'web',
  'softotech-services': 'services',
  'future-products': 'future',
};

const ALLOWED_PRODUCTS = new Set([
  'app',
  'store',
  'ai',
  'web',
  'ecosystem',
  'services',
  'client-projects',
  'future',
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

function normalizeProductId(value) {
  const cleaned = cleanSegment(value, 'app');
  return PRODUCT_ID_ALIASES[cleaned] || cleaned;
}

function resolveUploadTarget(req, file) {
  const product = normalizeProductId(req.body.product);
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

router.get('/admin/verify', portfolioAdminAuth, async (req, res) => {
  res.json({
    success: true,
    user: req.portfolioUser,
  });
});

router.post('/auth/register', async (req, res) => {
  try {
    if (!isPrivilegedAdminEmail(req.body?.email)) {
      return res.status(403).json({ success: false, message: 'Portfolio admin access is not enabled for this account.' });
    }
    const result = await portal.registerClient(req.body || {});
    if (!result.client?.is_admin && result.client?.role !== 'senior_developer') {
      return res.status(403).json({ success: false, message: 'Portfolio admin access is not enabled for this account.' });
    }
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Registration failed.' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const result = await portal.loginClient(req.body || {});
    if (!result.client?.is_admin && result.client?.role !== 'senior_developer') {
      return res.status(403).json({ success: false, message: 'Portfolio admin access is not enabled for this account.' });
    }
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Login failed.' });
  }
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

router.put('/content', portfolioAdminAuth, async (req, res) => {
  try {
    const content = await portfolioContent.saveContent(req.body?.content || req.body || {}, {
      id: req.portfolioUser?.id || req.user?._id?.toString?.() || req.user?.id,
      email: req.portfolioUser?.email || req.user?.email,
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

router.post('/media', portfolioAdminAuth, upload.single('file'), async (req, res) => {
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
      url: result.secure_url || result.url,
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
