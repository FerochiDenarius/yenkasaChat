const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');

const auth = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const { logUploadAudit } = require('../utils/cloudinaryMedia');

const router = express.Router();

const ALLOWED_PRODUCTS = new Set(['yenkasa-app', 'yenkasa-store', 'yenkasa-ai', 'yenkasa-web', 'future-products']);
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
    folder: `${process.env.CLOUDINARY_PORTFOLIO_FOLDER || 'yenkasa/portfolio'}/${product}/${type}`,
    resourceType: type === 'videos' ? 'video' : 'image',
  };
}

function uploadPortfolioMedia(file, target) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: target.folder,
        resource_type: target.resourceType,
        use_filename: true,
        unique_filename: true,
        quality: 'auto:good',
        fetch_format: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
}

router.post('/media', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No portfolio media file uploaded.' });
  }

  try {
    const target = resolveUploadTarget(req, req.file);
    const result = await uploadPortfolioMedia(req.file, target);
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
    console.error('[PortfolioMedia] Cloudinary upload failed:', err.message);
    res.status(statusCode).json({ error: statusCode === 500 ? 'Failed to upload portfolio media.' : err.message });
  }
});

module.exports = router;
