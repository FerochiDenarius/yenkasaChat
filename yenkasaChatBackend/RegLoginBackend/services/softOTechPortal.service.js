const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const mediaStorage = require('./mediaStorage.service');
const pricing = require('./softOTechPricing.service');
const projectRequestStore = require('./projectRequestStore.service');
const { isPrivilegedAdminEmail } = require('./adminBootstrap.service');

const DEFAULT_PROJECT_ID = 'project-10405180-0afd-4ecc-9f8';
const CLIENTS = process.env.PROJECT_REQUEST_CLIENT_COLLECTION || 'project_request_clients';
const QUOTATIONS = process.env.SOFTOTECH_QUOTATION_COLLECTION || 'softotech_quotations';
const INVOICES = process.env.SOFTOTECH_INVOICE_COLLECTION || 'softotech_invoices';
const PROJECTS = process.env.SOFTOTECH_PROJECT_COLLECTION || 'softotech_projects';
const LEADS = process.env.SOFTOTECH_LEAD_COLLECTION || 'softotech_leads';
const REQUIREMENTS = process.env.SOFTOTECH_REQUIREMENT_COLLECTION || 'softotech_requirements';
const MESSAGES = process.env.SOFTOTECH_MESSAGE_COLLECTION || 'softotech_messages';
const DOCUMENTS = process.env.SOFTOTECH_DOCUMENT_COLLECTION || 'softotech_documents';
const COUNTERS = process.env.SOFTOTECH_COUNTER_COLLECTION || 'softotech_counters';
const PROPOSALS = process.env.SOFTOTECH_PROPOSAL_COLLECTION || 'softotech_proposals';
const PAYMENTS = process.env.SOFTOTECH_PAYMENT_COLLECTION || 'softotech_payments';
const AUDIT_LOGS = process.env.SOFTOTECH_AUDIT_COLLECTION || 'softotech_audit_logs';
const PORTFOLIO_PROJECTS = process.env.SOFTOTECH_PORTFOLIO_COLLECTION || 'softotech_portfolio_projects';
const TEAM_ROLES = Object.freeze([
  'Client',
  'Admin',
  'Senior Developer',
  'Junior Developer',
  'Designer',
  'QA Engineer',
  'DevOps Engineer',
  'Project Manager',
]);

const CLIENT_STATUSES = Object.freeze(['Active', 'Suspended', 'Closed']);
const LEAD_STATUSES = Object.freeze(['New', 'Contacted', 'Negotiation', 'Quotation Sent', 'Won', 'Lost']);
const QUOTATION_STATUSES = Object.freeze(['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired']);
const PAYMENT_METHODS = Object.freeze(['Paystack', 'MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Bank Transfer']);
const PAYMENT_STATUSES = Object.freeze(['Pending', 'Successful', 'Failed', 'Refunded']);
const INVOICE_STATUSES = Object.freeze(['Paid', 'Unpaid', 'Overdue', 'Partially Paid']);
const PROJECT_STATUSES = Object.freeze(['Planning', 'In Progress', 'Client Review', 'Testing', 'Deployment', 'Completed', 'Suspended']);
const REQUIREMENT_CATEGORIES = Object.freeze(['Functional', 'UI/UX', 'API', 'Hosting', 'Security']);
const REQUIREMENT_PRIORITIES = Object.freeze(['Low', 'Medium', 'High', 'Critical']);

function projectId() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || DEFAULT_PROJECT_ID;
}

function credential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  return admin.credential.applicationDefault();
}

function db() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: credential(), projectId: projectId() });
  }
  return admin.firestore();
}

function jwtSecret() {
  return process.env.SOFTOTECH_PORTAL_JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function clientIdFromEmail(email) {
  return Buffer.from(normalizeEmail(email)).toString('base64url');
}

function now() {
  return new Date();
}

function normalizeValue(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      if (key !== 'passwordHash' && key !== 'emailVerificationToken' && key !== 'passwordResetToken') {
        acc[key] = normalizeValue(entry);
      }
      return acc;
    }, {});
  }
  return value;
}

function docToObject(doc) {
  if (!doc.exists) return null;
  return normalizeValue({ id: doc.id, ...doc.data() });
}

function roleForEmail(email) {
  if (isPrivilegedAdminEmail(email)) {
    return { is_admin: true, role: 'senior_developer', userType: 'Senior Developer', teamRole: 'Senior Developer' };
  }
  return { is_admin: false, role: 'client', userType: 'Client', teamRole: 'Client' };
}

function cleanText(value) {
  return String(value || '').trim();
}

function validOrDefault(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

async function listCollection(collectionName, { limit = 1000, orderBy = 'createdAt', direction = 'desc' } = {}) {
  let query = db().collection(collectionName);
  if (orderBy) query = query.orderBy(orderBy, direction);
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map(docToObject);
}

function matchesSearch(item, search = '', fields = []) {
  const needle = cleanText(search).toLowerCase();
  if (!needle) return true;
  const text = fields.map((field) => {
    const value = field.split('.').reduce((acc, key) => acc?.[key], item);
    return value || '';
  }).join(' ').toLowerCase();
  return text.includes(needle);
}

function signPortalToken(client) {
  const secret = jwtSecret();
  if (!secret) {
    const error = new Error('SOFTOTECH_PORTAL_JWT_SECRET or ACCESS_TOKEN_SECRET is required.');
    error.statusCode = 500;
    throw error;
  }
  return jwt.sign({
    portalUserId: client.id || client.clientId,
    email: client.email,
    role: client.role,
    is_admin: Boolean(client.is_admin),
    type: 'softotech_portal',
  }, secret, { expiresIn: process.env.SOFTOTECH_PORTAL_TOKEN_TTL || '14d' });
}

async function nextNumber(key) {
  const ref = db().collection(COUNTERS).doc(key);
  return db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? Number(snapshot.data().value || 0) : 0;
    const value = current + 1;
    transaction.set(ref, { value, updatedAt: now() }, { merge: true });
    return value;
  });
}

async function nextBusinessId(prefix) {
  const year = new Date().getFullYear();
  const value = await nextNumber(`${prefix.toLowerCase()}_${year}`);
  return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
}

async function getClientByEmail(email) {
  if (!email) return null;
  const doc = await db().collection(CLIENTS).doc(clientIdFromEmail(email)).get();
  return docToObject(doc);
}

async function getClientById(clientId) {
  if (!clientId) return null;
  const doc = await db().collection(CLIENTS).doc(clientId).get();
  return docToObject(doc);
}

async function registerClient(payload = {}) {
  const email = normalizeEmail(payload.email);
  if (!email || !/.+@.+\..+/.test(email)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!payload.password || String(payload.password).length < 8) {
    const error = new Error('Password must be at least 8 characters.');
    error.statusCode = 400;
    throw error;
  }

  const ref = db().collection(CLIENTS).doc(clientIdFromEmail(email));
  const snapshot = await ref.get();
  const existing = snapshot.exists ? snapshot.data() : {};
  if (existing.passwordHash) {
    const error = new Error('Client account already exists. Please login.');
    error.statusCode = 409;
    throw error;
  }

  const access = roleForEmail(email);
  const emailVerificationToken = crypto.randomBytes(24).toString('hex');
  const passwordHash = await bcrypt.hash(String(payload.password), 10);
  const client = {
    ...existing,
    email,
    fullName: String(payload.fullName || existing.fullName || '').trim(),
    companyName: String(payload.companyName || existing.companyName || '').trim(),
    country: String(payload.country || existing.country || '').trim(),
    address: String(payload.address || existing.address || '').trim(),
    phoneNumber: String(payload.phoneNumber || existing.phoneNumber || '').trim(),
    whatsappNumber: String(payload.whatsappNumber || existing.whatsappNumber || '').trim(),
    businessLocation: String(payload.businessLocation || existing.businessLocation || '').trim(),
    preferredContactMethod: String(payload.preferredContactMethod || existing.preferredContactMethod || '').trim(),
    passwordHash,
    emailVerified: false,
    emailVerificationToken,
    is_admin: access.is_admin,
    role: access.role,
    userType: access.userType,
    teamRole: access.teamRole,
    clientId: ref.id,
    status: existing.status || 'Active',
    assignedProjectManager: existing.assignedProjectManager || '',
    notes: existing.notes || '',
    registrationDate: existing.registrationDate || now(),
    registeredAt: existing.registeredAt || now(),
    updatedAt: now(),
  };
  await ref.set(client, { merge: true });
  if (!access.is_admin) {
    await createLead({
      fullName: client.fullName,
      companyName: client.companyName,
      email,
      phone: client.phoneNumber,
      requestedService: payload.requestedService || 'Client Registration',
      estimatedBudget: payload.estimatedBudget || '',
      expectedTimeline: payload.expectedTimeline || '',
      leadSource: payload.leadSource || 'Client Registration Portal',
      notes: payload.notes || 'Client registered through portal.',
      status: 'New',
    }, { email, role: 'client' }).catch((error) => console.warn('[SoftOTechPortal] lead creation failed:', error.message));
  }
  const plain = normalizeValue({ id: ref.id, ...client });
  return { client: plain, token: signPortalToken(plain), emailVerificationToken };
}

async function loginClient({ email, password }) {
  const client = await getClientByEmail(email);
  if (!client?.id) {
    const error = new Error('Client account not found.');
    error.statusCode = 404;
    throw error;
  }
  const raw = await db().collection(CLIENTS).doc(client.id).get();
  const passwordHash = raw.data()?.passwordHash;
  const valid = passwordHash && await bcrypt.compare(String(password || ''), passwordHash);
  if (!valid) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const access = roleForEmail(client.email);
  await db().collection(CLIENTS).doc(client.id).set({
    is_admin: access.is_admin,
    role: access.role,
    userType: access.userType,
    teamRole: access.teamRole,
    lastLoginAt: now(),
    updatedAt: now(),
  }, { merge: true });
  const updated = { ...client, ...access, lastLoginAt: now().toISOString() };
  return { client: updated, token: signPortalToken(updated) };
}

function verifyPortalToken(token) {
  const secret = jwtSecret();
  if (!secret) throw new Error('Portal JWT secret is not configured.');
  return jwt.verify(token, secret);
}

async function updateClientProfile(clientId, patch = {}) {
  const allowed = ['fullName', 'companyName', 'country', 'address', 'phoneNumber', 'whatsappNumber', 'businessLocation', 'preferredContactMethod', 'bestTimeToContact', 'notes'];
  const update = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) update[key] = String(patch[key] || '').trim();
  }
  update.updatedAt = now();
  await db().collection(CLIENTS).doc(clientId).set(update, { merge: true });
  return getClientById(clientId);
}

async function listClients({ search = '', status = '', limit = 1000, page = 1 } = {}) {
  const snapshot = await db().collection(CLIENTS).orderBy('registeredAt', 'desc').limit(2000).get();
  let items = snapshot.docs.map(docToObject).filter(Boolean);
  if (status) items = items.filter((client) => client.status === status);
  items = items.filter((client) => matchesSearch(client, search, ['clientId', 'fullName', 'companyName', 'email', 'phoneNumber', 'country', 'assignedProjectManager']));
  const total = items.length;
  const start = (Math.max(Number(page || 1), 1) - 1) * Number(limit || 1000);
  return { items: items.slice(start, start + Number(limit || 1000)), total, page, limit };
}

async function createClient(payload = {}, actor = {}) {
  const email = normalizeEmail(payload.email);
  if (!email) {
    const error = new Error('Client email is required.');
    error.statusCode = 400;
    throw error;
  }
  const ref = db().collection(CLIENTS).doc(clientIdFromEmail(email));
  const existing = await ref.get();
  const access = roleForEmail(email);
  const client = {
    ...(existing.exists ? existing.data() : {}),
    clientId: ref.id,
    fullName: cleanText(payload.fullName),
    companyName: cleanText(payload.companyName),
    email,
    phoneNumber: cleanText(payload.phone || payload.phoneNumber),
    country: cleanText(payload.country),
    address: cleanText(payload.address),
    registrationDate: existing.exists ? existing.data().registrationDate : now(),
    status: validOrDefault(payload.status, CLIENT_STATUSES, 'Active'),
    assignedProjectManager: cleanText(payload.assignedProjectManager),
    notes: cleanText(payload.notes),
    is_admin: access.is_admin,
    role: access.role,
    userType: access.userType,
    teamRole: access.teamRole,
    updatedAt: now(),
  };
  await ref.set(client, { merge: true });
  await writeAudit(existing.exists ? 'client_updated' : 'client_created', actor, { clientId: ref.id, email });
  return normalizeValue({ id: ref.id, ...client });
}

async function updateClientStatus(clientId, status, actor = {}) {
  if (!CLIENT_STATUSES.includes(status)) {
    const error = new Error('Invalid client status.');
    error.statusCode = 400;
    throw error;
  }
  await db().collection(CLIENTS).doc(clientId).set({ status, updatedAt: now() }, { merge: true });
  await writeAudit('client_status_updated', actor, { clientId, status });
  return getClientById(clientId);
}

async function createLead(payload = {}, actor = {}) {
  const leadId = await nextBusinessId('YSL');
  const lead = {
    leadId,
    fullName: cleanText(payload.fullName),
    companyName: cleanText(payload.companyName),
    email: normalizeEmail(payload.email),
    phone: cleanText(payload.phone || payload.phoneNumber),
    requestedService: cleanText(payload.requestedService),
    estimatedBudget: cleanText(payload.estimatedBudget),
    expectedTimeline: cleanText(payload.expectedTimeline),
    leadSource: cleanText(payload.leadSource || 'Website'),
    notes: cleanText(payload.notes),
    status: validOrDefault(payload.status, LEAD_STATUSES, 'New'),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(LEADS).doc(leadId).set(lead);
  await writeAudit('lead_created', actor, { leadId, email: lead.email });
  return normalizeValue(lead);
}

async function listLeads({ search = '', status = '', limit = 1000, page = 1 } = {}) {
  const snapshot = await db().collection(LEADS).orderBy('createdAt', 'desc').limit(2000).get();
  let items = snapshot.docs.map(docToObject).filter(Boolean);
  if (status) items = items.filter((lead) => lead.status === status);
  items = items.filter((lead) => matchesSearch(lead, search, ['leadId', 'fullName', 'companyName', 'email', 'phone', 'requestedService', 'leadSource']));
  const total = items.length;
  const start = (Math.max(Number(page || 1), 1) - 1) * Number(limit || 1000);
  return { items: items.slice(start, start + Number(limit || 1000)), total, page, limit };
}

async function updateLead(leadId, patch = {}, actor = {}) {
  const ref = db().collection(LEADS).doc(leadId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }
  const update = {
    fullName: patch.fullName !== undefined ? cleanText(patch.fullName) : doc.data().fullName,
    companyName: patch.companyName !== undefined ? cleanText(patch.companyName) : doc.data().companyName,
    email: patch.email !== undefined ? normalizeEmail(patch.email) : doc.data().email,
    phone: patch.phone !== undefined || patch.phoneNumber !== undefined ? cleanText(patch.phone || patch.phoneNumber) : doc.data().phone,
    requestedService: patch.requestedService !== undefined ? cleanText(patch.requestedService) : doc.data().requestedService,
    estimatedBudget: patch.estimatedBudget !== undefined ? cleanText(patch.estimatedBudget) : doc.data().estimatedBudget,
    expectedTimeline: patch.expectedTimeline !== undefined ? cleanText(patch.expectedTimeline) : doc.data().expectedTimeline,
    leadSource: patch.leadSource !== undefined ? cleanText(patch.leadSource) : doc.data().leadSource,
    notes: patch.notes !== undefined ? cleanText(patch.notes) : doc.data().notes,
    status: patch.status ? validOrDefault(patch.status, LEAD_STATUSES, doc.data().status || 'New') : doc.data().status,
    updatedAt: now(),
  };
  await ref.set(update, { merge: true });
  await writeAudit('lead_updated', actor, { leadId, status: update.status });
  return docToObject(await ref.get());
}

async function convertLeadToClient(leadId, actor = {}) {
  const ref = db().collection(LEADS).doc(leadId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }
  const lead = normalizeValue({ id: doc.id, ...doc.data() });
  const client = await createClient({
    fullName: lead.fullName,
    companyName: lead.companyName,
    email: lead.email,
    phone: lead.phone,
    notes: lead.notes,
    status: 'Active',
  }, actor);
  await ref.set({ status: 'Won', convertedClientId: client.clientId || client.id, convertedAt: now(), updatedAt: now() }, { merge: true });
  await writeAudit('lead_converted_to_client', actor, { leadId, clientId: client.clientId || client.id });
  return { lead: docToObject(await ref.get()), client };
}

async function listRequestsForClient(email) {
  const result = await projectRequestStore.list({ search: normalizeEmail(email), limit: 100, page: 1 });
  return result.items.filter((item) => normalizeEmail(item.contact?.email) === normalizeEmail(email));
}

async function listCollectionForClient(collectionName, email) {
  const snapshot = await db().collection(collectionName).where('clientEmail', '==', normalizeEmail(email)).limit(100).get();
  return snapshot.docs.map(docToObject).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function writeAudit(eventType, actor = {}, metadata = {}) {
  const auditId = crypto.randomUUID();
  const entry = {
    auditId,
    eventType: String(eventType || 'portal_event').trim(),
    actorEmail: normalizeEmail(actor.email),
    actorRole: String(actor.role || actor.userType || '').trim(),
    metadata,
    createdAt: now(),
  };
  await db().collection(AUDIT_LOGS).doc(auditId).set(entry);
  return normalizeValue(entry);
}

async function clientDashboard(client) {
  const [requests, projects, quotations, invoices, messages, documents, proposals, payments] = await Promise.all([
    listRequestsForClient(client.email),
    listCollectionForClient(PROJECTS, client.email),
    listCollectionForClient(QUOTATIONS, client.email),
    listCollectionForClient(INVOICES, client.email),
    listCollectionForClient(MESSAGES, client.email),
    listCollectionForClient(DOCUMENTS, client.email),
    listCollectionForClient(PROPOSALS, client.email),
    listCollectionForClient(PAYMENTS, client.email),
  ]);
  return {
    profile: client,
    widgets: {
      totalRequests: requests.length,
      activeProjects: projects.filter((item) => !['Completed', 'Rejected'].includes(item.status)).length,
      pendingQuotations: quotations.filter((item) => item.status === 'Sent').length,
      completedProjects: projects.filter((item) => item.status === 'Completed').length,
    },
    requests,
    projects,
    quotations,
    invoices,
    messages,
    documents,
    proposals,
    payments,
  };
}

async function adminDashboard() {
  const [clients, leads, requests, requestAnalytics, projects, requirements, quotations, invoices, messages, documents, proposals, payments, portfolio, auditLogs] = await Promise.all([
    listClients({ limit: 1000, page: 1 }),
    listLeads({ limit: 1000, page: 1 }),
    projectRequestStore.list({ limit: 1000, page: 1 }),
    projectRequestStore.analytics(),
    db().collection(PROJECTS).limit(1000).get(),
    db().collection(REQUIREMENTS).limit(1000).get(),
    db().collection(QUOTATIONS).limit(1000).get(),
    db().collection(INVOICES).limit(1000).get(),
    db().collection(MESSAGES).limit(1000).get(),
    db().collection(DOCUMENTS).limit(1000).get(),
    db().collection(PROPOSALS).limit(1000).get(),
    db().collection(PAYMENTS).limit(1000).get(),
    db().collection(PORTFOLIO_PROJECTS).limit(1000).get(),
    db().collection(AUDIT_LOGS).orderBy('createdAt', 'desc').limit(100).get(),
  ]);
  const projectItems = projects.docs.map(docToObject);
  const invoiceItems = invoices.docs.map(docToObject);
  const quotationItems = quotations.docs.map(docToObject);
  const paymentItems = payments.docs.map(docToObject);
  const pricingReport = await pricing.pricingReports({ quotations: quotationItems, invoices: invoiceItems, payments: paymentItems });
  return {
    metrics: {
      totalClients: clients.total,
      totalLeads: leads.total,
      totalRequests: requestAnalytics.total,
      openProjects: projectItems.filter((item) => !['Completed', 'Rejected'].includes(item.status)).length,
      completedProjects: projectItems.filter((item) => item.status === 'Completed').length,
      pendingQuotations: quotationItems.filter((item) => ['Draft', 'Sent'].includes(item.status)).length,
      outstandingPayments: invoiceItems.filter((item) => ['Unpaid', 'Overdue', 'Partially Paid'].includes(item.status)).reduce((sum, item) => sum + Number(item.balance || item.amount || 0), 0),
      revenueGenerated: paymentItems.filter((item) => ['Successful', 'Received', 'Paid'].includes(item.status || item.paymentStatus)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
      monthlyLeads: requestAnalytics.monthly?.[0]?.count || 0,
    },
    clients: clients.items,
    leads: leads.items,
    requests: requests.items,
    analytics: requestAnalytics,
    projects: projectItems,
    requirements: requirements.docs.map(docToObject),
    quotations: quotationItems,
    invoices: invoiceItems,
    messages: messages.docs.map(docToObject),
    documents: documents.docs.map(docToObject),
    proposals: proposals.docs.map(docToObject),
    payments: paymentItems,
    portfolioProjects: portfolio.docs.map(docToObject),
    auditLogs: auditLogs.docs.map(docToObject),
    pricingReport,
    roles: TEAM_ROLES,
    statuses: {
      clients: CLIENT_STATUSES,
      leads: LEAD_STATUSES,
      quotations: QUOTATION_STATUSES,
      payments: PAYMENT_STATUSES,
      invoices: INVOICE_STATUSES,
      projects: PROJECT_STATUSES,
      requirementCategories: REQUIREMENT_CATEGORIES,
      requirementPriorities: REQUIREMENT_PRIORITIES,
    },
  };
}

async function createProject(payload = {}) {
  const projectId = await nextBusinessId('YSP');
  const project = {
    projectId,
    requestId: String(payload.requestId || '').trim(),
    clientEmail: normalizeEmail(payload.clientEmail),
    clientName: String(payload.clientName || '').trim(),
    clientId: String(payload.clientId || '').trim(),
    projectName: String(payload.projectName || payload.title || 'New Project').trim(),
    projectType: String(payload.projectType || '').trim(),
    title: String(payload.title || payload.projectName || 'New Project').trim(),
    description: String(payload.description || '').trim(),
    projectDescription: String(payload.projectDescription || payload.description || '').trim(),
    startDate: payload.startDate ? new Date(payload.startDate) : now(),
    endDate: payload.endDate ? new Date(payload.endDate) : (payload.deadline ? new Date(payload.deadline) : null),
    budget: Number(payload.budget || payload.amount || payload.estimatedAmount || 0),
    assignedTeam: Array.isArray(payload.assignedTeam) ? payload.assignedTeam : [],
    projectManager: String(payload.projectManager || '').trim(),
    assignedDevelopers: Array.isArray(payload.assignedDevelopers) ? payload.assignedDevelopers : [],
    deadline: payload.deadline ? new Date(payload.deadline) : null,
    milestones: Array.isArray(payload.milestones) ? payload.milestones : defaultMilestones(payload),
    progress: Number(payload.progress || payload.progressPercentage || 0),
    progressPercentage: Number(payload.progressPercentage || payload.progress || 0),
    riskLevel: String(payload.riskLevel || 'Low').trim(),
    deliverables: Array.isArray(payload.deliverables) ? payload.deliverables : [],
    status: validOrDefault(payload.status, PROJECT_STATUSES, 'Planning'),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(PROJECTS).doc(projectId).set(project);
  await writeAudit('project_created', { email: payload.actorEmail, role: 'admin' }, { projectId, clientEmail: project.clientEmail });
  return normalizeValue(project);
}

function defaultMilestones(payload = {}) {
  const amount = Number(payload.amount || payload.estimatedAmount || 0);
  return [
    { title: 'Planning', status: 'Pending', paymentPercent: 20, amount: amount ? amount * 0.2 : 0 },
    { title: 'Design', status: 'Pending', paymentPercent: 20, amount: amount ? amount * 0.2 : 0 },
    { title: 'Development', status: 'Pending', paymentPercent: 35, amount: amount ? amount * 0.35 : 0 },
    { title: 'Testing & QA', status: 'Pending', paymentPercent: 15, amount: amount ? amount * 0.15 : 0 },
    { title: 'Deployment', status: 'Pending', paymentPercent: 10, amount: amount ? amount * 0.1 : 0 },
  ];
}

async function updateProjectMilestones(projectId, milestones = [], actor = {}) {
  const ref = db().collection(PROJECTS).doc(projectId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  const completed = milestones.filter((item) => String(item.status || '').toLowerCase() === 'completed').length;
  const progress = milestones.length ? Math.round((completed / milestones.length) * 100) : 0;
  await ref.set({ milestones, progress, updatedAt: now() }, { merge: true });
  await writeAudit('project_milestones_updated', actor, { projectId, progress });
  return docToObject(await ref.get());
}

async function approveProjectRequest(payload = {}, actor = {}) {
  const project = await createProject({
    requestId: payload.requestId,
    clientEmail: payload.clientEmail,
    clientName: payload.clientName,
    title: payload.title || payload.projectName || 'Approved Project',
    description: payload.description || '',
    projectManager: payload.projectManager || '',
    assignedDevelopers: payload.assignedDevelopers || [],
    deadline: payload.deadline || null,
    amount: payload.amount || 0,
    status: 'Planning',
    actorEmail: actor.email,
  });
  await writeAudit('project_request_approved', actor, { requestId: payload.requestId, projectId: project.projectId });
  return project;
}

async function createQuotation(payload = {}) {
  const quotationId = await nextBusinessId('YSQ');
  const calculation = Array.isArray(payload.serviceSelections) && payload.serviceSelections.length
    ? await pricing.calculateFromServiceSelections(payload.serviceSelections, { currency: payload.currency || 'GHS', discount: payload.discount, tax: payload.tax })
    : {
      currency: payload.currency || 'GHS',
      lineItems: Array.isArray(payload.lineItems) ? payload.lineItems : [],
      grandTotal: Number(payload.amount || 0),
      subtotal: Number(payload.amount || 0),
      discount: Number(payload.discount || 0),
      tax: Number(payload.tax || 0),
      serviceCost: Number(payload.amount || 0),
    };
  const quotation = {
    quotationId,
    clientId: String(payload.clientId || '').trim(),
    clientEmail: normalizeEmail(payload.clientEmail),
    requestId: String(payload.requestId || '').trim(),
    projectId: String(payload.projectId || '').trim(),
    projectTitle: String(payload.projectTitle || payload.title || 'Project Quotation').trim(),
    projectDescription: String(payload.projectDescription || payload.description || '').trim(),
    title: String(payload.title || payload.projectTitle || 'Project Quotation').trim(),
    amount: Number(calculation.grandTotal || payload.amount || 0),
    currency: String(calculation.currency || payload.currency || 'GHS').trim(),
    lineItems: calculation.lineItems,
    costBreakdown: calculation,
    notes: String(payload.notes || '').trim(),
    status: validOrDefault(payload.status, QUOTATION_STATUSES, 'Sent'),
    createdDate: now(),
    validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
    proposalId: String(payload.proposalId || '').trim(),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(QUOTATIONS).doc(quotationId).set(quotation);
  await writeAudit('quotation_sent', { email: payload.actorEmail, role: 'admin' }, { quotationId, clientEmail: quotation.clientEmail });
  return normalizeValue(quotation);
}

function proposalTextFromPayload(payload = {}) {
  const projectType = payload.projectType || payload.title || 'Project';
  const requirements = Array.isArray(payload.requirements)
    ? payload.requirements.join(', ')
    : String(payload.requirements || payload.description || '').trim();
  const timeline = payload.timeline || payload.duration || 'To be confirmed after discovery';
  const amount = Number(payload.amount || payload.budget || 0);
  return [
    `Proposal: ${projectType}`,
    '',
    'Scope',
    requirements || 'Scope will be finalized during discovery.',
    '',
    'Delivery Plan',
    '1. Discovery and requirements validation',
    '2. UI/UX and technical architecture',
    '3. Implementation and integrations',
    '4. Testing, deployment, and handoff',
    '',
    `Estimated Timeline: ${timeline}`,
    `Estimated Investment: ${amount ? `GHS ${amount.toLocaleString()}` : 'To be confirmed'}`,
  ].join('\n');
}

async function generateProposal(payload = {}, actor = {}) {
  const proposalId = await nextBusinessId('YSPROP');
  const proposal = {
    proposalId,
    clientEmail: normalizeEmail(payload.clientEmail),
    requestId: String(payload.requestId || '').trim(),
    projectId: String(payload.projectId || '').trim(),
    title: String(payload.title || payload.projectType || 'Project Proposal').trim(),
    projectType: String(payload.projectType || '').trim(),
    amount: Number(payload.amount || payload.budget || 0),
    currency: String(payload.currency || 'GHS').trim(),
    timeline: String(payload.timeline || '').trim(),
    content: payload.content || proposalTextFromPayload(payload),
    status: 'Draft',
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(PROPOSALS).doc(proposalId).set(proposal);
  await writeAudit('proposal_generated', actor, { proposalId, clientEmail: proposal.clientEmail });
  return normalizeValue(proposal);
}

async function respondToQuotation(quotationId, clientEmail, status) {
  if (!['Accepted', 'Rejected'].includes(status)) {
    const error = new Error('Invalid quotation response.');
    error.statusCode = 400;
    throw error;
  }
  const ref = db().collection(QUOTATIONS).doc(quotationId);
  const doc = await ref.get();
  if (!doc.exists || normalizeEmail(doc.data().clientEmail) !== normalizeEmail(clientEmail)) {
    const error = new Error('Quotation not found.');
    error.statusCode = 404;
    throw error;
  }
  await ref.set({ status, respondedAt: now(), updatedAt: now() }, { merge: true });
  await writeAudit('quotation_response', { email: clientEmail, role: 'client' }, { quotationId, status });
  return docToObject(await ref.get());
}

async function createInvoice(payload = {}) {
  const invoiceNumber = await nextBusinessId('YSI');
  const calculation = Array.isArray(payload.serviceSelections) && payload.serviceSelections.length
    ? await pricing.calculateFromServiceSelections(payload.serviceSelections, { currency: payload.currency || 'GHS', discount: payload.discount, tax: payload.tax })
    : {
      currency: payload.currency || 'GHS',
      lineItems: Array.isArray(payload.lineItems) ? payload.lineItems : [],
      grandTotal: Number(payload.amount || payload.totalAmount || 0),
      subtotal: Number(payload.amount || payload.totalAmount || 0),
      discount: Number(payload.discount || 0),
      tax: Number(payload.tax || 0),
    };
  const invoice = {
    invoiceNumber,
    clientId: String(payload.clientId || '').trim(),
    clientName: String(payload.clientName || '').trim(),
    clientEmail: normalizeEmail(payload.clientEmail),
    projectId: String(payload.projectId || '').trim(),
    projectName: String(payload.projectName || payload.title || '').trim(),
    amount: Number(calculation.grandTotal || payload.amount || payload.totalAmount || 0),
    totalAmount: Number(calculation.grandTotal || payload.amount || payload.totalAmount || 0),
    balance: Number(calculation.grandTotal || payload.amount || payload.totalAmount || 0),
    currency: String(calculation.currency || payload.currency || 'GHS').trim(),
    lineItems: calculation.lineItems || [],
    costBreakdown: calculation,
    issueDate: payload.issueDate ? new Date(payload.issueDate) : now(),
    dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
    status: validOrDefault(payload.status, INVOICE_STATUSES, 'Unpaid'),
    invoiceStatus: validOrDefault(payload.invoiceStatus || payload.status, INVOICE_STATUSES, 'Unpaid'),
    notes: String(payload.notes || '').trim(),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(INVOICES).doc(invoiceNumber).set(invoice);
  await writeAudit('invoice_created', { email: payload.actorEmail, role: 'admin' }, { invoiceNumber, clientEmail: invoice.clientEmail });
  return normalizeValue(invoice);
}

async function recordPayment(payload = {}, actor = {}) {
  const paymentId = await nextBusinessId('YSPAY');
  const payment = {
    paymentId,
    clientEmail: normalizeEmail(payload.clientEmail),
    projectId: String(payload.projectId || '').trim(),
    invoiceNumber: String(payload.invoiceNumber || '').trim(),
    milestoneTitle: String(payload.milestoneTitle || '').trim(),
    amount: Number(payload.amount || 0),
    currency: String(payload.currency || 'GHS').trim(),
    method: validOrDefault(payload.method || payload.paymentMethod, PAYMENT_METHODS, 'Bank Transfer'),
    paymentMethod: validOrDefault(payload.paymentMethod || payload.method, PAYMENT_METHODS, 'Bank Transfer'),
    transactionReference: String(payload.transactionReference || '').trim(),
    paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : now(),
    receiptUrl: String(payload.receiptUrl || '').trim(),
    status: validOrDefault(payload.status || payload.paymentStatus, PAYMENT_STATUSES, 'Successful'),
    paymentStatus: validOrDefault(payload.paymentStatus || payload.status, PAYMENT_STATUSES, 'Successful'),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(PAYMENTS).doc(paymentId).set(payment);
  if (payment.invoiceNumber && payment.status === 'Successful') {
    const invoiceRef = db().collection(INVOICES).doc(payment.invoiceNumber);
    const invoiceDoc = await invoiceRef.get();
    if (invoiceDoc.exists) {
      const invoice = invoiceDoc.data();
      const paid = Number(invoice.amountPaid || 0) + payment.amount;
      const total = Number(invoice.totalAmount || invoice.amount || 0);
      const balance = Math.max(total - paid, 0);
      const status = balance === 0 ? 'Paid' : 'Partially Paid';
      await invoiceRef.set({ amountPaid: paid, balance, status, invoiceStatus: status, updatedAt: now() }, { merge: true });
    }
  }
  await writeAudit('payment_recorded', actor, { paymentId, clientEmail: payment.clientEmail, amount: payment.amount });
  return normalizeValue(payment);
}

async function createRequirement(payload = {}, actor = {}) {
  const requirementId = await nextBusinessId('YSR');
  const requirement = {
    requirementId,
    projectId: cleanText(payload.projectId),
    requirementTitle: cleanText(payload.requirementTitle || payload.title),
    requirementDescription: cleanText(payload.requirementDescription || payload.description),
    category: validOrDefault(payload.category, REQUIREMENT_CATEGORIES, 'Functional'),
    priority: validOrDefault(payload.priority, REQUIREMENT_PRIORITIES, 'Medium'),
    status: cleanText(payload.status || 'New'),
    approved: Boolean(payload.approved || false),
    completed: Boolean(payload.completed || false),
    createdBy: cleanText(payload.createdBy || actor.email),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(REQUIREMENTS).doc(requirementId).set(requirement);
  await writeAudit('requirement_created', actor, { requirementId, projectId: requirement.projectId });
  return normalizeValue(requirement);
}

async function updateRequirement(requirementId, patch = {}, actor = {}) {
  const ref = db().collection(REQUIREMENTS).doc(requirementId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Requirement not found.');
    error.statusCode = 404;
    throw error;
  }
  const update = {
    ...(patch.requirementTitle !== undefined ? { requirementTitle: cleanText(patch.requirementTitle) } : {}),
    ...(patch.requirementDescription !== undefined ? { requirementDescription: cleanText(patch.requirementDescription) } : {}),
    ...(patch.category !== undefined ? { category: validOrDefault(patch.category, REQUIREMENT_CATEGORIES, doc.data().category || 'Functional') } : {}),
    ...(patch.priority !== undefined ? { priority: validOrDefault(patch.priority, REQUIREMENT_PRIORITIES, doc.data().priority || 'Medium') } : {}),
    ...(patch.status !== undefined ? { status: cleanText(patch.status) } : {}),
    ...(patch.approved !== undefined ? { approved: Boolean(patch.approved) } : {}),
    ...(patch.completed !== undefined ? { completed: Boolean(patch.completed) } : {}),
    updatedAt: now(),
  };
  await ref.set(update, { merge: true });
  await writeAudit('requirement_updated', actor, { requirementId, update });
  return docToObject(await ref.get());
}

async function listRequirements({ projectId = '', search = '', limit = 1000, page = 1 } = {}) {
  const snapshot = await db().collection(REQUIREMENTS).orderBy('createdAt', 'desc').limit(2000).get();
  let items = snapshot.docs.map(docToObject).filter(Boolean);
  if (projectId) items = items.filter((item) => item.projectId === projectId);
  items = items.filter((item) => matchesSearch(item, search, ['requirementId', 'projectId', 'requirementTitle', 'requirementDescription', 'category', 'priority']));
  const total = items.length;
  const start = (Math.max(Number(page || 1), 1) - 1) * Number(limit || 1000);
  return { items: items.slice(start, start + Number(limit || 1000)), total, page, limit };
}

async function createMessage(payload = {}) {
  const messageId = crypto.randomUUID();
  const message = {
    messageId,
    clientEmail: normalizeEmail(payload.clientEmail),
    senderEmail: normalizeEmail(payload.senderEmail),
    senderRole: String(payload.senderRole || 'client').trim(),
    subject: String(payload.subject || '').trim(),
    body: String(payload.body || '').trim(),
    readByClient: payload.senderRole === 'client',
    readByAdmin: payload.senderRole !== 'client',
    createdAt: now(),
  };
  await db().collection(MESSAGES).doc(messageId).set(message);
  await writeAudit('message_sent', { email: message.senderEmail, role: message.senderRole }, { messageId, clientEmail: message.clientEmail });
  return normalizeValue(message);
}

async function uploadDocument(file, payload = {}) {
  const result = await mediaStorage.upload(file, {
    folder: 'project-portal-documents',
    prefix: `${Date.now()}-${payload.clientEmail || 'client'}`,
    type: 'file',
    area: 'softotech-client-portal',
  });
  const documentId = crypto.randomUUID();
  const document = {
    documentId,
    clientEmail: normalizeEmail(payload.clientEmail),
    projectId: String(payload.projectId || '').trim(),
    requestId: String(payload.requestId || '').trim(),
    uploadedBy: String(payload.uploadedBy || 'client').trim(),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    provider: result.provider || '',
    bucket: result.bucket || '',
    key: result.key || result.public_id || '',
    url: result.secure_url || result.url,
    createdAt: now(),
  };
  await db().collection(DOCUMENTS).doc(documentId).set(document);
  await writeAudit('document_uploaded', { email: payload.actorEmail || payload.clientEmail, role: payload.uploadedBy }, { documentId, clientEmail: document.clientEmail });
  return normalizeValue(document);
}

async function upsertPortfolioProject(payload = {}, actor = {}) {
  const projectKey = String(payload.projectKey || payload.title || crypto.randomUUID())
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const project = {
    projectKey,
    title: String(payload.title || '').trim(),
    category: String(payload.category || '').trim(),
    description: String(payload.description || '').trim(),
    screenshots: Array.isArray(payload.screenshots) ? payload.screenshots : [],
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    architectureDiagrams: Array.isArray(payload.architectureDiagrams) ? payload.architectureDiagrams : [],
    technologyStack: Array.isArray(payload.technologyStack) ? payload.technologyStack : [],
    achievements: Array.isArray(payload.achievements) ? payload.achievements : [],
    liveDemoUrl: String(payload.liveDemoUrl || '').trim(),
    updatedAt: now(),
    createdAt: payload.createdAt || now(),
  };
  await db().collection(PORTFOLIO_PROJECTS).doc(projectKey).set(project, { merge: true });
  await writeAudit('portfolio_project_upserted', actor, { projectKey });
  return normalizeValue(project);
}

async function projectAiAssistant(payload = {}, actor = {}) {
  const question = String(payload.question || payload.prompt || '').trim();
  if (!question) {
    const error = new Error('Question is required.');
    error.statusCode = 400;
    throw error;
  }

  const context = {
    projectId: payload.projectId || '',
    requestId: payload.requestId || '',
    clientEmail: normalizeEmail(payload.clientEmail || actor.email),
    question,
  };
  const aiBaseUrl = process.env.YENKASA_AI_ENGINE_URL || process.env.YENKASA_AI_BACKEND_URL || '';
  if (aiBaseUrl && typeof fetch === 'function') {
    try {
      const response = await fetch(`${aiBaseUrl.replace(/\/+$/, '')}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.YENKASA_AI_EVENT_API_KEY ? { Authorization: `Bearer ${process.env.YENKASA_AI_EVENT_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          message: question,
          context,
          source: 'softotech_project_portal',
        }),
      });
      if (response.ok) {
        const payloadJson = await response.json();
        await writeAudit('project_ai_assistant_used', actor, context);
        return { answer: payloadJson.answer || payloadJson.response || payloadJson.message || 'YenkasaAI returned a response.', source: 'yenkasa_ai', raw: payloadJson };
      }
    } catch (error) {
      console.warn('[SoftOTechPortal] YenkasaAI request failed:', error.message);
    }
  }

  await writeAudit('project_ai_assistant_used', actor, { ...context, fallback: true });
  return {
    answer: [
      'Project AI Assistant fallback response:',
      `Question: ${question}`,
      'I can help summarize requirements, draft proposals, identify project risks, and suggest next milestones once YenkasaAI is connected.',
    ].join('\n'),
    source: 'local_fallback',
  };
}

module.exports = {
  adminDashboard,
  approveProjectRequest,
  clientDashboard,
  CLIENT_STATUSES,
  convertLeadToClient,
  createClient,
  createInvoice,
  createLead,
  createMessage,
  createProject,
  createQuotation,
  createRequirement,
  generateProposal,
  getClientById,
  listClients,
  listLeads,
  listRequirements,
  loginClient,
  projectAiAssistant,
  registerClient,
  recordPayment,
  respondToQuotation,
  signPortalToken,
  TEAM_ROLES,
  updateClientProfile,
  updateClientStatus,
  updateLead,
  updateProjectMilestones,
  updateRequirement,
  upsertPortfolioProject,
  uploadDocument,
  verifyPortalToken,
};
