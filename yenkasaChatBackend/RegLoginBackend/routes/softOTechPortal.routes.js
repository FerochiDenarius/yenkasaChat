const express = require('express');
const multer = require('multer');
const portal = require('../services/softOTechPortal.service');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
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
    cb(allowed.includes(file.mimetype) ? null : new Error('Unsupported file type.'), allowed.includes(file.mimetype));
  },
});

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function portalAuth(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Missing portal token.' });
    const decoded = portal.verifyPortalToken(token);
    const client = await portal.getClientById(decoded.portalUserId);
    if (!client) return res.status(401).json({ success: false, message: 'Portal account not found.' });
    req.portalUser = client;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired portal token.' });
  }
}

function adminOnly(req, res, next) {
  if (!req.portalUser?.is_admin && req.portalUser?.role !== 'senior_developer') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  return next();
}

function sendError(res, error) {
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Request failed.',
  });
}

router.post('/auth/register', async (req, res) => {
  try {
    const result = await portal.registerClient(req.body || {});
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const result = await portal.loginClient(req.body || {});
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/me', portalAuth, async (req, res) => {
  res.json({ success: true, client: req.portalUser });
});

router.patch('/me', portalAuth, async (req, res) => {
  try {
    const client = await portal.updateClientProfile(req.portalUser.id, req.body || {});
    res.json({ success: true, client });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/client/dashboard', portalAuth, async (req, res) => {
  try {
    const dashboard = await portal.clientDashboard(req.portalUser);
    res.json({ success: true, dashboard });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/client/messages', portalAuth, async (req, res) => {
  try {
    const message = await portal.createMessage({
      ...req.body,
      clientEmail: req.portalUser.email,
      senderEmail: req.portalUser.email,
      senderRole: 'client',
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/client/documents', portalAuth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Document file is required.' });
    const document = await portal.uploadDocument(req.file, {
      ...req.body,
      clientEmail: req.portalUser.email,
      uploadedBy: 'client',
    });
    res.status(201).json({ success: true, document });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/client/quotations/:quotationId/respond', portalAuth, async (req, res) => {
  try {
    const quotation = await portal.respondToQuotation(req.params.quotationId, req.portalUser.email, req.body.status);
    res.json({ success: true, quotation });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/dashboard', portalAuth, adminOnly, async (req, res) => {
  try {
    const dashboard = await portal.adminDashboard();
    res.json({ success: true, dashboard });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/projects', portalAuth, adminOnly, async (req, res) => {
  try {
    const project = await portal.createProject(req.body || {});
    res.status(201).json({ success: true, project });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/quotations', portalAuth, adminOnly, async (req, res) => {
  try {
    const quotation = await portal.createQuotation(req.body || {});
    res.status(201).json({ success: true, quotation });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/invoices', portalAuth, adminOnly, async (req, res) => {
  try {
    const invoice = await portal.createInvoice(req.body || {});
    res.status(201).json({ success: true, invoice });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/messages', portalAuth, adminOnly, async (req, res) => {
  try {
    const message = await portal.createMessage({
      ...req.body,
      senderEmail: req.portalUser.email,
      senderRole: 'admin',
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/documents', portalAuth, adminOnly, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Document file is required.' });
    const document = await portal.uploadDocument(req.file, {
      ...req.body,
      uploadedBy: 'admin',
    });
    res.status(201).json({ success: true, document });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
