const express = require('express');
const multer = require('multer');
const ProjectRequest = require('../models/projectRequest.model');
const mediaStorage = require('../services/mediaStorage.service');
const projectRequestStore = require('../services/projectRequestStore.service');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { sendProjectRequestEmails } = require('../services/projectRequestEmail.service');
const pricingService = require('../services/softOTechPricing.service');
const invoiceService = require('../services/projectInvoice.service');
const portal = require('../services/softOTechPortal.service');

const router = express.Router();

const PROJECT_CATEGORIES = new Set(ProjectRequest.PROJECT_REQUEST_TYPES);
const PROJECT_TYPES = new Set([
  'Website Development',
  'Mobile App Development',
  'Desktop Application',
  'AI Solution Development',
  'E-Commerce Platform',
  'School Management System',
  'Hospital Management System',
  'Inventory System',
  'ERP System',
  'Social Media Platform',
  'Livestream Platform',
  'Fintech Solution',
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
  'Login', 'Registration', 'Password Recovery', 'Social Login',
  'Chat', 'Group Chat', 'Voice Calls', 'Video Calls',
  'Posts', 'Comments', 'Likes', 'Shares', 'Notifications',
  'Payments', 'Wallet', 'Subscription Plans', 'Invoicing',
  'Product Listings', 'Shopping Cart', 'Order Tracking',
  'Image Upload', 'Video Upload', 'Livestreaming',
  'AI Chatbot', 'OCR', 'Recommendation System', 'AI Agent',
  'Dashboard', 'Analytics', 'User Management', 'Role Management',
  'Custom Feature',
]);
const PLATFORMS = new Set([
  'Website',
  'Android',
  'iPhone (iOS)',
  'Windows',
  'macOS',
  'Linux',
  'Web Dashboard',
  'Admin Portal',
  'Backend API',
  'Not Sure',
]);
const INTEGRATIONS = new Set(['Paystack', 'Stripe', 'Flutterwave', 'MTN MoMo', 'Google Maps', 'Google Analytics', 'Firebase', 'OneSignal', 'Agora', 'Zoom', 'Microsoft 365', 'Google Workspace', 'WhatsApp API', 'SMS Gateway']);
const HOSTING_OPTIONS = new Set(['Shared Hosting', 'VPS', 'Dedicated Server', 'Google Cloud', 'AWS', 'DigitalOcean']);
const SUPPORT_OPTIONS = new Set(['Security Monitoring', 'Server Monitoring', 'Content Updates', 'Technical Support']);
const BUDGET_CURRENCIES = new Set(['GHS', 'USD']);
const STATUSES = ProjectRequest.PROJECT_REQUEST_STATUSES;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 120 * 1024 * 1024,
    files: 28,
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
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/octet-stream',
      'video/mp4',
      'video/quicktime',
      'video/webm',
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

function normalizeBudgetCurrency(body = {}) {
  const requested = String(body.budgetCurrency || body.currency || '').trim().toUpperCase();
  if (BUDGET_CURRENCIES.has(requested)) return requested;
  const country = String(body.country || '').trim();
  if (/\b(ghana|gh)\b/i.test(country)) return 'GHS';
  return 'GHS';
}

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function clientPortalRequired(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Client login is required before submitting project details.' });
    const decoded = portal.verifyPortalToken(token);
    const client = await portal.getClientById(decoded.portalUserId);
    if (!client) return res.status(401).json({ success: false, message: 'Client portal account not found.' });
    if (client.is_admin) return res.status(403).json({ success: false, message: 'Please submit project requests from a client account.' });
    req.portalClient = client;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired client login. Please login again.' });
  }
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
    ...(filesByField.designFiles || []),
    ...(filesByField.requirementFiles || []),
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

function buildAdminReview({ projectType = '', features = [], platforms = [], integrations = [], maxBudget = 0, priority = '', currency = 'GHS' } = {}) {
  let score = 10;
  score += Math.min(features.length * 3, 45);
  score += Math.min(platforms.length * 5, 30);
  score += Math.min(integrations.length * 4, 30);
  if (/ai|erp|fintech|livestream|social|hospital|school/i.test(projectType)) score += 20;
  if (/urgent/i.test(priority)) score += 10;
  score = Math.min(score, 100);

  const complexity = score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low';
  const weeks = score >= 75 ? '10-20 weeks' : score >= 45 ? '6-12 weeks' : '2-6 weeks';
  const teamSize = score >= 75 ? '4-6 specialists' : score >= 45 ? '2-4 specialists' : '1-2 specialists';
  const stack = ['Node.js', 'PostgreSQL/Firestore', 'Google Cloud Storage'];
  if (platforms.includes('Website')) stack.push('React/Next.js');
  if (platforms.includes('Android') || platforms.includes('iPhone (iOS)')) stack.push('Flutter');
  if (features.some((item) => /AI|OCR|Recommendation|Agent/i.test(item)) || /AI/i.test(projectType)) stack.push('Gemini/RAG');
  if (features.some((item) => /Chat|Calls|Livestream/i.test(item))) stack.push('Socket.IO/Agora');
  if (features.some((item) => /Payments|Wallet|Subscription|Invoicing/i.test(item))) stack.push('Paystack/Payments');

  const lowCost = maxBudget ? Math.max(0, Math.round(maxBudget * 0.75)) : score * 120;
  const highCost = maxBudget || Math.max(lowCost + 1000, score * 220);
  return {
    complexityScore: score,
    complexity,
    estimatedDevelopmentDuration: weeks,
    recommendedTeamSize: teamSize,
    suggestedTechnologyStack: Array.from(new Set(stack)),
    suggestedServiceItems: Array.from(new Set([
      projectType,
      ...features.filter(Boolean).slice(0, 10),
      ...integrations.filter(Boolean).slice(0, 6),
    ])).filter(Boolean),
    estimatedCostRange: {
      currency,
      minimum: lowCost,
      maximum: highCost,
    },
  };
}

function buildProjectRequestPayload(body, requestId, files, req) {
  const email = requiredString(body, 'emailAddress', 'Email address').toLowerCase();
  if (!emailIsValid(email)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }
  const portalEmail = String(req.portalClient?.email || '').trim().toLowerCase();
  if (portalEmail && portalEmail !== email) {
    const error = new Error('Project request email must match the logged-in client account.');
    error.statusCode = 403;
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
  const budgetCurrency = normalizeBudgetCurrency(body);

  return {
    requestId,
    requestCategory,
    status: 'Submitted',
    contact: {
      fullName: requiredString(body, 'fullName', 'Full name'),
      companyName: String(body.companyName || req.portalClient?.companyName || '').trim(),
      businessRegistrationNumber: String(body.businessRegistrationNumber || '').trim(),
      phoneNumber: requiredString(body, 'phoneNumber', 'Phone number'),
      whatsappNumber: String(body.whatsappNumber || '').trim(),
      email,
      country: String(body.country || req.portalClient?.country || '').trim(),
      city: String(body.city || '').trim(),
      businessAddress: String(body.businessAddress || '').trim(),
      website: String(body.website || '').trim(),
      businessLocation: String(body.businessAddress || body.city || body.country || '').trim(),
      preferredContactMethod: String(body.preferredContactMethod || '').trim(),
      bestTimeToContact: String(body.bestTimeToContact || '').trim(),
    },
    business: {
      description: requiredString(body, 'projectDescription', 'Project description'),
      industryType: String(body.industryType || '').trim(),
      targetAudience: String(body.targetAudience || '').trim(),
    },
    overview: {
      projectName: requiredString(body, 'projectName', 'Project name'),
      projectCategory: requestCategory,
      projectDescription: requiredString(body, 'projectDescription', 'Project description'),
    },
    objectives: {
      problemToSolve: requiredString(body, 'problemToSolve', 'Problem to solve'),
      businessGoals: String(body.businessGoals || '').trim(),
      targetUsers: String(body.targetUsers || body.targetAudience || '').trim(),
      expectedUsers: Number(body.expectedUsers || 0),
      expectedMonthlyTraffic: Number(body.expectedMonthlyTraffic || 0),
    },
    requirements: {
      websiteType: projectType,
      projectType,
      pagesRequired: sanitizeList(body.pagesRequired, PAGES),
      featuresRequired: sanitizeList(body.featuresRequired, FEATURES),
      platformsRequired: sanitizeList(body.platformsRequired, PLATFORMS),
      customFeatures: String(body.customFeatures || '').trim(),
    },
    branding: {
      hasLogo: String(body.hasLogo || '').trim(),
      hasBrandColors: String(body.hasBrandColors || '').trim(),
      hasUiDesigns: String(body.hasUiDesigns || '').trim(),
      needsUiUx: String(body.needsUiUx || '').trim(),
      preferredColors: String(body.preferredColors || '').trim(),
      referenceWebsites: String(body.referenceWebsites || '').trim(),
    },
    integrations: sanitizeList(body.integrationsRequired, INTEGRATIONS),
    infrastructure: {
      ownsDomain: String(body.ownsDomain || '').trim(),
      needsDomainRegistration: String(body.needsDomainRegistration || '').trim(),
      needsHosting: String(body.needsHosting || '').trim(),
      needsEmailSetup: String(body.needsEmailSetup || '').trim(),
      needsCloudDeployment: String(body.needsCloudDeployment || '').trim(),
      hostingOptions: sanitizeList(body.hostingOptions, HOSTING_OPTIONS),
    },
    timeline: {
      desiredStartDate: body.desiredStartDate ? new Date(body.desiredStartDate) : null,
      desiredCompletionDate: body.desiredCompletionDate ? new Date(body.desiredCompletionDate) : null,
      timelineFlexible: String(body.timelineFlexible || '').trim(),
      priority: String(body.priority || '').trim(),
    },
    project: {
      budgetCurrency,
      budgetRange: String(body.budgetRange || '').trim(),
      minimumBudget: Number(body.minimumBudget || 0),
      maximumBudget: Number(body.maximumBudget || 0),
      desiredCompletionDate: body.desiredCompletionDate ? new Date(body.desiredCompletionDate) : null,
      additionalNotes: String(body.additionalNotes || '').trim(),
    },
    maintenance: {
      plan: String(body.maintenancePlan || '').trim(),
      supportServices: sanitizeList(body.supportServices, SUPPORT_OPTIONS),
    },
    review: buildAdminReview({
      projectType,
      features: sanitizeList(body.featuresRequired, FEATURES),
      platforms: sanitizeList(body.platformsRequired, PLATFORMS),
      integrations: sanitizeList(body.integrationsRequired, INTEGRATIONS),
      maxBudget: Number(body.maximumBudget || 0),
      priority: String(body.priority || '').trim(),
      currency: budgetCurrency,
    }),
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

function estimateInputFromBody(body = {}) {
  return {
    requestCategory: String(body.requestCategory || '').trim(),
    projectType: String(body.projectType || body.websiteType || '').trim(),
    websiteType: String(body.websiteType || body.projectType || '').trim(),
    pagesRequired: sanitizeList(body.pagesRequired, PAGES),
    featuresRequired: sanitizeList(body.featuresRequired, FEATURES),
    platformsRequired: sanitizeList(body.platformsRequired, PLATFORMS),
    currency: normalizeBudgetCurrency(body),
  };
}

router.post('/estimate', async (req, res) => {
  try {
    const estimate = await pricingService.estimate(estimateInputFromBody(req.body || {}));
    res.json({ success: true, estimate });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to calculate estimate.' });
  }
});

router.post(
  '/',
  clientPortalRequired,
  upload.fields([
    { name: 'companyLogo', maxCount: 1 },
    { name: 'designFiles', maxCount: 6 },
    { name: 'requirementFiles', maxCount: 8 },
    { name: 'additionalFiles', maxCount: 12 },
  ]),
  async (req, res) => {
    try {
      const requestId = await nextRequestId();
      const files = await uploadRequestFiles(req.files || {}, requestId);
      const payload = buildProjectRequestPayload(req.body || {}, requestId, files, req);
      const request = await projectRequestStore.create(payload);
      const pricingEstimate = await pricingService.estimate({
        ...estimateInputFromBody(req.body || {}),
        currency: normalizeBudgetCurrency(req.body || {}),
      });
      const invoice = await invoiceService.generateAndUploadInvoice(request, pricingEstimate);
      await projectRequestStore.updatePricingAndInvoice(request.requestId, pricingEstimate, invoice);
      portal.publishPortalIntelligenceEvent('project_request_submitted', {
        email: req.portalClient?.email || request.contact?.email,
        role: 'client',
      }, {
        requestId: request.requestId,
        clientEmail: request.contact?.email,
        request,
        pricingEstimate,
        invoice,
      });
      const emailResult = await sendProjectRequestEmails(request, {
        onUpdate: (emailNotifications) => projectRequestStore.updateEmailNotifications(request.requestId, emailNotifications),
      });

      return res.status(201).json({
        success: true,
        requestId: request.requestId,
        status: request.status,
        pricingEstimate,
        invoice,
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
  portal.publishPortalIntelligenceEvent('project_request_status_updated', {
    email: req.user?.email || req.user?._id || req.user?.id,
    role: req.user?.role || 'admin',
  }, {
    requestId: req.params.requestId,
    status,
    request,
  });

  res.json({ success: true, item: request });
});

module.exports = router;
