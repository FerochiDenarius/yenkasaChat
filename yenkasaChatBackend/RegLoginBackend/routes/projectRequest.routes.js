const express = require('express');
const multer = require('multer');
const ProjectRequest = require('../models/projectRequest.model');
const mediaStorage = require('../services/mediaStorage.service');
const projectRequestStore = require('../services/projectRequestStore.service');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { sendProjectRequestEmails } = require('../services/projectRequestEmail.service');

const router = express.Router();

const PROJECT_CATEGORIES = new Set(ProjectRequest.PROJECT_REQUEST_TYPES);
const PROJECT_TYPES = new Set([
  'Website Development',
  'Mobile App Development',
  'AI Solution Development',
  'Business Software',
  'UI/UX Design',
  'Cloud Infrastructure',
  'Custom Project',
  'Business Website',
  'E-commerce Store',
  'School Website',
  'Church Website',
  'Portfolio Website',
  'Blog/News Website',
  'Custom Web Application',
  'Mobile App',
  'Android App',
  'iOS App',
  'Cross-platform Mobile App',
  'Web + Mobile Platform',
  'AI Chatbot/Automation',
  'Business Software',
  'UI/UX Design Project',
]);

const PAGES = new Set([
  'Home',
  'About Us',
  'Services',
  'Products',
  'Gallery',
  'Blog',
  'Contact Us',
  'FAQ',
  'Login/Register',
  'User Profile',
  'Dashboard',
  'Notifications',
  'Payments',
  'Admin',
  'Other',
]);
const FEATURES = new Set([
  'Contact Form',
  'Online Payments',
  'User Registration/Login',
  'Booking System',
  'Live Chat',
  'E-commerce Store',
  'Admin Dashboard',
  'File Uploads',
  'Newsletter',
  'Push Notifications',
  'In-app Chat',
  'API Integration',
  'AI Assistant',
  'Reports/Analytics',
  'Custom Feature',
]);
const PLATFORMS = new Set([
  'Website',
  'Android App',
  'iOS App',
  'Web Dashboard',
  'Admin Portal',
  'Backend API',
  'Desktop App',
  'Not Sure',
]);
const STATUSES = ProjectRequest.PROJECT_REQUEST_STATUSES;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 8,
  },
  fileFilter(req, file, cb) {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type.'));
    }
    return cb(null, true);
  },
});

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeList(values, allowed) {
  return asArray(values).filter((value) => allowed.has(value));
}

function requiredString(body, key, label) {
  const value = String(body[key] || '').trim();
  if (!value) {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function emailIsValid(value) {
  return /.+@.+\..+/.test(String(value || '').trim());
}

async function nextRequestId() {
  const softOTechId = await projectRequestStore.nextTrackingId();
  if (softOTechId) return softOTechId;
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const requestId = `YSW-${stamp}-${suffix}`;
    const exists = await projectRequestStore.exists(requestId);
    if (!exists) return requestId;
  }
  return `YSW-${stamp}-${Date.now().toString(36).toUpperCase()}`;
}

async function uploadRequestFiles(filesByField, requestId) {
  const files = [
    ...(filesByField.companyLogo || []),
    ...(filesByField.additionalFiles || []),
  ];

  const uploaded = [];
  for (const file of files) {
    const result = await mediaStorage.upload(file, {
      folder: 'project-requests',
      prefix: `${requestId}-${file.fieldname}`,
      type: 'file',
      area: 'project-request',
    });
    uploaded.push({
      field: file.fieldname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      provider: result.provider || '',
      bucket: result.bucket || '',
      key: result.key || result.public_id || '',
      url: result.secure_url || result.url,
    });
  }
  return uploaded;
}

function buildProjectRequestPayload(body, requestId, files, req) {
  const email = requiredString(body, 'emailAddress', 'Email address').toLowerCase();
  if (!emailIsValid(email)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }

  const requestCategory = String(body.requestCategory || 'Website').trim();
  if (!PROJECT_CATEGORIES.has(requestCategory)) {
    const error = new Error('Invalid project category.');
    error.statusCode = 400;
    throw error;
  }

  const projectType = String(body.projectType || body.websiteType || '').trim();
  if (!projectType) {
    const error = new Error('Project type is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!PROJECT_TYPES.has(projectType)) {
    const error = new Error('Invalid project type.');
    error.statusCode = 400;
    throw error;
  }

  return {
    requestId,
    requestCategory,
    status: 'New',
    contact: {
      fullName: requiredString(body, 'fullName', 'Full name'),
      companyName: String(body.companyName || '').trim(),
      phoneNumber: requiredString(body, 'phoneNumber', 'Phone number'),
      whatsappNumber: String(body.whatsappNumber || '').trim(),
      email,
      businessLocation: String(body.businessLocation || '').trim(),
      preferredContactMethod: String(body.preferredContactMethod || '').trim(),
      bestTimeToContact: String(body.bestTimeToContact || '').trim(),
    },
    business: {
      description: requiredString(body, 'businessDescription', 'Business description'),
      industryType: String(body.industryType || '').trim(),
      targetAudience: String(body.targetAudience || '').trim(),
    },
    requirements: {
      websiteType: projectType,
      projectType,
      pagesRequired: sanitizeList(body.pagesRequired, PAGES),
      featuresRequired: sanitizeList(body.featuresRequired, FEATURES),
      platformsRequired: sanitizeList(body.platformsRequired, PLATFORMS),
    },
    branding: {
      preferredColors: String(body.preferredColors || '').trim(),
      referenceWebsites: String(body.referenceWebsites || '').trim(),
    },
    project: {
      budgetRange: String(body.budgetRange || '').trim(),
      desiredCompletionDate: body.desiredCompletionDate ? new Date(body.desiredCompletionDate) : null,
      additionalNotes: String(body.additionalNotes || '').trim(),
    },
    files,
    statusHistory: [{ status: 'New' }],
    source: {
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
      referrer: req.get('referer') || '',
    },
    submittedAt: new Date(),
  };
}

router.post(
  '/',
  upload.fields([
    { name: 'companyLogo', maxCount: 1 },
    { name: 'additionalFiles', maxCount: 7 },
  ]),
  async (req, res) => {
    try {
      const requestId = await nextRequestId();
      const files = await uploadRequestFiles(req.files || {}, requestId);
      const payload = buildProjectRequestPayload(req.body || {}, requestId, files, req);
      const request = await projectRequestStore.create(payload);
      const emailResult = await sendProjectRequestEmails(request, {
        onUpdate: (emailNotifications) => projectRequestStore.updateEmailNotifications(request.requestId, emailNotifications),
      });

      return res.status(201).json({
        success: true,
        requestId: request.requestId,
        status: request.status,
        email: emailResult,
      });
    } catch (error) {
      console.error('[ProjectRequest] submission failed:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to submit project request.',
      });
    }
  },
);

router.get('/admin', auth, requirePermission('analyticsAccess'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const page = Math.max(Number(req.query.page || 1), 1);
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  const result = await projectRequestStore.list({ search, status, from, to, limit, page });

  res.json({
    success: true,
    items: result.items,
    total: result.total,
    page,
    limit,
    statuses: STATUSES,
    storageProvider: projectRequestStore.storageProvider(),
    collection: projectRequestStore.collectionName(),
  });
});

router.get('/admin/analytics', auth, requirePermission('analyticsAccess'), async (req, res) => {
  const analytics = await projectRequestStore.analytics();
  res.json({
    success: true,
    total: analytics.total,
    conversionRate: analytics.total ? Number(((analytics.converted / analytics.total) * 100).toFixed(2)) : 0,
    byType: analytics.byType,
    byCategory: analytics.byCategory,
    byStatus: analytics.byStatus,
    monthly: analytics.monthly,
    storageProvider: projectRequestStore.storageProvider(),
    collection: projectRequestStore.collectionName(),
  });
});

router.get('/admin/clients', auth, requirePermission('analyticsAccess'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const page = Math.max(Number(req.query.page || 1), 1);
  const search = String(req.query.search || '').trim();
  const result = await projectRequestStore.listClients({ search, limit, page });

  res.json({
    success: true,
    items: result.items,
    total: result.total,
    page,
    limit,
    storageProvider: projectRequestStore.storageProvider(),
    collection: projectRequestStore.clientCollectionName(),
  });
});

router.patch('/admin/:requestId/status', auth, requirePermission('analyticsAccess'), async (req, res) => {
  const status = String(req.body.status || '').trim();
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  const request = await projectRequestStore.updateStatus(req.params.requestId, status, req.user?._id || req.user?.id || null);
  if (!request) return res.status(404).json({ success: false, message: 'Project request not found.' });

  res.json({ success: true, item: request });
});

module.exports = router;
