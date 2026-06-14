const express = require('express');
const multer = require('multer');
const portal = require('../services/softOTechPortal.service');
const pricing = require('../services/softOTechPricing.service');
const projectRequestStore = require('../services/projectRequestStore.service');
const ProjectRequest = require('../models/projectRequest.model');
const { portalAdminOnly, portalAuth } = require('../middleware/softOTechPortalAuth.middleware');

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
      'text/csv',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ];
    cb(allowed.includes(file.mimetype) ? null : new Error('Unsupported file type.'), allowed.includes(file.mimetype));
  },
});

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

router.post('/auth/admin/login', async (req, res) => {
  try {
    const result = await portal.loginClient(req.body || {});
    if (!result.client?.is_admin && result.client?.role !== 'senior_developer') {
      return res.status(403).json({ success: false, message: 'Admin access is not enabled for this account.' });
    }
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

router.get('/developer/dashboard', portalAuth, async (req, res) => {
  try {
    const dashboard = await portal.developerDashboard(req.portalUser);
    res.json({ success: true, dashboard });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/assistant', portalAuth, async (req, res) => {
  try {
    const result = await portal.projectAiAssistant({
      ...req.body,
      clientEmail: req.portalUser.is_admin ? req.body?.clientEmail : req.portalUser.email,
    }, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, result });
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

router.get('/admin/dashboard', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const dashboard = await portal.adminDashboard();
    res.json({ success: true, dashboard });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/team-members', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const result = await portal.listTeamMembers();
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/projects/:projectId/assignments', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const assignments = await portal.getProjectAssignments(req.params.projectId);
    res.json({ success: true, assignments });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/projects/:projectId/assignments', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const result = await portal.saveProjectAssignments(req.params.projectId, req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/clients', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const result = await portal.listClients({
      search: req.query.search,
      status: req.query.status,
      limit: Math.min(Number(req.query.limit || 100), 500),
      page: Math.max(Number(req.query.page || 1), 1),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/clients', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const client = await portal.createClient(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, client });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/admin/clients/:clientId/status', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const client = await portal.updateClientStatus(req.params.clientId, req.body.status, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, client });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/leads', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const result = await portal.listLeads({
      search: req.query.search,
      status: req.query.status,
      limit: Math.min(Number(req.query.limit || 100), 500),
      page: Math.max(Number(req.query.page || 1), 1),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/leads', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const lead = await portal.createLead(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, lead });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/admin/leads/:leadId', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const lead = await portal.updateLead(req.params.leadId, req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, lead });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/leads/:leadId/convert', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const result = await portal.convertLeadToClient(req.params.leadId, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/projects', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const project = await portal.createProject({
      ...(req.body || {}),
      actorEmail: req.portalUser.email,
    });
    res.status(201).json({ success: true, project });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/admin/projects/:projectId', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const project = await portal.updateProject(req.params.projectId, req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, project });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/pricing', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const [categories, items] = await Promise.all([
      pricing.listCategories({ includeInactive: true }),
      pricing.listPricingItems({ includeInactive: true, categoryId: req.query.categoryId, search: req.query.search }),
    ]);
    res.json({ success: true, categories, items });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/pricing/categories', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const categories = await pricing.saveCategories([req.body || {}], {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, categories });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/admin/pricing', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const items = await pricing.savePricingItems(req.body?.items || [], {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, items });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/pricing/items', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const item = await pricing.createPricingItem(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/pricing/items/:itemId/duplicate', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const item = await pricing.duplicatePricingItem(req.params.itemId, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/admin/pricing/items/:itemId', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const item = await pricing.archivePricingItem(req.params.itemId, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, item });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/pricing/import-csv', portalAuth, portalAdminOnly, upload.single('csv'), async (req, res) => {
  try {
    const csv = req.file ? req.file.buffer.toString('utf8') : String(req.body.csv || '');
    const items = await pricing.importPricingCsv(csv, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, items });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/pricing/export-csv', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const csv = await pricing.exportPricingCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="softotech-pricing.csv"');
    res.send(csv);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/pricing/estimate', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const estimate = Array.isArray(req.body?.serviceSelections)
      ? await pricing.calculateFromServiceSelections(req.body.serviceSelections, req.body || {})
      : await pricing.estimate(req.body || {});
    res.json({ success: true, estimate });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/pricing/reports', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const dashboard = await portal.adminDashboard();
    res.json({ success: true, report: dashboard.pricingReport });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/project-requests', portalAuth, portalAdminOnly, async (req, res) => {
  try {
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
      statuses: ProjectRequest.PROJECT_REQUEST_STATUSES,
      storageProvider: projectRequestStore.storageProvider(),
      collection: projectRequestStore.collectionName(),
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/project-request-clients', portalAuth, portalAdminOnly, async (req, res) => {
  try {
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
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/project-request-analytics', portalAuth, portalAdminOnly, async (req, res) => {
  try {
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
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/admin/project-requests/:requestId/status', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    if (!ProjectRequest.PROJECT_REQUEST_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const request = await projectRequestStore.updateStatus(req.params.requestId, status, req.portalUser.email);
    if (!request) return res.status(404).json({ success: false, message: 'Project request not found.' });
    portal.publishPortalIntelligenceEvent('project_request_status_updated', {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    }, {
      requestId: req.params.requestId,
      status,
      request,
    });

    return res.json({ success: true, item: request });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/admin/projects/approve-request', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const project = await portal.approveProjectRequest(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, project });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/admin/projects/:projectId/milestones', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const project = await portal.updateProjectMilestones(req.params.projectId, req.body?.milestones || [], {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, project });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/requirements', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const result = await portal.listRequirements({
      projectId: req.query.projectId,
      search: req.query.search,
      limit: Math.min(Number(req.query.limit || 100), 500),
      page: Math.max(Number(req.query.page || 1), 1),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/requirements', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const requirement = await portal.createRequirement(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, requirement });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/admin/requirements/:requirementId', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const requirement = await portal.updateRequirement(req.params.requirementId, req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.json({ success: true, requirement });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/requirements/:requirementId/comments', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const requirement = await portal.addRequirementComment(req.params.requirementId, req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, requirement });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/requirements/:requirementId/change-requests', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const requirement = await portal.createRequirementChangeRequest(req.params.requirementId, req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, requirement });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/requirements/:requirementId/attachments', portalAuth, portalAdminOnly, upload.single('attachment'), async (req, res) => {
  try {
    const requirement = await portal.uploadRequirementAttachment(req.params.requirementId, req.file, req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, requirement });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/proposals/generate', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const proposal = await portal.generateProposal(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, proposal });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/quotations', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const quotation = await portal.createQuotation({
      ...(req.body || {}),
      actorEmail: req.portalUser.email,
    });
    res.status(201).json({ success: true, quotation });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/invoices', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const invoice = await portal.createInvoice({
      ...(req.body || {}),
      actorEmail: req.portalUser.email,
    });
    res.status(201).json({ success: true, invoice });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/payments', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const payment = await portal.recordPayment(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, payment });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/admin/messages', portalAuth, portalAdminOnly, async (req, res) => {
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

router.post('/admin/documents', portalAuth, portalAdminOnly, upload.single('document'), async (req, res) => {
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

router.post('/admin/portfolio-projects', portalAuth, portalAdminOnly, async (req, res) => {
  try {
    const project = await portal.upsertPortfolioProject(req.body || {}, {
      email: req.portalUser.email,
      role: req.portalUser.role || req.portalUser.userType,
    });
    res.status(201).json({ success: true, project });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
