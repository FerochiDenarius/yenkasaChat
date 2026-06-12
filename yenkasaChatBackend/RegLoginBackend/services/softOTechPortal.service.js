const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const mediaStorage = require('./mediaStorage.service');
const projectRequestStore = require('./projectRequestStore.service');
const { isPrivilegedAdminEmail } = require('./adminBootstrap.service');

const DEFAULT_PROJECT_ID = 'project-10405180-0afd-4ecc-9f8';
const CLIENTS = process.env.PROJECT_REQUEST_CLIENT_COLLECTION || 'project_request_clients';
const QUOTATIONS = process.env.SOFTOTECH_QUOTATION_COLLECTION || 'softotech_quotations';
const INVOICES = process.env.SOFTOTECH_INVOICE_COLLECTION || 'softotech_invoices';
const PROJECTS = process.env.SOFTOTECH_PROJECT_COLLECTION || 'softotech_projects';
const MESSAGES = process.env.SOFTOTECH_MESSAGE_COLLECTION || 'softotech_messages';
const DOCUMENTS = process.env.SOFTOTECH_DOCUMENT_COLLECTION || 'softotech_documents';
const COUNTERS = process.env.SOFTOTECH_COUNTER_COLLECTION || 'softotech_counters';

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
    return { is_admin: true, role: 'senior_developer', userType: 'Senior Developer' };
  }
  return { is_admin: false, role: 'client', userType: 'Client' };
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
    registeredAt: existing.registeredAt || now(),
    updatedAt: now(),
  };
  await ref.set(client, { merge: true });
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
  const allowed = ['fullName', 'companyName', 'phoneNumber', 'whatsappNumber', 'businessLocation', 'preferredContactMethod', 'bestTimeToContact'];
  const update = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) update[key] = String(patch[key] || '').trim();
  }
  update.updatedAt = now();
  await db().collection(CLIENTS).doc(clientId).set(update, { merge: true });
  return getClientById(clientId);
}

async function listRequestsForClient(email) {
  const result = await projectRequestStore.list({ search: normalizeEmail(email), limit: 100, page: 1 });
  return result.items.filter((item) => normalizeEmail(item.contact?.email) === normalizeEmail(email));
}

async function listCollectionForClient(collectionName, email) {
  const snapshot = await db().collection(collectionName).where('clientEmail', '==', normalizeEmail(email)).limit(100).get();
  return snapshot.docs.map(docToObject).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function clientDashboard(client) {
  const [requests, projects, quotations, invoices, messages, documents] = await Promise.all([
    listRequestsForClient(client.email),
    listCollectionForClient(PROJECTS, client.email),
    listCollectionForClient(QUOTATIONS, client.email),
    listCollectionForClient(INVOICES, client.email),
    listCollectionForClient(MESSAGES, client.email),
    listCollectionForClient(DOCUMENTS, client.email),
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
  };
}

async function adminDashboard() {
  const [clients, requests, requestAnalytics, projects, quotations, invoices, messages] = await Promise.all([
    projectRequestStore.listClients({ limit: 1000, page: 1 }),
    projectRequestStore.list({ limit: 1000, page: 1 }),
    projectRequestStore.analytics(),
    db().collection(PROJECTS).limit(1000).get(),
    db().collection(QUOTATIONS).limit(1000).get(),
    db().collection(INVOICES).limit(1000).get(),
    db().collection(MESSAGES).limit(1000).get(),
  ]);
  const projectItems = projects.docs.map(docToObject);
  const invoiceItems = invoices.docs.map(docToObject);
  return {
    metrics: {
      totalClients: clients.total,
      totalRequests: requestAnalytics.total,
      openProjects: projectItems.filter((item) => !['Completed', 'Rejected'].includes(item.status)).length,
      completedProjects: projectItems.filter((item) => item.status === 'Completed').length,
      revenueGenerated: invoiceItems.filter((item) => ['Paid', 'Completed'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
      monthlyLeads: requestAnalytics.monthly?.[0]?.count || 0,
    },
    clients: clients.items,
    requests: requests.items,
    analytics: requestAnalytics,
    projects: projectItems,
    quotations: quotations.docs.map(docToObject),
    invoices: invoiceItems,
    messages: messages.docs.map(docToObject),
  };
}

async function createProject(payload = {}) {
  const projectId = await nextBusinessId('YSP');
  const project = {
    projectId,
    requestId: String(payload.requestId || '').trim(),
    clientEmail: normalizeEmail(payload.clientEmail),
    clientName: String(payload.clientName || '').trim(),
    title: String(payload.title || 'New Project').trim(),
    description: String(payload.description || '').trim(),
    projectManager: String(payload.projectManager || '').trim(),
    assignedDevelopers: Array.isArray(payload.assignedDevelopers) ? payload.assignedDevelopers : [],
    deadline: payload.deadline ? new Date(payload.deadline) : null,
    milestones: Array.isArray(payload.milestones) ? payload.milestones : [],
    status: String(payload.status || 'Pending').trim(),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(PROJECTS).doc(projectId).set(project);
  return normalizeValue(project);
}

async function createQuotation(payload = {}) {
  const quotationId = await nextBusinessId('YSQ');
  const quotation = {
    quotationId,
    clientEmail: normalizeEmail(payload.clientEmail),
    requestId: String(payload.requestId || '').trim(),
    projectId: String(payload.projectId || '').trim(),
    title: String(payload.title || 'Project Quotation').trim(),
    amount: Number(payload.amount || 0),
    currency: String(payload.currency || 'GHS').trim(),
    lineItems: Array.isArray(payload.lineItems) ? payload.lineItems : [],
    notes: String(payload.notes || '').trim(),
    status: 'Sent',
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(QUOTATIONS).doc(quotationId).set(quotation);
  return normalizeValue(quotation);
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
  return docToObject(await ref.get());
}

async function createInvoice(payload = {}) {
  const invoiceNumber = await nextBusinessId('YSI');
  const invoice = {
    invoiceNumber,
    clientEmail: normalizeEmail(payload.clientEmail),
    projectId: String(payload.projectId || '').trim(),
    amount: Number(payload.amount || 0),
    currency: String(payload.currency || 'GHS').trim(),
    dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
    status: String(payload.status || 'Unpaid').trim(),
    notes: String(payload.notes || '').trim(),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(INVOICES).doc(invoiceNumber).set(invoice);
  return normalizeValue(invoice);
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
  return normalizeValue(document);
}

module.exports = {
  adminDashboard,
  clientDashboard,
  createInvoice,
  createMessage,
  createProject,
  createQuotation,
  getClientById,
  loginClient,
  registerClient,
  respondToQuotation,
  signPortalToken,
  updateClientProfile,
  uploadDocument,
  verifyPortalToken,
};
