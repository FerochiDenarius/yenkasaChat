const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const mediaStorage = require('../../../services/mediaStorage.service');
const pricing = require('./softOTechPricing.service');
const projectRequestStore = require('./projectRequestStore.service');
const { isPrivilegedAdminEmail } = require('../../../services/adminBootstrap.service');
const portfolioContent = require('../../portfolio/services/portfolioContent.service');
const { publishIntelligenceEvent } = require('../../../src/intelligence/services/eventPublisher.service');

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
const TEAM_ASSIGNMENTS = process.env.SOFTOTECH_TEAM_ASSIGNMENT_COLLECTION || 'project_team_assignments';
const TASKS = process.env.SOFTOTECH_TASK_COLLECTION || 'softotech_tasks';
const GITHUB_CONNECTIONS = process.env.SOFTOTECH_GITHUB_CONNECTION_COLLECTION || 'softotech_github_connections';
const GITHUB_OAUTH_STATES = process.env.SOFTOTECH_GITHUB_OAUTH_STATE_COLLECTION || 'softotech_github_oauth_states';
const PROJECT_REPOSITORIES = process.env.SOFTOTECH_PROJECT_REPOSITORY_COLLECTION || 'softotech_project_repositories';
const GITHUB_ACTIVITY = process.env.SOFTOTECH_GITHUB_ACTIVITY_COLLECTION || 'softotech_github_activity';
const TEAM_ROLES = Object.freeze([
  'Client',
  'Admin',
  'Senior Developer',
  'Junior Developer',
  'Designer',
  'Frontend Developer',
  'Backend Engineer',
  'Mobile Developer',
  'QA Engineer',
  'DevOps Engineer',
  'Project Manager',
]);
const ASSIGNMENT_ROLES = Object.freeze([
  'Project Manager',
  'Frontend Developer',
  'Backend Engineer',
  'Mobile Developer',
  'QA Engineer',
  'DevOps Engineer',
]);

const CLIENT_STATUSES = Object.freeze(['Active', 'Suspended', 'Closed']);
const LEAD_STATUSES = Object.freeze(['New', 'Contacted', 'Negotiation', 'Quotation Sent', 'Won', 'Lost']);
const QUOTATION_STATUSES = Object.freeze(['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired']);
const PAYMENT_METHODS = Object.freeze(['Paystack', 'MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Bank Transfer']);
const PAYMENT_STATUSES = Object.freeze(['Pending', 'Successful', 'Failed', 'Refunded']);
const INVOICE_STATUSES = Object.freeze(['Paid', 'Unpaid', 'Overdue', 'Partially Paid']);
const PROJECT_STATUSES = Object.freeze(['Planning', 'In Progress', 'Client Review', 'Testing', 'Deployment', 'Completed', 'Suspended']);
const REQUIREMENT_CATEGORIES = Object.freeze(['Functional', 'Frontend / UI', 'Backend / API', 'Database', 'Infrastructure', 'Security', 'Integrations']);
const REQUIREMENT_PRIORITIES = Object.freeze(['Low', 'Medium', 'High', 'Critical']);
const REQUIREMENT_STATUSES = Object.freeze(['Unassigned', 'Submitted', 'Approved', 'Assigned', 'In Development', 'Testing', 'Client Review', 'Completed', 'Rejected']);
const CHANGE_REQUEST_STATUSES = Object.freeze(['Pending', 'Approved', 'Rejected']);

function projectId() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || DEFAULT_PROJECT_ID;
}

function firestoreDatabaseId() {
  return process.env.SOFTOTECH_FIRESTORE_DATABASE_ID ||
    process.env.PROJECT_REQUEST_FIRESTORE_DATABASE_ID ||
    process.env.FIRESTORE_DATABASE_ID ||
    '(default)';
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
  return getFirestore(admin.app(), firestoreDatabaseId());
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

function compactPortalMetadata(value, depth = 0) {
  if (value === undefined || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => compactPortalMetadata(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).slice(0, 80).reduce((acc, [key, entry]) => {
      if (['password', 'passwordHash', 'token', 'secret', 'emailVerificationToken', 'passwordResetToken'].includes(key)) return acc;
      acc[key] = compactPortalMetadata(entry, depth + 1);
      return acc;
    }, {});
  }
  return String(value);
}

function publishPortalIntelligenceEvent(eventType, actor = {}, metadata = {}, options = {}) {
  if (process.env.SOFTOTECH_AI_INGESTION_ENABLED === 'false') return undefined;
  const compactMetadata = compactPortalMetadata(metadata) || {};
  const eventId = options.eventId || compactMetadata.auditId || crypto.randomUUID();
  return publishIntelligenceEvent({
    eventId,
    eventType,
    source: 'softotech_project_portal',
    userId: actor.email || compactMetadata.clientEmail || compactMetadata.email || compactMetadata.projectId || 'softotech',
    timestamp: options.timestamp || compactMetadata.createdAt || new Date().toISOString(),
    metadata: {
      portal: 'Yenkasa-Soft-O-Tech Project Management',
      sourceSystem: 'softotech_project_portal',
      actorEmail: normalizeEmail(actor.email),
      actorRole: cleanText(actor.role || actor.userType),
      ...compactMetadata,
    },
  });
}

function docToObject(doc) {
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return normalizeValue({ id: doc.id, ...data, hasLogin: Boolean(data.passwordHash) });
}

function roleForEmail(email) {
  if (isPrivilegedAdminEmail(email)) {
    return { is_admin: true, role: 'senior_developer', userType: 'Senior Developer', teamRole: 'Senior Developer' };
  }
  return { is_admin: false, role: 'client', userType: 'Client', teamRole: 'Client' };
}

function roleKeyFromTeamRole(teamRole = 'Client') {
  return cleanText(teamRole).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'client';
}

function cleanText(value) {
  return String(value || '').trim();
}

function assignmentRole(value) {
  return validOrDefault(value, ASSIGNMENT_ROLES, '');
}

function userDisplayName(user = {}) {
  return cleanText(user.fullName || user.name || user.email || user.clientId || user.id);
}

function isTeamMember(client = {}) {
  const status = cleanText(client.status).toLowerCase();
  if (client.active === false || ['inactive', 'suspended', 'closed'].includes(status)) return false;
  if (client.is_admin) return true;
  const role = cleanText(client.teamRole || client.role || client.userType);
  return role && !/^client$/i.test(role);
}

function validOrDefault(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function nullableCleanText(payload = {}, field) {
  if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] === null) return null;
  return cleanText(payload[field]);
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

  const emailAccess = roleForEmail(client.email);
  const storedTeamRole = validOrDefault(client.teamRole || client.userType, TEAM_ROLES, 'Client');
  const access = emailAccess.is_admin
    ? emailAccess
    : { is_admin: false, role: roleKeyFromTeamRole(storedTeamRole), userType: storedTeamRole, teamRole: storedTeamRole };
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

async function listTeamMembers() {
  const [clients, assignments, projects, portfolio] = await Promise.all([
    db().collection(CLIENTS).limit(2000).get(),
    db().collection(TEAM_ASSIGNMENTS).limit(5000).get(),
    db().collection(PROJECTS).limit(2000).get(),
    portfolioContent.getContent().catch(() => ({ teamMembers: [] })),
  ]);
  const activeProjectIds = new Set(projects.docs
    .map(docToObject)
    .filter((project) => project && !['Completed', 'Suspended'].includes(project.status))
    .map((project) => project.projectId));
  const workloadByUser = new Map();
  assignments.docs.map(docToObject).forEach((assignment) => {
    if (!assignment || !activeProjectIds.has(assignment.projectId)) return;
    const userId = cleanText(assignment.userId);
    if (!userId) return;
    workloadByUser.set(userId, (workloadByUser.get(userId) || 0) + 1);
  });
  const clientItems = clients.docs
    .map(docToObject)
    .filter(Boolean)
    .filter(isTeamMember)
    .map((member) => {
      const userId = member.clientId || member.id || clientIdFromEmail(member.email);
      const activeProjects = workloadByUser.get(userId) || 0;
      const workloadPercent = Math.min(100, activeProjects * 25);
      return {
        ...member,
        id: userId,
        userId,
        role: member.teamRole || member.role || member.userType || 'Team Member',
        department: member.department || '',
        bio: member.bio || member.background || member.notes || '',
        skills: Array.isArray(member.skills) ? member.skills : [],
        linkedIn: member.linkedIn || member.linkedin || '',
        profilePhoto: member.photo || member.profilePhoto || member.avatarUrl || '',
        activeProjects,
        workloadPercent,
        availability: workloadPercent >= 100 ? 'Unavailable' : workloadPercent >= 75 ? 'Limited' : 'Available',
      };
    });
  const portfolioItems = (portfolio.teamMembers || []).map((member) => {
    const userId = member.id || requirementSlug(member.name);
    const activeProjects = workloadByUser.get(userId) || 0;
    const workloadPercent = Math.min(100, activeProjects * 25);
    return {
      id: userId,
      userId,
      clientId: userId,
      email: '',
      fullName: member.name,
      role: member.role || 'Team Member',
      teamRole: member.role || 'Team Member',
      department: member.department || '',
      status: member.status || (member.active === false ? 'Inactive' : 'Active Team Member'),
      active: member.active !== false,
      bio: member.bio || member.background || '',
      skills: Array.isArray(member.skills) ? member.skills : [],
      linkedIn: member.linkedIn || '',
      profilePhoto: member.photo || '/images/default.png',
      photo: member.photo || '/images/default.png',
      background: member.background || '',
      activeProjects,
      workloadPercent,
      availability: workloadPercent >= 100 ? 'Unavailable' : workloadPercent >= 75 ? 'Limited' : 'Available',
    };
  });
  const byId = new Map();
  const identityAliases = new Map();
  [...portfolioItems, ...clientItems].forEach((member) => {
    const nameIdentity = userDisplayName(member).toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
    const aliases = [
      member.email ? `email:${normalizeEmail(member.email)}` : '',
      nameIdentity ? `name:${nameIdentity}` : '',
      member.userId ? `id:${member.userId}` : '',
      member.id ? `id:${member.id}` : '',
      member.clientId ? `id:${member.clientId}` : '',
    ].filter(Boolean);
    const identity = aliases.map((alias) => identityAliases.get(alias)).find(Boolean) || aliases[0];
    if (!identity) return;
    const previous = byId.get(identity) || {};
    const merged = {
      ...previous,
      ...member,
      activeProjects: Math.max(Number(previous.activeProjects || 0), Number(member.activeProjects || 0)),
      workloadPercent: Math.max(Number(previous.workloadPercent || 0), Number(member.workloadPercent || 0)),
    };
    byId.set(identity, merged);
    aliases.forEach((alias) => identityAliases.set(alias, identity));
  });
  const items = Array.from(byId.values()).sort((a, b) => userDisplayName(a).localeCompare(userDisplayName(b)));
  return { items, total: items.length };
}

function teamMemberIndex(teamMembers = []) {
  const byKey = new Map();
  teamMembers.forEach((member) => {
    [member.userId, member.id, member.clientId, member.email, member.fullName].filter(Boolean).forEach((key) => {
      byKey.set(cleanText(key), member);
      byKey.set(cleanText(key).toLowerCase(), member);
    });
  });
  return byKey;
}

function resolveTeamMemberRefs(teamMembers = [], refs = [], label = 'team member') {
  const byKey = teamMemberIndex(teamMembers);
  const resolved = [];
  const seen = new Set();
  normalizeArray(refs).forEach((ref) => {
    const key = cleanText(ref);
    const member = byKey.get(key) || byKey.get(key.toLowerCase());
    if (!member) {
      const error = new Error(`Unknown ${label}: "${key}". Select a saved team member from the list.`);
      error.statusCode = 400;
      throw error;
    }
    const userId = member.userId || member.id || member.clientId;
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    resolved.push({ ...member, userId });
  });
  return resolved;
}

function hasPayloadField(payload = {}, field) {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

async function resolveProjectTeamPatch(payload = {}) {
  const hasManager = hasPayloadField(payload, 'projectManagerId') || hasPayloadField(payload, 'projectManagerUserId') || hasPayloadField(payload, 'projectManager');
  const hasDevelopers = hasPayloadField(payload, 'assignedDeveloperIds') || hasPayloadField(payload, 'assignedDevelopers');
  if (!hasManager && !hasDevelopers) return {};

  const { items } = await listTeamMembers();
  const patch = {};
  const managerSource = hasPayloadField(payload, 'projectManagerId')
    ? payload.projectManagerId
    : (hasPayloadField(payload, 'projectManagerUserId') ? payload.projectManagerUserId : payload.projectManager);
  const developerSource = hasPayloadField(payload, 'assignedDeveloperIds') ? payload.assignedDeveloperIds : payload.assignedDevelopers;

  if (hasManager && normalizeArray(managerSource).length) {
    const [manager] = resolveTeamMemberRefs(items, normalizeArray(managerSource).slice(0, 1), 'project manager');
    patch.projectManager = userDisplayName(manager);
    patch.projectManagerId = manager.userId;
  }
  if (hasDevelopers && normalizeArray(developerSource).length) {
    const developers = resolveTeamMemberRefs(items, developerSource, 'assigned developer');
    patch.assignedDeveloperIds = developers.map((member) => member.userId);
    patch.assignedDevelopers = developers.map(userDisplayName);
    patch.assignedTeam = developers.map((member) => `${member.role || member.teamRole || 'Developer'}: ${userDisplayName(member)}`);
  }
  return patch;
}

async function resolveSingleTeamMemberAssignment(payload = {}, existing = {}) {
  if (!hasPayloadField(payload, 'assignedUserId') && !hasPayloadField(payload, 'memberId')) return {};
  const selectedId = cleanText(payload.assignedUserId || payload.memberId);
  if (!selectedId) {
    return {
      assignedUserId: '',
      memberId: '',
      memberName: '',
      assignedDeveloper: '',
      assignedTeamMembers: [],
    };
  }
  const { items } = await listTeamMembers();
  const [member] = resolveTeamMemberRefs(items, [selectedId], 'assigned team member');
  const role = cleanText(payload.assignedRole || existing.assignedRole || member.role || member.teamRole || 'Developer');
  const memberName = userDisplayName(member);
  return {
    assignedUserId: member.userId,
    memberId: member.userId,
    memberName,
    assignedDeveloper: memberName,
    assignedRole: role,
    assignedTeamMembers: [{
      userId: member.userId,
      memberId: member.userId,
      fullName: memberName,
      memberName,
      email: normalizeEmail(member.email),
      role,
      profilePhoto: member.profilePhoto || member.photo || '',
    }],
  };
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
  const existingData = existing.exists ? existing.data() : {};
  const password = String(payload.password || '').trim();
  if (password && password.length < 8) {
    const error = new Error('Password must be at least 8 characters.');
    error.statusCode = 400;
    throw error;
  }
  const access = roleForEmail(email);
  const requestedTeamRole = validOrDefault(payload.teamRole || payload.userType || payload.role, TEAM_ROLES, existingData.teamRole || existingData.userType || 'Client');
  const effectiveAccess = access.is_admin
    ? access
    : { is_admin: false, role: roleKeyFromTeamRole(requestedTeamRole), userType: requestedTeamRole, teamRole: requestedTeamRole };
  let assignedProjectManager = cleanText(payload.assignedProjectManager || existingData.assignedProjectManager);
  let assignedProjectManagerId = cleanText(payload.assignedProjectManagerId || existingData.assignedProjectManagerId);
  if (payload.assignedProjectManager || payload.assignedProjectManagerId) {
    const managerRef = cleanText(payload.assignedProjectManagerId || payload.assignedProjectManager);
    if (managerRef) {
      const { items } = await listTeamMembers();
      const [manager] = resolveTeamMemberRefs(items, [managerRef], 'assigned project manager');
      assignedProjectManagerId = manager.userId;
      assignedProjectManager = userDisplayName(manager);
    }
  }
  const client = {
    ...existingData,
    clientId: ref.id,
    fullName: cleanText(payload.fullName || existingData.fullName),
    companyName: cleanText(payload.companyName || existingData.companyName),
    email,
    phoneNumber: cleanText(payload.phone || payload.phoneNumber || existingData.phoneNumber),
    country: cleanText(payload.country || existingData.country),
    address: cleanText(payload.address || existingData.address),
    registrationDate: existingData.registrationDate || now(),
    registeredAt: existingData.registeredAt || existingData.registrationDate || now(),
    status: validOrDefault(payload.status, CLIENT_STATUSES, 'Active'),
    assignedProjectManager,
    assignedProjectManagerId,
    notes: cleanText(payload.notes || existingData.notes),
    is_admin: effectiveAccess.is_admin,
    role: effectiveAccess.role,
    userType: effectiveAccess.userType,
    teamRole: effectiveAccess.teamRole,
    updatedAt: now(),
  };
  if (password) {
    client.passwordHash = await bcrypt.hash(password, 10);
    client.emailVerified = existingData.emailVerified || false;
  }
  await ref.set(client, { merge: true });
  await writeAudit(existing.exists ? 'client_updated' : 'client_created', actor, { clientId: ref.id, email, client });
  return normalizeValue({ id: ref.id, ...client });
}

async function updateClientStatus(clientId, status, actor = {}) {
  if (!CLIENT_STATUSES.includes(status)) {
    const error = new Error('Invalid client status.');
    error.statusCode = 400;
    throw error;
  }
  await db().collection(CLIENTS).doc(clientId).set({ status, updatedAt: now() }, { merge: true });
  await writeAudit('client_status_updated', actor, { clientId, status, client: await getClientById(clientId) });
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
  await writeAudit('lead_created', actor, { leadId, email: lead.email, lead });
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
  await writeAudit('lead_updated', actor, { leadId, status: update.status, lead: docToObject(await ref.get()) });
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
  await writeAudit('lead_converted_to_client', actor, { leadId, clientId: client.clientId || client.id, lead, client });
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

async function listRequirementsForClient(email, projects = []) {
  const direct = await listCollectionForClient(REQUIREMENTS, email).catch(() => []);
  const projectIds = new Set((projects || []).map((project) => project.projectId).filter(Boolean));
  if (!projectIds.size) return direct;
  const snapshot = await db().collection(REQUIREMENTS).limit(1000).get();
  const byProject = snapshot.docs
    .map(docToObject)
    .filter((item) => projectIds.has(item.projectId));
  const byId = new Map([...direct, ...byProject].map((item) => [item.requirementId || item.id, item]));
  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
  publishPortalIntelligenceEvent(entry.eventType, actor, { auditId, ...metadata, createdAt: entry.createdAt });
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
  const requirements = await listRequirementsForClient(client.email, projects);
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
    requirements,
    quotations,
    invoices,
    messages,
    documents,
    proposals,
    payments,
  };
}

async function adminDashboard() {
  const [clients, leads, requests, requestAnalytics, projects, requirements, assignments, teamMembers, quotations, invoices, messages, documents, proposals, payments, portfolio, auditLogs, pricingCategories, pricingItems, repositories, githubActivity] = await Promise.all([
    listClients({ limit: 1000, page: 1 }),
    listLeads({ limit: 1000, page: 1 }),
    projectRequestStore.list({ limit: 1000, page: 1 }),
    projectRequestStore.analytics(),
    db().collection(PROJECTS).limit(1000).get(),
    db().collection(REQUIREMENTS).limit(1000).get(),
    db().collection(TEAM_ASSIGNMENTS).limit(5000).get(),
    listTeamMembers(),
    db().collection(QUOTATIONS).limit(1000).get(),
    db().collection(INVOICES).limit(1000).get(),
    db().collection(MESSAGES).limit(1000).get(),
    db().collection(DOCUMENTS).limit(1000).get(),
    db().collection(PROPOSALS).limit(1000).get(),
    db().collection(PAYMENTS).limit(1000).get(),
    db().collection(PORTFOLIO_PROJECTS).limit(1000).get(),
    db().collection(AUDIT_LOGS).orderBy('createdAt', 'desc').limit(100).get(),
    pricing.listCategories({ includeInactive: true }),
    pricing.listPricingItems({ includeInactive: true }),
    db().collection(PROJECT_REPOSITORIES).limit(2000).get(),
    db().collection(GITHUB_ACTIVITY).limit(2000).get(),
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
    assignments: assignments.docs.map(docToObject),
    teamMembers: teamMembers.items,
    quotations: quotationItems,
    invoices: invoiceItems,
    messages: messages.docs.map(docToObject),
    documents: documents.docs.map(docToObject),
    proposals: proposals.docs.map(docToObject),
    payments: paymentItems,
    portfolioProjects: portfolio.docs.map(docToObject),
    auditLogs: auditLogs.docs.map(docToObject),
    pricingCategories,
    pricingItems,
    pricingReport,
    projectRepositories: repositories.docs.map(docToObject),
    githubActivity: githubActivity.docs.map(docToObject),
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
  const teamPatch = await resolveProjectTeamPatch(payload);
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
    assignedTeam: Array.isArray(teamPatch.assignedTeam) ? teamPatch.assignedTeam : (Array.isArray(payload.assignedTeam) ? payload.assignedTeam : []),
    projectManager: teamPatch.projectManager || String(payload.projectManager || '').trim(),
    projectManagerId: teamPatch.projectManagerId || String(payload.projectManagerId || '').trim(),
    assignedDevelopers: Array.isArray(teamPatch.assignedDevelopers) ? teamPatch.assignedDevelopers : (Array.isArray(payload.assignedDevelopers) ? payload.assignedDevelopers : []),
    assignedDeveloperIds: Array.isArray(teamPatch.assignedDeveloperIds) ? teamPatch.assignedDeveloperIds : (Array.isArray(payload.assignedDeveloperIds) ? payload.assignedDeveloperIds : []),
    teamAssignments: payload.teamAssignments && typeof payload.teamAssignments === 'object' ? payload.teamAssignments : {},
    assignmentStatus: String(payload.assignmentStatus || 'Pending Assignment').trim(),
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
  await writeAudit('project_created', { email: payload.actorEmail, role: 'admin' }, {
    projectId,
    clientEmail: project.clientEmail,
    project,
  });
  return normalizeValue(project);
}

async function updateProject(projectId, patch = {}, actor = {}) {
  const ref = db().collection(PROJECTS).doc(projectId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  const update = {};
  const stringFields = [
    'requestId',
    'clientEmail',
    'clientName',
    'clientId',
    'projectName',
    'projectType',
    'title',
    'description',
    'projectDescription',
    'projectManager',
    'riskLevel',
  ];
  for (const field of stringFields) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      update[field] = field === 'clientEmail' ? normalizeEmail(patch[field]) : cleanText(patch[field]);
    }
  }
  Object.assign(update, await resolveProjectTeamPatch(patch));
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    update.status = validOrDefault(patch.status, PROJECT_STATUSES, doc.data().status || 'Planning');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'amount') || Object.prototype.hasOwnProperty.call(patch, 'budget')) {
    update.budget = Number(patch.budget || patch.amount || 0);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'progress') || Object.prototype.hasOwnProperty.call(patch, 'progressPercentage')) {
    const progress = Math.max(0, Math.min(100, Number(patch.progress ?? patch.progressPercentage ?? 0)));
    update.progress = progress;
    update.progressPercentage = progress;
  }
  if (patch.deadline) update.deadline = new Date(patch.deadline);
  if (patch.startDate) update.startDate = new Date(patch.startDate);
  if (patch.endDate) update.endDate = new Date(patch.endDate);
  if (Array.isArray(patch.assignedDevelopers) && !Array.isArray(update.assignedDevelopers)) update.assignedDevelopers = patch.assignedDevelopers.map(cleanText).filter(Boolean);
  if (Array.isArray(patch.assignedTeam) && !Array.isArray(update.assignedTeam)) update.assignedTeam = patch.assignedTeam.map(cleanText).filter(Boolean);
  if (patch.teamAssignments && typeof patch.teamAssignments === 'object') update.teamAssignments = patch.teamAssignments;
  if (Object.prototype.hasOwnProperty.call(patch, 'assignmentStatus')) update.assignmentStatus = cleanText(patch.assignmentStatus || 'Pending Assignment');
  if (Array.isArray(patch.deliverables)) update.deliverables = patch.deliverables.map(cleanText).filter(Boolean);
  if (Array.isArray(patch.milestones)) update.milestones = patch.milestones;
  update.updatedAt = now();
  await ref.set(update, { merge: true });
  const updatedProject = docToObject(await ref.get());
  await writeAudit('project_updated', actor, { projectId, fields: Object.keys(update), update, project: updatedProject });
  return updatedProject;
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

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (!value) return [];
  return String(value).split(',').map(cleanText).filter(Boolean);
}

function requirementSlug(value) {
  return String(value || crypto.randomUUID())
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function requirementTemplate(name, category, options = {}) {
  return {
    requirementName: name,
    requirementTitle: name,
    category,
    priority: options.priority || 'Medium',
    description: options.description || `${name} implementation and validation.`,
    requirementDescription: options.description || `${name} implementation and validation.`,
    assignedRole: options.assignedRole || '',
    estimatedHours: Number(options.estimatedHours || 8),
    dependencies: options.dependencies || [],
    sourceKey: options.sourceKey || requirementSlug(`${category}-${name}`),
    originalRequestText: options.originalRequestText || '',
    priceListingItemRef: options.priceListingItemRef || '',
    estimatedCost: Number(options.estimatedCost || 0),
  };
}

function sourceRequirementEntries(request = {}) {
  const req = request.requirements || {};
  const entries = [];
  const addValues = (sourceType, values) => {
    normalizeArray(values).forEach((value) => {
      entries.push({ sourceType, sourceFeature: value, originalRequestText: value });
    });
  };

  addValues('featuresRequired', req.featuresRequired);
  addValues('pagesRequired', req.pagesRequired);
  addValues('platformsRequired', req.platformsRequired);

  const customText = cleanText(req.customFeatures);
  if (customText) {
    const hasStructuredSeparators = /[\n;]/.test(customText) || customText.split(',').every((part) => cleanText(part).split(/\s+/).length <= 5);
    const customEntries = hasStructuredSeparators
      ? customText.split(/[\n;,]+/).map(cleanText).filter(Boolean)
      : [customText];
    customEntries.forEach((value) => entries.push({
      sourceType: 'customFeatures',
      sourceFeature: value,
      originalRequestText: customText,
    }));
  }

  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.sourceType}:${entry.sourceFeature.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function requirementCategoryForSource(entry = {}) {
  if (entry.sourceType === 'pagesRequired') return 'Frontend / UI';
  if (entry.sourceType === 'platformsRequired') {
    return /^website$/i.test(entry.sourceFeature || '') ? 'Frontend / UI' : 'Functional';
  }
  return 'Functional';
}

function requirementPriorityForSource(entry = {}) {
  if (/login|registration|payment|wallet|security|role/i.test(entry.sourceFeature || '')) return 'Critical';
  if (/chat|video|call|dashboard|admin|mobile|ios|android/i.test(entry.sourceFeature || '')) return 'High';
  return 'Medium';
}

function approvalRequirementTemplatesFromRequest(request = {}, project = {}) {
  return sourceRequirementEntries(request).map((entry) => ({
    projectId: project.projectId,
    requestId: request.requestId || project.requestId || '',
    clientEmail: project.clientEmail,
    reporter: request.contact?.fullName || project.clientName || '',
    reporterEmail: request.contact?.email || project.clientEmail || '',
    requirementName: entry.sourceFeature,
    requirementTitle: entry.sourceFeature,
    requirementDescription: `${entry.sourceFeature} requirement from approved client request.`,
    description: `${entry.sourceFeature} requirement from approved client request.`,
    category: requirementCategoryForSource(entry),
    priority: requirementPriorityForSource(entry),
    status: 'Unassigned',
    progress: 0,
    assignedUserId: null,
    memberId: null,
    memberName: null,
    assignedDeveloper: null,
    assignedRole: '',
    assignedTeamMembers: [],
    tasks: [],
    sourceFeature: entry.sourceFeature,
    sourceType: entry.sourceType,
    sourceReferenceId: request.requestId || project.requestId || '',
    sourceKey: requirementSlug(`${entry.sourceType}-${entry.sourceFeature}`),
    originalRequestText: entry.originalRequestText || entry.sourceFeature,
    createdFromApproval: true,
    dueDate: project.deadline || project.endDate || null,
    estimatedHours: 0,
    estimatedCost: 0,
  }));
}

async function getProjectById(projectId) {
  if (!projectId) return null;
  const doc = await db().collection(PROJECTS).doc(projectId).get();
  return docToObject(doc);
}

async function getProjectAssignments(projectId) {
  if (!projectId) return [];
  const snapshot = await db().collection(TEAM_ASSIGNMENTS).where('projectId', '==', projectId).get();
  return snapshot.docs.map(docToObject).filter(Boolean).sort((a, b) => ASSIGNMENT_ROLES.indexOf(a.role) - ASSIGNMENT_ROLES.indexOf(b.role));
}

function groupAssignments(assignments = []) {
  return assignments.reduce((acc, assignment) => {
    const role = assignment.role || 'Team Member';
    acc[role] = acc[role] || [];
    acc[role].push(assignment);
    return acc;
  }, {});
}

function primaryRoleForRequirement(requirement = {}) {
  const role = cleanText(requirement.assignedRole);
  if (ASSIGNMENT_ROLES.includes(role)) return role;
  const category = cleanText(requirement.category);
  if (category === 'Frontend / UI') return 'Frontend Developer';
  if (category === 'Infrastructure') return 'DevOps Engineer';
  if (category === 'Security') return 'Backend Engineer';
  if (category === 'Database' || category === 'Backend / API' || category === 'Integrations' || category === 'Functional') return 'Backend Engineer';
  return 'Project Manager';
}

function assignmentForRole(grouped, role) {
  const direct = grouped[role] || [];
  if (direct.length) return direct[0];
  if (role === 'Backend Engineer' && grouped['DevOps Engineer']?.length) return grouped['DevOps Engineer'][0];
  if (role === 'Frontend Developer' && grouped['Backend Engineer']?.length) return grouped['Backend Engineer'][0];
  return grouped['Project Manager']?.[0] || null;
}

function ownershipForRequirement(requirement = {}, assignments = []) {
  const grouped = groupAssignments(assignments);
  const primaryRole = primaryRoleForRequirement(requirement);
  const primary = assignmentForRole(grouped, primaryRole);
  const team = [
    ...(grouped['Project Manager'] || []),
    ...(grouped['Frontend Developer'] || []),
    ...(grouped['Backend Engineer'] || []),
    ...(grouped['Mobile Developer'] || []),
    ...(grouped['QA Engineer'] || []),
    ...(grouped['DevOps Engineer'] || []),
  ];
  const unique = new Map();
  team.forEach((member) => {
    if (member?.userId) unique.set(`${member.role}:${member.userId}`, member);
  });
  return {
    primaryRole,
    primary,
    assignedTeamMembers: Array.from(unique.values()).map((member) => ({
      userId: member.userId,
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      profilePhoto: member.profilePhoto || '',
    })),
  };
}

function generatedTasksForRequirement(requirement = {}, assignments = []) {
  const ownership = ownershipForRequirement(requirement, assignments);
  const grouped = groupAssignments(assignments);
  const tasks = [];
  const addTask = (name, role, fallbackOwner) => {
    const owner = assignmentForRole(grouped, role) || fallbackOwner || ownership.primary;
    if (!owner) return;
    tasks.push({
      taskId: crypto.randomUUID(),
      projectId: requirement.projectId,
      requirementId: requirement.requirementId || '',
      taskName: name,
      role,
      assignedUserId: owner.userId,
      assignedTo: owner.fullName,
      assignedEmail: owner.email,
      status: 'Pending',
      progress: 0,
      dueDate: requirement.dueDate || null,
      createdAt: now(),
      updatedAt: now(),
    });
  };
  const name = requirement.requirementName || requirement.requirementTitle || 'Requirement';
  if (['Frontend / UI', 'Functional'].includes(requirement.category)) addTask(`${name} UI`, 'Frontend Developer');
  if (['Backend / API', 'Database', 'Functional', 'Integrations', 'Security'].includes(requirement.category)) addTask(`${name} API / Logic`, 'Backend Engineer');
  if (requirement.category === 'Infrastructure') addTask(`${name} Deployment`, 'DevOps Engineer');
  addTask(`${name} Testing`, 'QA Engineer', ownership.primary);
  return tasks;
}

function requirementTemplatesFromRequest(request = {}, project = {}) {
  const req = request.requirements || {};
  const objectives = request.objectives || {};
  const infra = request.infrastructure || {};
  const features = normalizeArray(req.featuresRequired);
  const integrations = normalizeArray(request.integrations);
  const platforms = normalizeArray(req.platformsRequired);
  const hostingOptions = normalizeArray(infra.hostingOptions);
  const sourceText = [
    request.overview?.projectDescription,
    objectives.problemToSolve,
    objectives.businessGoals,
    req.customFeatures,
    request.project?.additionalNotes,
  ].filter(Boolean).join('\n\n');
  const templates = new Map();
  const add = (template) => {
    const key = template.sourceKey || requirementSlug(template.requirementName);
    if (!templates.has(key)) templates.set(key, { ...template, sourceKey: key });
  };

  add(requirementTemplate('Database Design Module', 'Database', {
    priority: 'High',
    assignedRole: 'Backend Engineer',
    estimatedHours: 12,
    originalRequestText: sourceText,
  }));
  add(requirementTemplate('Deployment Module', 'Infrastructure', {
    priority: hostingOptions.length ? 'High' : 'Medium',
    assignedRole: 'DevOps Engineer',
    estimatedHours: 10,
    originalRequestText: hostingOptions.join(', ') || sourceText,
  }));

  const featureMap = {
    Login: ['Authentication Module', 'Functional', 'Critical', 'Backend Engineer', 10, 'User login and session handling.'],
    Registration: ['User Registration Module', 'Functional', 'Critical', 'Backend Engineer', 8, 'User account creation and validation.'],
    'Password Recovery': ['Password Recovery Module', 'Security', 'High', 'Backend Engineer', 6, 'Secure password reset workflow.'],
    'Social Login': ['Social Login Module', 'Integrations', 'Medium', 'Backend Engineer', 8, 'OAuth/social identity provider integration.'],
    Chat: ['Chat Module', 'Functional', 'High', 'Backend Engineer', 14, 'Realtime one-to-one chat workflow.'],
    'Group Chat': ['Group Chat Module', 'Functional', 'High', 'Backend Engineer', 14, 'Realtime group communication workflow.'],
    'Voice Calls': ['Voice Calling Module', 'Integrations', 'High', 'Mobile Developer', 16, 'Voice call integration and client controls.'],
    'Video Calls': ['Video Calling Module', 'Integrations', 'High', 'Mobile Developer', 18, 'Video call integration and call state handling.'],
    Posts: ['Content Posting Module', 'Functional', 'High', 'Backend Engineer', 12, 'Create and manage user posts.'],
    Comments: ['Comments Module', 'Functional', 'Medium', 'Backend Engineer', 8, 'Threaded or flat content comments.'],
    Likes: ['Reaction Module', 'Functional', 'Medium', 'Backend Engineer', 5, 'Like and reaction tracking.'],
    Shares: ['Sharing Module', 'Functional', 'Medium', 'Frontend Developer', 5, 'Content share actions and tracking.'],
    Notifications: ['Notification Module', 'Backend / API', 'High', 'Backend Engineer', 10, 'In-app and push notification workflow.'],
    Payments: ['Payment Integration Module', 'Integrations', 'Critical', 'Backend Engineer', 14, 'Payment checkout, verification, and transaction records.'],
    Wallet: ['Wallet Module', 'Functional', 'Critical', 'Backend Engineer', 16, 'User wallet, balances, and transaction ledger.'],
    'Subscription Plans': ['Subscription Module', 'Functional', 'High', 'Backend Engineer', 12, 'Recurring plan and entitlement management.'],
    Invoicing: ['Invoicing Module', 'Functional', 'High', 'Backend Engineer', 10, 'Invoice generation and payment status tracking.'],
    'Product Listings': ['Product Management Module', 'Functional', 'High', 'Backend Engineer', 12, 'Product listing, editing, and product metadata.'],
    'Shopping Cart': ['Shopping Cart Module', 'Functional', 'High', 'Frontend Developer', 10, 'Cart state, quantities, and checkout preparation.'],
    'Order Tracking': ['Order Tracking Module', 'Functional', 'High', 'Backend Engineer', 12, 'Order lifecycle and client order visibility.'],
    'Image Upload': ['Image Upload Module', 'Backend / API', 'Medium', 'Backend Engineer', 8, 'Image upload, validation, and storage.'],
    'Video Upload': ['Video Upload Module', 'Backend / API', 'High', 'Backend Engineer', 12, 'Video upload, validation, and storage.'],
    Livestreaming: ['Livestream Module', 'Integrations', 'Critical', 'Backend Engineer', 24, 'Live video streaming and session management.'],
    'AI Chatbot': ['AI Chatbot Module', 'Integrations', 'High', 'AI Developer', 16, 'AI chat workflow and knowledge integration.'],
    OCR: ['OCR Module', 'Integrations', 'High', 'AI Developer', 14, 'Document/image text extraction workflow.'],
    'Recommendation System': ['Recommendation Module', 'Functional', 'High', 'AI Developer', 18, 'Personalized recommendation logic.'],
    'AI Agent': ['AI Agent Module', 'Integrations', 'High', 'AI Developer', 20, 'Agent workflow and tool integration.'],
    Dashboard: ['Dashboard UI Module', 'Frontend / UI', 'High', 'Frontend Developer', 12, 'Admin/client dashboard user interface.'],
    Analytics: ['Analytics Module', 'Functional', 'High', 'Backend Engineer', 12, 'Metrics, reports, and dashboard data aggregation.'],
    'User Management': ['User Management Module', 'Functional', 'Critical', 'Backend Engineer', 12, 'Admin user management and account controls.'],
    'Role Management': ['RBAC Module', 'Security', 'Critical', 'Backend Engineer', 10, 'Role-based access control and permission checks.'],
  };

  features.forEach((feature) => {
    const mapped = featureMap[feature];
    if (mapped) {
      add(requirementTemplate(mapped[0], mapped[1], {
        priority: mapped[2],
        assignedRole: mapped[3],
        estimatedHours: mapped[4],
        description: mapped[5],
        originalRequestText: feature,
      }));
    } else {
      add(requirementTemplate(`${feature} Module`, 'Functional', {
        assignedRole: 'Backend Engineer',
        originalRequestText: feature,
      }));
    }
  });

  platforms.forEach((platform) => {
    const category = ['Website'].includes(platform) ? 'Frontend / UI' : 'Functional';
    add(requirementTemplate(`${platform} Platform Support`, category, {
      priority: 'High',
      assignedRole: platform === 'Website' ? 'Frontend Developer' : 'Mobile Developer',
      estimatedHours: platform === 'Website' ? 10 : 14,
      originalRequestText: platform,
    }));
  });

  integrations.forEach((integration) => {
    add(requirementTemplate(`${integration} Integration`, 'Integrations', {
      priority: ['Paystack', 'Stripe', 'Flutterwave', 'MTN MoMo'].includes(integration) ? 'Critical' : 'High',
      assignedRole: 'Backend Engineer',
      estimatedHours: 10,
      originalRequestText: integration,
      dependencies: ['Authentication Module'],
    }));
  });

  hostingOptions.forEach((option) => {
    add(requirementTemplate(`${option} Setup`, 'Infrastructure', {
      priority: 'High',
      assignedRole: 'DevOps Engineer',
      estimatedHours: 8,
      originalRequestText: option,
    }));
  });

  if (sourceText) {
    add(requirementTemplate('Project Objectives Validation', 'Functional', {
      priority: 'High',
      assignedRole: 'Project Manager',
      estimatedHours: 6,
      description: 'Validate project objectives, acceptance criteria, and delivery scope against the original request.',
      originalRequestText: sourceText,
    }));
  }

  return Array.from(templates.values()).map((template, index) => ({
    ...template,
    projectId: project.projectId,
    clientEmail: project.clientEmail,
    reporter: request.contact?.fullName || project.clientName || '',
    reporterEmail: request.contact?.email || project.clientEmail || '',
    dueDate: project.deadline || project.endDate || null,
    status: index < 2 ? 'Approved' : 'Submitted',
    progress: index < 2 ? 15 : 0,
    sourceType: 'Project Request Form',
    sourceReferenceId: request.requestId || project.requestId || '',
  }));
}

async function writeTasksForRequirement(requirement = {}, tasks = []) {
  const batch = db().batch();
  tasks.forEach((task) => {
    const taskId = task.taskId || crypto.randomUUID();
    batch.set(db().collection(TASKS).doc(taskId), { ...task, taskId }, { merge: true });
  });
  if (tasks.length) await batch.commit();
}

async function applyRequirementOwnership(projectId, assignments = [], actor = {}) {
  const result = await listRequirements({ projectId, limit: 500 });
  const updated = [];
  for (const requirement of result.items) {
    const ownership = ownershipForRequirement(requirement, assignments);
    const tasks = generatedTasksForRequirement(requirement, assignments);
    const patch = {
      assignedRole: ownership.primaryRole,
      assignedUserId: ownership.primary?.userId || requirement.assignedUserId || '',
      assignedDeveloper: ownership.primary?.fullName || requirement.assignedDeveloper || '',
      assignedTeamMembers: ownership.assignedTeamMembers,
      tasks,
      status: ['Unassigned', 'Submitted', 'Approved'].includes(requirement.status) ? 'Assigned' : requirement.status,
      updatedAt: now(),
    };
    await db().collection(REQUIREMENTS).doc(requirement.requirementId).set(patch, { merge: true });
    await writeTasksForRequirement({ ...requirement, ...patch }, tasks);
    updated.push(normalizeValue({ ...requirement, ...patch }));
  }
  if (updated.length) await writeAudit('requirement_ownership_applied', actor, { projectId, count: updated.length });
  return updated;
}

function assignmentInputs(payload = {}) {
  return [
    ['Project Manager', normalizeArray(payload.projectManager || payload.projectManagerId)],
    ['Frontend Developer', normalizeArray(payload.frontendTeam || payload.frontendDeveloper || payload.frontendDeveloperId)],
    ['Backend Engineer', normalizeArray(payload.backendTeam || payload.backendEngineer || payload.backendEngineerId)],
    ['Mobile Developer', normalizeArray(payload.mobileTeam || payload.mobileDeveloper || payload.mobileDeveloperId)],
    ['QA Engineer', normalizeArray(payload.qaTeam || payload.qaEngineer || payload.qaEngineerId)],
    ['DevOps Engineer', normalizeArray(payload.devopsTeam || payload.devopsEngineer || payload.devopsEngineerId)],
  ].flatMap(([role, ids]) => ids.map((userId) => ({ role, userId }))).filter((item) => item.userId);
}

async function saveProjectAssignments(projectId, payload = {}, actor = {}) {
  const project = await getProjectById(projectId);
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  const teamMembers = await listTeamMembers();
  const teamById = new Map(teamMembers.items.map((member) => [member.userId || member.id, member]));
  const rows = assignmentInputs(payload).map((entry) => {
    const member = teamById.get(entry.userId);
    if (!member) {
      const error = new Error(`Unknown team member: "${entry.userId}". Select a saved team member from the list.`);
      error.statusCode = 400;
      throw error;
    }
    return {
      id: `${projectId}_${requirementSlug(entry.role)}_${entry.userId}`,
      projectId,
      userId: entry.userId,
      memberId: entry.userId,
      role: entry.role,
      fullName: userDisplayName(member) || cleanText(entry.userId),
      memberName: userDisplayName(member) || cleanText(entry.userId),
      email: normalizeEmail(member.email),
      profilePhoto: member.profilePhoto || member.photo || '',
      assignedBy: normalizeEmail(actor.email),
      assignedAt: now(),
      updatedAt: now(),
    };
  });
  if (!rows.length) {
    const error = new Error('Select at least one team member before saving assignment.');
    error.statusCode = 400;
    throw error;
  }

  const existing = await getProjectAssignments(projectId);
  const batch = db().batch();
  existing.forEach((assignment) => batch.delete(db().collection(TEAM_ASSIGNMENTS).doc(assignment.id)));
  rows.forEach((assignment) => batch.set(db().collection(TEAM_ASSIGNMENTS).doc(assignment.id), assignment));
  await batch.commit();

  const grouped = groupAssignments(rows);
  const projectManager = grouped['Project Manager']?.[0]?.fullName || project.projectManager || '';
  const assignedDevelopers = rows.filter((item) => item.role !== 'Project Manager').map((item) => item.fullName);
  const assignedDeveloperIds = rows.filter((item) => item.role !== 'Project Manager').map((item) => item.userId);
  await updateProject(projectId, {
    projectManager,
    assignedDevelopers,
    assignedDeveloperIds,
    assignedTeam: rows.map((item) => `${item.role}: ${item.fullName}`),
    teamAssignments: groupAssignments(rows),
    assignmentStatus: 'Assigned',
  }, actor);

  const existingRequirements = await listRequirements({ projectId, limit: 500 });
  let requirements = [];
  if (existingRequirements.items.length) {
    requirements = await applyRequirementOwnership(projectId, rows, actor);
  } else {
    const request = project.requestId ? await projectRequestStore.getByRequestId(project.requestId) : null;
    if (request?.requestId) {
      await generateRequirementsForProject(project, request, actor, rows);
      requirements = await applyRequirementOwnership(projectId, rows, actor);
    }
  }
  await writeAudit('project_team_assigned', actor, {
    projectId,
    count: rows.length,
    assignments: rows,
    requirements: requirements.length,
  });
  return { project: await getProjectById(projectId), assignments: normalizeValue(rows), requirements };
}

function githubUserDocId(user = {}) {
  return cleanText(user.portalUserId || user.clientId || user.id || clientIdFromEmail(user.email || 'github-user'));
}

function githubConfig() {
  return {
    clientId: cleanText(process.env.GITHUB_CLIENT_ID || process.env.SOFTOTECH_GITHUB_CLIENT_ID),
    clientSecret: cleanText(process.env.GITHUB_CLIENT_SECRET || process.env.SOFTOTECH_GITHUB_CLIENT_SECRET),
    callbackUrl: cleanText(process.env.GITHUB_CALLBACK_URL || process.env.SOFTOTECH_GITHUB_CALLBACK_URL),
  };
}

function requireGithubConfig() {
  const config = githubConfig();
  if (!config.clientId || !config.clientSecret) {
    const error = new Error('GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
    error.statusCode = 500;
    throw error;
  }
  return config;
}

function githubCallbackUrl(fallbackOrigin = '') {
  const configured = githubConfig().callbackUrl;
  if (configured) return configured;
  const origin = cleanText(fallbackOrigin || process.env.SOFTOTECH_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || 'https://gcloud.yenkasa.xyz').replace(/\/+$/, '');
  return `${origin}/api/project-portal/admin/github/oauth/callback`;
}

function repositoryParts(fullName = '') {
  const [owner = '', repo = ''] = cleanText(fullName).split('/');
  return { owner: cleanText(owner), repo: cleanText(repo) };
}

async function githubConnection(user = {}) {
  const doc = await db().collection(GITHUB_CONNECTIONS).doc(githubUserDocId(user)).get();
  const connection = docToObject(doc);
  if (!connection) return { connected: false, status: 'Not Connected' };
  return {
    ...connection,
    connected: Boolean(connection.accessToken),
    status: connection.accessToken ? 'Connected' : 'Not Connected',
  };
}

async function createGitHubOAuthUrl(user = {}, { projectId = '', origin = '' } = {}) {
  const config = requireGithubConfig();
  const state = crypto.randomUUID();
  await db().collection(GITHUB_OAUTH_STATES).doc(state).set({
    state,
    userId: githubUserDocId(user),
    email: normalizeEmail(user.email),
    projectId: cleanText(projectId),
    createdAt: now(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: githubCallbackUrl(origin),
    scope: 'repo read:user user:email',
    state,
  });
  return { url: `https://github.com/login/oauth/authorize?${params.toString()}`, state };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch (error) { payload = { message: text }; }
  if (!response.ok) {
    const error = new Error(payload?.message || `GitHub request failed with ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function githubApi(user = {}, path = '', options = {}) {
  const connection = await githubConnection(user);
  if (!connection.connected) {
    const error = new Error('Connect GitHub before configuring repositories.');
    error.statusCode = 400;
    throw error;
  }
  return fetchJson(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      ...(options.headers || {}),
    },
  });
}

function githubApiError(error = {}) {
  return {
    status: 'error',
    statusCode: error.statusCode || 500,
    message: error.message || 'GitHub request failed.',
  };
}

async function githubSyncRequest(actor = {}, label = '', path = '', fallback) {
  try {
    const payload = await githubApi(actor, path);
    const count = Array.isArray(payload) ? payload.length : Array.isArray(payload?.workflow_runs) ? payload.workflow_runs.length : 0;
    return { label, path, status: 'ok', statusCode: 200, count, payload };
  } catch (error) {
    return { label, path, count: 0, payload: fallback, ...githubApiError(error) };
  }
}

function normalizedNameKey(value = '') {
  return cleanText(value).toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
}

function compactLogin(value = '') {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function githubMemberAliases(member = {}) {
  const githubFields = [
    member.githubUsername,
    member.gitHubUsername,
    member.githubLogin,
    member.gitHubLogin,
    member.github,
  ];
  const aliases = [];
  githubFields.filter(Boolean).forEach((value) => aliases.push(`login:${compactLogin(value)}`));
  if (member.email) aliases.push(`email:${normalizeEmail(member.email)}`);
  const displayName = userDisplayName(member);
  if (displayName) {
    aliases.push(`name:${normalizedNameKey(displayName)}`);
    aliases.push(`login:${compactLogin(displayName)}`);
  }
  return aliases.filter((alias) => !alias.endsWith(':'));
}

function githubTeamMemberIndex(teamMembers = []) {
  const index = new Map();
  teamMembers.forEach((member) => {
    githubMemberAliases(member).forEach((alias) => {
      if (!index.has(alias)) index.set(alias, member);
    });
  });
  return index;
}

function matchGitHubTeamMember(actor = {}, teamIndex = new Map()) {
  const aliases = [
    actor.username ? `login:${compactLogin(actor.username)}` : '',
    actor.email ? `email:${normalizeEmail(actor.email)}` : '',
    actor.name ? `name:${normalizedNameKey(actor.name)}` : '',
    actor.name ? `login:${compactLogin(actor.name)}` : '',
  ].filter(Boolean);
  return aliases.map((alias) => teamIndex.get(alias)).find(Boolean) || null;
}

function githubCommitSummary(commit = {}, detail = {}, teamIndex = new Map()) {
  const author = {
    username: cleanText(commit.author?.login || detail.author?.login),
    name: cleanText(commit.commit?.author?.name || detail.commit?.author?.name),
    email: normalizeEmail(commit.commit?.author?.email || detail.commit?.author?.email),
  };
  const teamMember = matchGitHubTeamMember(author, teamIndex);
  const stats = detail.stats || {};
  const files = Array.isArray(detail.files) ? detail.files : [];
  return {
    sha: commit.sha,
    repositoryCommitId: commit.sha,
    message: commit.commit?.message || detail.commit?.message || '',
    author: author.name || author.username || '',
    authorName: author.name,
    authorEmail: author.email,
    authorUsername: author.username,
    mappedUserId: teamMember?.userId || teamMember?.id || teamMember?.clientId || '',
    mappedDeveloper: teamMember ? userDisplayName(teamMember) : '',
    date: commit.commit?.author?.date || detail.commit?.author?.date || '',
    url: commit.html_url || detail.html_url || '',
    filesChanged: Number(stats.total !== undefined ? files.length : 0),
    linesAdded: Number(stats.additions || 0),
    linesRemoved: Number(stats.deletions || 0),
  };
}

function githubDeveloperActivity(commits = [], pullRequests = [], contributors = [], teamIndex = new Map()) {
  const byKey = new Map();
  function ensure(actor = {}) {
    const teamMember = matchGitHubTeamMember(actor, teamIndex);
    const key = teamMember?.userId || teamMember?.id || actor.username || actor.email || actor.name || 'unknown';
    const existing = byKey.get(key) || {
      userId: teamMember?.userId || teamMember?.id || '',
      developer: teamMember ? userDisplayName(teamMember) : cleanText(actor.name || actor.username || actor.email || 'Unmapped contributor'),
      githubUsername: cleanText(actor.username),
      email: normalizeEmail(actor.email),
      mapped: Boolean(teamMember),
      commits: 0,
      pullRequests: 0,
      linesAdded: 0,
      linesRemoved: 0,
      lastActivityAt: '',
    };
    byKey.set(key, existing);
    return existing;
  }
  commits.forEach((commit) => {
    const row = ensure({ username: commit.authorUsername, email: commit.authorEmail, name: commit.authorName || commit.author });
    row.commits += 1;
    row.linesAdded += Number(commit.linesAdded || 0);
    row.linesRemoved += Number(commit.linesRemoved || 0);
    if (commit.date && (!row.lastActivityAt || String(commit.date) > String(row.lastActivityAt))) row.lastActivityAt = commit.date;
  });
  pullRequests.forEach((pull) => {
    const row = ensure({ username: pull.author });
    row.pullRequests += 1;
    if (pull.updatedAt && (!row.lastActivityAt || String(pull.updatedAt) > String(row.lastActivityAt))) row.lastActivityAt = pull.updatedAt;
  });
  contributors.forEach((contributor) => {
    ensure({ username: contributor.username });
  });
  return Array.from(byKey.values()).sort((a, b) => (b.commits - a.commits) || a.developer.localeCompare(b.developer));
}

async function handleGitHubOAuthCallback({ code = '', state = '', origin = '' } = {}) {
  const config = requireGithubConfig();
  const stateDoc = await db().collection(GITHUB_OAUTH_STATES).doc(cleanText(state)).get();
  const stateData = docToObject(stateDoc);
  if (!code || !stateData?.userId) {
    const error = new Error('Invalid GitHub OAuth response.');
    error.statusCode = 400;
    throw error;
  }
  if (stateData.expiresAt && new Date(stateData.expiresAt).getTime() < Date.now()) {
    const error = new Error('GitHub OAuth session expired. Connect again.');
    error.statusCode = 400;
    throw error;
  }
  const token = await fetchJson('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: githubCallbackUrl(origin),
      state,
    }),
  });
  if (!token?.access_token) {
    const error = new Error(token?.error_description || token?.error || 'GitHub did not return an access token.');
    error.statusCode = 400;
    throw error;
  }
  const githubUser = await fetchJson('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const connection = {
    userId: stateData.userId,
    email: normalizeEmail(stateData.email),
    githubUserId: String(githubUser.id || ''),
    githubUsername: cleanText(githubUser.login),
    accessToken: token.access_token,
    refreshToken: token.refresh_token || '',
    scope: token.scope || '',
    tokenType: token.token_type || 'bearer',
    connectionDate: now(),
    updatedAt: now(),
  };
  await db().collection(GITHUB_CONNECTIONS).doc(stateData.userId).set(connection, { merge: true });
  await db().collection(GITHUB_OAUTH_STATES).doc(state).delete().catch(() => {});
  await writeAudit('github_connected', { email: stateData.email, role: 'admin' }, {
    projectId: stateData.projectId,
    githubUsername: connection.githubUsername,
    githubUserId: connection.githubUserId,
  });
  return normalizeValue({ ...connection, accessToken: undefined, refreshToken: undefined, connected: true });
}

async function listGitHubRepositories(user = {}) {
  const repos = await githubApi(user, '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
  return repos.map((repo) => ({
    id: String(repo.id),
    name: repo.name,
    fullName: repo.full_name,
    private: Boolean(repo.private),
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
  }));
}

async function listGitHubBranches(user = {}, fullName = '') {
  const { owner, repo } = repositoryParts(fullName);
  if (!owner || !repo) return [];
  const branches = await githubApi(user, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);
  return branches.map((branch) => ({ name: branch.name, protected: Boolean(branch.protected) }));
}

async function listGitHubFolders(user = {}, { repository = '', branch = '' } = {}) {
  const { owner, repo } = repositoryParts(repository);
  if (!owner || !repo || !branch) return [];
  const entries = await githubApi(user, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(branch)}`);
  return entries
    .filter((entry) => entry.type === 'dir')
    .map((entry) => ({ name: entry.name, path: `/${entry.path}` }));
}

async function listProjectRepositoryMappings(projectId = '') {
  if (!projectId) return [];
  const snapshot = await db().collection(PROJECT_REPOSITORIES).where('projectId', '==', cleanText(projectId)).limit(100).get();
  return snapshot.docs.map(docToObject).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

async function getProjectRepositoryMapping(mappingId = '') {
  if (!mappingId) return null;
  const doc = await db().collection(PROJECT_REPOSITORIES).doc(mappingId).get();
  return docToObject(doc);
}

async function saveProjectRepositoryMapping(projectId, payload = {}, actor = {}) {
  const project = await getProjectById(projectId);
  if (!project) {
    const error = new Error('Project not found.');
    error.statusCode = 404;
    throw error;
  }
  const repository = cleanText(payload.repository || payload.repositoryFullName);
  const branch = cleanText(payload.branch);
  const folderType = cleanText(payload.folderType);
  const folder = cleanText(payload.folder || payload.repositoryFolder).replace(/^\/?/, '/');
  if (!repository || !branch || !folderType || !folder) {
    const error = new Error('Project, repository, branch, folder type, and folder are required.');
    error.statusCode = 400;
    throw error;
  }
  const id = cleanText(payload.mappingId) || crypto.randomUUID();
  const { owner, repo } = repositoryParts(repository);
  const mapping = {
    id,
    mappingId: id,
    projectId,
    projectName: project.title || project.projectName || projectId,
    repository,
    repositoryOwner: owner,
    repositoryName: repo,
    branch,
    folderType,
    folder,
    status: 'Connected',
    connectedBy: normalizeEmail(actor.email),
    createdAt: payload.mappingId ? payload.createdAt || now() : now(),
    updatedAt: now(),
  };
  await db().collection(PROJECT_REPOSITORIES).doc(id).set(mapping, { merge: true });
  await writeAudit('project_repository_mapped', actor, { projectId, mapping });
  return normalizeValue(mapping);
}

async function removeProjectRepositoryMapping(mappingId, actor = {}) {
  const mapping = await getProjectRepositoryMapping(mappingId);
  if (!mapping) return { removed: true };
  await db().collection(PROJECT_REPOSITORIES).doc(mappingId).delete();
  await writeAudit('project_repository_removed', actor, { projectId: mapping.projectId, mappingId, repository: mapping.repository });
  return { removed: true };
}

async function syncProjectRepositoryMapping(mappingId, actor = {}) {
  const mapping = await getProjectRepositoryMapping(mappingId);
  if (!mapping) {
    const error = new Error('Repository mapping not found.');
    error.statusCode = 404;
    throw error;
  }
  const path = mapping.folder && mapping.folder !== '/' ? mapping.folder.replace(/^\/+/, '') : '';
  const branch = mapping.branch;
  const repoPath = `/repos/${encodeURIComponent(mapping.repositoryOwner)}/${encodeURIComponent(mapping.repositoryName)}`;
  const commitPathQuery = path ? `&path=${encodeURIComponent(path)}` : '';
  const startedAt = now();
  const encodedContentPath = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const [commitResult, pullResult, contributorResult, workflowResult, teamMembers] = await Promise.all([
    githubSyncRequest(actor, 'Recent commits', `${repoPath}/commits?sha=${encodeURIComponent(branch)}${commitPathQuery}&per_page=20`, []),
    githubSyncRequest(actor, 'Recent pull requests', `${repoPath}/pulls?state=all&base=${encodeURIComponent(branch)}&per_page=20`, []),
    githubSyncRequest(actor, 'Contributors', `${repoPath}/contributors?per_page=20`, []),
    githubSyncRequest(actor, 'Workflow runs', `${repoPath}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=20`, { workflow_runs: [] }),
    listTeamMembers().catch(() => ({ items: [] })),
  ]);
  const rawCommits = Array.isArray(commitResult.payload) ? commitResult.payload : [];
  const [folderCheckResult, branchCommitCheckResult] = path && rawCommits.length === 0 && commitResult.status === 'ok'
    ? await Promise.all([
      githubSyncRequest(actor, 'Tracked folder exists', `${repoPath}/contents/${encodedContentPath}?ref=${encodeURIComponent(branch)}`, null),
      githubSyncRequest(actor, 'Branch commits without folder filter', `${repoPath}/commits?sha=${encodeURIComponent(branch)}&per_page=1`, []),
    ])
    : [
      { label: 'Tracked folder exists', path: '', status: 'skipped', statusCode: 0, count: 0, message: '' },
      { label: 'Branch commits without folder filter', path: '', status: 'skipped', statusCode: 0, count: 0, message: '' },
    ];
  const commitDetails = await Promise.all(rawCommits.map((commit) => {
    if (!commit.sha) return Promise.resolve({ status: 'missing_sha', payload: {} });
    return githubSyncRequest(actor, `Commit ${commit.sha}`, `${repoPath}/commits/${encodeURIComponent(commit.sha)}`, {});
  }));
  const teamIndex = githubTeamMemberIndex(teamMembers.items || []);
  const commits = rawCommits.map((commit, index) => githubCommitSummary(commit, commitDetails[index]?.payload || {}, teamIndex));
  const pulls = Array.isArray(pullResult.payload) ? pullResult.payload : [];
  const contributors = Array.isArray(contributorResult.payload) ? contributorResult.payload : [];
  const workflowRuns = workflowResult.payload || { workflow_runs: [] };
  const pullRequests = pulls.map((pull) => ({
    id: String(pull.id),
    number: pull.number,
    title: pull.title,
    state: pull.state,
    author: pull.user?.login || '',
    updatedAt: pull.updated_at,
    url: pull.html_url,
  }));
  const contributorRows = contributors.map((contributor) => {
    const teamMember = matchGitHubTeamMember({ username: contributor.login }, teamIndex);
    return {
      username: contributor.login,
      contributions: contributor.contributions,
      avatarUrl: contributor.avatar_url,
      url: contributor.html_url,
      mappedUserId: teamMember?.userId || teamMember?.id || '',
      mappedDeveloper: teamMember ? userDisplayName(teamMember) : '',
    };
  });
  const apiChecks = [
    commitResult,
    pullResult,
    contributorResult,
    workflowResult,
    folderCheckResult,
    branchCommitCheckResult,
    ...commitDetails.filter((result) => result.status === 'error').slice(0, 5),
  ].filter((result) => result.status !== 'skipped').map((result) => ({
    label: result.label,
    path: result.path,
    status: result.status,
    statusCode: result.statusCode,
    count: result.count,
    message: result.message || '',
  }));
  const failedChecks = apiChecks.filter((check) => check.status !== 'ok');
  const pathHasNoCommits = path && commitResult.status === 'ok' && rawCommits.length === 0 && branchCommitCheckResult.count > 0;
  const folderMissing = path && folderCheckResult.status === 'error';
  const warnings = [
    pathHasNoCommits ? `No commits were returned for folder "${path}", but branch "${branch}" has commits without that folder filter.` : '',
    folderMissing ? `Tracked folder "${path}" was not found on branch "${branch}".` : '',
  ].filter(Boolean);
  const unmappedContributors = Array.from(new Set([
    ...commits.filter((commit) => !commit.mappedUserId).map((commit) => commit.authorUsername || commit.authorName || commit.authorEmail || commit.author),
    ...contributorRows.filter((contributor) => !contributor.mappedUserId).map((contributor) => contributor.username),
  ].filter(Boolean)));
  const syncStatus = failedChecks.length ? 'Sync Failed' : warnings.length ? 'Needs Mapping Review' : 'Synced';
  const activity = {
    id: mappingId,
    mappingId,
    projectId: mapping.projectId,
    repository: mapping.repository,
    repositoryOwner: mapping.repositoryOwner,
    repositoryName: mapping.repositoryName,
    branch,
    folder: mapping.folder,
    folderPath: path,
    status: syncStatus,
    syncedAt: now(),
    commits,
    pullRequests,
    contributors: contributorRows,
    builds: (workflowRuns.workflow_runs || []).map((run) => ({
      id: String(run.id),
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.head_branch,
      updatedAt: run.updated_at,
      url: run.html_url,
    })),
    tests: [],
    codeQuality: [],
    developerActivity: githubDeveloperActivity(commits, pullRequests, contributorRows, teamIndex),
    metrics: {
      commitsRetrieved: commits.length,
      pullRequestsRetrieved: pullRequests.length,
      contributorsRetrieved: contributorRows.length,
      buildsRetrieved: (workflowRuns.workflow_runs || []).length,
      filesChanged: commits.reduce((sum, commit) => sum + Number(commit.filesChanged || 0), 0),
      linesAdded: commits.reduce((sum, commit) => sum + Number(commit.linesAdded || 0), 0),
      linesRemoved: commits.reduce((sum, commit) => sum + Number(commit.linesRemoved || 0), 0),
      mappedContributors: contributorRows.filter((contributor) => contributor.mappedUserId).length,
      unmappedContributors: unmappedContributors.length,
    },
    diagnostics: {
      repositoryStatus: syncStatus,
      startedAt,
      completedAt: now(),
      lastSyncTime: now(),
      lastCommitRetrieved: commits[0]?.date || '',
      repository: mapping.repository,
      repositoryOwner: mapping.repositoryOwner,
      repositoryName: mapping.repositoryName,
      branchBeingTracked: branch,
      folderBeingTracked: mapping.folder,
      githubApiStatus: failedChecks.length ? 'Error' : 'OK',
      apiChecks,
      errors: failedChecks,
      warnings,
      unmappedContributors,
    },
  };
  await db().collection(GITHUB_ACTIVITY).doc(mappingId).set(activity, { merge: true });
  await db().collection(PROJECT_REPOSITORIES).doc(mappingId).set({
    status: syncStatus,
    lastSyncedAt: now(),
    lastSyncStatus: syncStatus,
    lastSyncError: failedChecks[0]?.message || warnings[0] || '',
    lastCommitRetrievedAt: commits[0]?.date || '',
    updatedAt: now(),
  }, { merge: true });
  await writeAudit('project_repository_synced', actor, {
    projectId: mapping.projectId,
    mappingId,
    repository: mapping.repository,
    status: syncStatus,
    metrics: activity.metrics,
    errors: failedChecks,
  });
  return normalizeValue(activity);
}

async function listProjectGitHubActivity(projectId = '') {
  if (!projectId) return [];
  const snapshot = await db().collection(GITHUB_ACTIVITY).where('projectId', '==', cleanText(projectId)).limit(100).get();
  return snapshot.docs.map(docToObject);
}

async function generateRequirementsForProject(project = {}, request = {}, actor = {}, providedAssignments = null) {
  if (!project.projectId || !request?.requestId) return [];
  const existing = await listRequirements({ projectId: project.projectId, limit: 500 });
  if (existing.items.length) return existing.items;
  const templates = approvalRequirementTemplatesFromRequest(request, project);
  const created = [];
  for (const template of templates) {
    const requirement = await createRequirement({
      ...template,
      status: 'Unassigned',
      progress: 0,
      assignedUserId: null,
      memberId: null,
      memberName: null,
      assignedDeveloper: null,
      assignedTeamMembers: [],
      tasks: [],
    }, actor);
    created.push(requirement);
  }
  await writeAudit('requirements_generated', actor, { projectId: project.projectId, requestId: request.requestId, count: created.length, requirements: created });
  return created;
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
  const request = payload.requestId ? await projectRequestStore.getByRequestId(payload.requestId) : null;
  const project = await createProject({
    requestId: payload.requestId,
    clientEmail: payload.clientEmail || request?.contact?.email,
    clientName: payload.clientName || request?.contact?.fullName || request?.contact?.companyName,
    title: payload.title || payload.projectName || request?.overview?.projectName || request?.requirements?.projectType || 'Approved Project',
    description: payload.description || request?.overview?.projectDescription || '',
    projectType: payload.projectType || request?.requirements?.projectType || request?.requirements?.websiteType || '',
    projectManagerId: payload.projectManagerId || payload.projectManager || '',
    assignedDeveloperIds: payload.assignedDeveloperIds || payload.assignedDevelopers || [],
    deadline: payload.deadline || request?.timeline?.desiredCompletionDate || request?.project?.desiredCompletionDate || null,
    amount: payload.amount || request?.pricingEstimate?.grandTotal || 0,
    status: 'Planning',
    actorEmail: actor.email,
  });
  if (request?.requestId) {
    await projectRequestStore.updateStatus(request.requestId, 'Converted To Project', actor.email).catch((error) => {
      console.warn('[SoftOTechPortal] request status update failed:', error.message);
    });
    project.generatedRequirements = await generateRequirementsForProject(project, request, actor).catch((error) => {
      console.warn('[SoftOTechPortal] requirement generation failed:', error.message);
      return [];
    });
  }
  await writeAudit('project_request_approved', actor, { requestId: payload.requestId, projectId: project.projectId, project, request });
  return project;
}

async function migrateApprovedProjectRequirements({ dryRun = false, limit = 2000 } = {}, actor = {}) {
  const projectSnapshot = await db().collection(PROJECTS).limit(Number(limit || 2000)).get();
  const projects = projectSnapshot.docs.map(docToObject).filter(Boolean);
  const result = {
    dryRun: Boolean(dryRun),
    scanned: projects.length,
    migrated: 0,
    skippedExistingRequirements: 0,
    skippedMissingRequest: 0,
    createdRequirements: 0,
    projects: [],
  };

  for (const project of projects) {
    if (!project.requestId) {
      result.skippedMissingRequest += 1;
      continue;
    }

    const existing = await listRequirements({ projectId: project.projectId, limit: 1 });
    if (existing.items.length) {
      result.skippedExistingRequirements += 1;
      continue;
    }

    const request = await projectRequestStore.getByRequestId(project.requestId).catch(() => null);
    if (!request?.requestId) {
      result.skippedMissingRequest += 1;
      continue;
    }

    const templates = approvalRequirementTemplatesFromRequest(request, project);
    const projectResult = {
      projectId: project.projectId,
      requestId: request.requestId,
      requirementCount: templates.length,
    };
    result.projects.push(projectResult);
    if (dryRun) continue;

    const created = await generateRequirementsForProject(project, request, actor);
    result.migrated += 1;
    result.createdRequirements += created.length;
    await writeAudit('approved_project_requirements_migrated', actor, {
      projectId: project.projectId,
      requestId: request.requestId,
      requirementCount: created.length,
      source: 'approval_requirements_migration',
    });
  }

  if (!dryRun) {
    await writeAudit('approved_project_requirements_migration_completed', actor, result);
  }
  return result;
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
  await writeAudit('quotation_sent', { email: payload.actorEmail, role: 'admin' }, { quotationId, clientEmail: quotation.clientEmail, quotation });
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
  await writeAudit('proposal_generated', actor, { proposalId, clientEmail: proposal.clientEmail, proposal });
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
  await writeAudit('quotation_response', { email: clientEmail, role: 'client' }, { quotationId, status, quotation: docToObject(await ref.get()) });
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
  await writeAudit('invoice_created', { email: payload.actorEmail, role: 'admin' }, { invoiceNumber, clientEmail: invoice.clientEmail, invoice });
  return normalizeValue(invoice);
}

async function recordPayment(payload = {}, actor = {}) {
  const paymentId = await nextBusinessId('YSPAY');
  const receiptFile = payload.receiptFile && typeof payload.receiptFile === 'object' ? payload.receiptFile : null;
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
    receiptFile,
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
  await writeAudit('payment_recorded', actor, { paymentId, clientEmail: payment.clientEmail, amount: payment.amount, payment });
  return normalizeValue(payment);
}

async function uploadPaymentReceipt(file, payload = {}, actor = {}) {
  const result = await mediaStorage.upload(file, {
    folder: 'project-payment-receipts',
    prefix: `${Date.now()}-${payload.projectId || payload.clientEmail || 'payment'}`,
    type: 'file',
    area: 'softotech-payments',
  });
  return normalizeValue({
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    provider: result.provider || '',
    bucket: result.bucket || '',
    key: result.key || result.public_id || '',
    url: result.secure_url || result.url,
    uploadedBy: normalizeEmail(actor.email),
    uploadedAt: now(),
  });
}

async function createRequirement(payload = {}, actor = {}) {
  const requirementId = await nextBusinessId('YSR');
  const estimatedHours = Number(payload.estimatedHours || 0);
  const actualHours = Number(payload.actualHours || 0);
  const progress = Math.max(0, Math.min(100, Number(payload.progress || 0)));
  const resolvedAssignment = await resolveSingleTeamMemberAssignment(payload);
  const assignedTeamMembers = Array.isArray(resolvedAssignment.assignedTeamMembers)
    ? resolvedAssignment.assignedTeamMembers
    : (Array.isArray(payload.assignedTeamMembers) ? payload.assignedTeamMembers : []);
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const requirement = {
    requirementId,
    projectId: cleanText(payload.projectId),
    requestId: cleanText(payload.requestId || payload.sourceReferenceId),
    requirementName: cleanText(payload.requirementName || payload.requirementTitle || payload.title),
    requirementTitle: cleanText(payload.requirementTitle || payload.requirementName || payload.title),
    requirementDescription: cleanText(payload.requirementDescription || payload.description),
    description: cleanText(payload.description || payload.requirementDescription),
    category: validOrDefault(payload.category, REQUIREMENT_CATEGORIES, 'Functional'),
    priority: validOrDefault(payload.priority, REQUIREMENT_PRIORITIES, 'Medium'),
    status: validOrDefault(payload.status, REQUIREMENT_STATUSES, 'Submitted'),
    approved: Boolean(payload.approved || false),
    completed: Boolean(payload.completed || false),
    assignedUserId: resolvedAssignment.assignedUserId || nullableCleanText(payload, 'assignedUserId'),
    memberId: resolvedAssignment.memberId || (Object.prototype.hasOwnProperty.call(payload, 'memberId') ? nullableCleanText(payload, 'memberId') : nullableCleanText(payload, 'assignedUserId')),
    memberName: resolvedAssignment.memberName || (Object.prototype.hasOwnProperty.call(payload, 'memberName') ? nullableCleanText(payload, 'memberName') : cleanText(payload.assignedDeveloper || payload.assignedTo)),
    role: resolvedAssignment.assignedRole || cleanText(payload.role || payload.assignedRole),
    assignedDeveloper: resolvedAssignment.assignedDeveloper || (Object.prototype.hasOwnProperty.call(payload, 'assignedDeveloper') ? nullableCleanText(payload, 'assignedDeveloper') : cleanText(payload.assignedTo)),
    assignedRole: resolvedAssignment.assignedRole || cleanText(payload.assignedRole),
    assignedTeamMembers,
    reporter: cleanText(payload.reporter || actor.email),
    reporterEmail: normalizeEmail(payload.reporterEmail || actor.email),
    estimatedHours,
    actualHours,
    remainingHours: Math.max(estimatedHours - actualHours, 0),
    dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
    dependencies: normalizeArray(payload.dependencies),
    progress,
    sourceType: cleanText(payload.sourceType || 'Manual'),
    sourceReferenceId: cleanText(payload.sourceReferenceId),
    sourceKey: cleanText(payload.sourceKey),
    sourceFeature: cleanText(payload.sourceFeature),
    createdFromApproval: Boolean(payload.createdFromApproval),
    originalRequestText: cleanText(payload.originalRequestText),
    estimatedCost: Number(payload.estimatedCost || 0),
    actualCost: Number(payload.actualCost || 0),
    additionalCost: Number(payload.additionalCost || 0),
    priceListingItemRef: cleanText(payload.priceListingItemRef),
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    comments: Array.isArray(payload.comments) ? payload.comments : [],
    activityHistory: [{ action: 'created', actorEmail: normalizeEmail(actor.email), actorRole: cleanText(actor.role || actor.userType), timestamp: now() }],
    changeRequests: Array.isArray(payload.changeRequests) ? payload.changeRequests : [],
    tasks,
    createdBy: cleanText(payload.createdBy || actor.email),
    createdAt: now(),
    updatedAt: now(),
  };
  await db().collection(REQUIREMENTS).doc(requirementId).set(requirement);
  await writeAudit('requirement_created', actor, { requirementId, projectId: requirement.projectId, requirement });
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
  const resolvedAssignment = await resolveSingleTeamMemberAssignment(patch, doc.data());
  const update = {
    ...(patch.requirementTitle !== undefined ? { requirementTitle: cleanText(patch.requirementTitle) } : {}),
    ...(patch.requirementName !== undefined ? { requirementName: cleanText(patch.requirementName) } : {}),
    ...(patch.requirementDescription !== undefined ? { requirementDescription: cleanText(patch.requirementDescription) } : {}),
    ...(patch.description !== undefined ? { description: cleanText(patch.description) } : {}),
    ...(patch.category !== undefined ? { category: validOrDefault(patch.category, REQUIREMENT_CATEGORIES, doc.data().category || 'Functional') } : {}),
    ...(patch.priority !== undefined ? { priority: validOrDefault(patch.priority, REQUIREMENT_PRIORITIES, doc.data().priority || 'Medium') } : {}),
    ...(patch.status !== undefined ? { status: validOrDefault(patch.status, REQUIREMENT_STATUSES, doc.data().status || 'Submitted') } : {}),
    ...(patch.approved !== undefined ? { approved: Boolean(patch.approved) } : {}),
    ...(patch.completed !== undefined ? { completed: Boolean(patch.completed) } : {}),
    ...(patch.assignedUserId !== undefined || patch.memberId !== undefined ? { assignedUserId: cleanText(patch.assignedUserId || patch.memberId) } : {}),
    ...(patch.memberId !== undefined || patch.assignedUserId !== undefined ? { memberId: cleanText(patch.memberId || patch.assignedUserId) } : {}),
    ...(patch.memberName !== undefined ? { memberName: cleanText(patch.memberName) } : {}),
    ...(patch.assignedDeveloper !== undefined || patch.assignedTo !== undefined ? { assignedDeveloper: cleanText(patch.assignedDeveloper || patch.assignedTo) } : {}),
    ...(patch.role !== undefined ? { role: cleanText(patch.role) } : {}),
    ...(patch.assignedRole !== undefined ? { assignedRole: cleanText(patch.assignedRole) } : {}),
    ...(patch.assignedTeamMembers !== undefined ? { assignedTeamMembers: Array.isArray(patch.assignedTeamMembers) ? patch.assignedTeamMembers : [] } : {}),
    ...(patch.tasks !== undefined ? { tasks: Array.isArray(patch.tasks) ? patch.tasks : [] } : {}),
    ...(patch.reporter !== undefined ? { reporter: cleanText(patch.reporter) } : {}),
    ...(patch.estimatedHours !== undefined ? { estimatedHours: Number(patch.estimatedHours || 0) } : {}),
    ...(patch.actualHours !== undefined ? { actualHours: Number(patch.actualHours || 0) } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? new Date(patch.dueDate) : null } : {}),
    ...(patch.dependencies !== undefined ? { dependencies: normalizeArray(patch.dependencies) } : {}),
    ...(patch.progress !== undefined ? { progress: Math.max(0, Math.min(100, Number(patch.progress || 0))) } : {}),
    ...(patch.sourceType !== undefined ? { sourceType: cleanText(patch.sourceType) } : {}),
    ...(patch.originalRequestText !== undefined ? { originalRequestText: cleanText(patch.originalRequestText) } : {}),
    ...(patch.estimatedCost !== undefined ? { estimatedCost: Number(patch.estimatedCost || 0) } : {}),
    ...(patch.actualCost !== undefined ? { actualCost: Number(patch.actualCost || 0) } : {}),
    ...(patch.additionalCost !== undefined ? { additionalCost: Number(patch.additionalCost || 0) } : {}),
    ...(patch.priceListingItemRef !== undefined ? { priceListingItemRef: cleanText(patch.priceListingItemRef) } : {}),
    updatedAt: now(),
  };
  Object.assign(update, resolvedAssignment);
  if (update.estimatedHours !== undefined || update.actualHours !== undefined) {
    const estimated = update.estimatedHours ?? Number(doc.data().estimatedHours || 0);
    const actual = update.actualHours ?? Number(doc.data().actualHours || 0);
    update.remainingHours = Math.max(estimated - actual, 0);
  }
  const activityHistory = Array.isArray(doc.data().activityHistory) ? doc.data().activityHistory : [];
  update.activityHistory = [...activityHistory, { action: 'updated', actorEmail: normalizeEmail(actor.email), actorRole: cleanText(actor.role || actor.userType), timestamp: now(), patch: Object.keys(update).filter((key) => key !== 'activityHistory') }].slice(-100);
  await ref.set(update, { merge: true });
  const updatedRequirement = docToObject(await ref.get());
  await writeAudit('requirement_updated', actor, { requirementId, update, requirement: updatedRequirement });
  return updatedRequirement;
}

async function addRequirementComment(requirementId, payload = {}, actor = {}) {
  const ref = db().collection(REQUIREMENTS).doc(requirementId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Requirement not found.');
    error.statusCode = 404;
    throw error;
  }
  const comment = {
    commentId: crypto.randomUUID(),
    body: cleanText(payload.body || payload.comment),
    authorEmail: normalizeEmail(actor.email || payload.authorEmail),
    authorName: cleanText(payload.authorName || actor.email),
    role: cleanText(actor.role || actor.userType || payload.role),
    createdAt: now(),
  };
  const comments = [...(Array.isArray(doc.data().comments) ? doc.data().comments : []), comment].slice(-200);
  const activityHistory = [...(Array.isArray(doc.data().activityHistory) ? doc.data().activityHistory : []), {
    action: 'comment_added',
    actorEmail: comment.authorEmail,
    actorRole: comment.role,
    timestamp: now(),
  }].slice(-100);
  await ref.set({ comments, activityHistory, updatedAt: now() }, { merge: true });
  await writeAudit('requirement_comment_added', actor, { requirementId, commentId: comment.commentId, comment, requirement: docToObject(await ref.get()) });
  return docToObject(await ref.get());
}

async function createRequirementChangeRequest(requirementId, payload = {}, actor = {}) {
  const ref = db().collection(REQUIREMENTS).doc(requirementId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Requirement not found.');
    error.statusCode = 404;
    throw error;
  }
  const changeRequest = {
    changeRequestId: await nextBusinessId('YSCR'),
    requirementId,
    description: cleanText(payload.description),
    costImpact: Number(payload.costImpact || 0),
    timeImpact: Number(payload.timeImpact || 0),
    additionalDaysRequired: Number(payload.additionalDaysRequired || payload.timeImpact || 0),
    approvalStatus: validOrDefault(payload.approvalStatus || payload.status, CHANGE_REQUEST_STATUSES, 'Pending'),
    requestedBy: normalizeEmail(actor.email || payload.requestedBy),
    requestedByRole: cleanText(actor.role || actor.userType || payload.role),
    createdAt: now(),
    updatedAt: now(),
  };
  const changeRequests = [...(Array.isArray(doc.data().changeRequests) ? doc.data().changeRequests : []), changeRequest].slice(-100);
  const activityHistory = [...(Array.isArray(doc.data().activityHistory) ? doc.data().activityHistory : []), {
    action: 'change_request_created',
    actorEmail: changeRequest.requestedBy,
    actorRole: changeRequest.requestedByRole,
    timestamp: now(),
    changeRequestId: changeRequest.changeRequestId,
  }].slice(-100);
  await ref.set({ changeRequests, activityHistory, updatedAt: now() }, { merge: true });
  await writeAudit('requirement_change_request_created', actor, { requirementId, changeRequestId: changeRequest.changeRequestId, changeRequest, requirement: docToObject(await ref.get()) });
  return docToObject(await ref.get());
}

async function uploadRequirementAttachment(requirementId, file, payload = {}, actor = {}) {
  if (!file) {
    const error = new Error('Attachment file is required.');
    error.statusCode = 400;
    throw error;
  }
  const ref = db().collection(REQUIREMENTS).doc(requirementId);
  const doc = await ref.get();
  if (!doc.exists) {
    const error = new Error('Requirement not found.');
    error.statusCode = 404;
    throw error;
  }
  const result = await mediaStorage.upload(file, {
    folder: 'project-requirement-attachments',
    prefix: `${requirementId}-${Date.now()}`,
    type: 'file',
    area: 'softotech-requirements',
  });
  const attachment = {
    attachmentId: crypto.randomUUID(),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    provider: result.provider || '',
    bucket: result.bucket || '',
    key: result.key || result.public_id || '',
    url: result.secure_url || result.url,
    uploadedBy: normalizeEmail(actor.email || payload.uploadedBy),
    uploadedByRole: cleanText(actor.role || actor.userType || payload.role),
    createdAt: now(),
  };
  const attachments = [...(Array.isArray(doc.data().attachments) ? doc.data().attachments : []), attachment].slice(-100);
  const activityHistory = [...(Array.isArray(doc.data().activityHistory) ? doc.data().activityHistory : []), {
    action: 'attachment_uploaded',
    actorEmail: attachment.uploadedBy,
    actorRole: attachment.uploadedByRole,
    timestamp: now(),
    attachmentId: attachment.attachmentId,
  }].slice(-100);
  await ref.set({ attachments, activityHistory, updatedAt: now() }, { merge: true });
  await writeAudit('requirement_attachment_uploaded', actor, { requirementId, attachmentId: attachment.attachmentId, attachment, requirement: docToObject(await ref.get()) });
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

async function developerDashboard(user = {}) {
  const userId = user.clientId || user.id || clientIdFromEmail(user.email);
  const email = normalizeEmail(user.email);
  const [assignmentSnapshot, projectSnapshot, requirementSnapshot, taskSnapshot] = await Promise.all([
    db().collection(TEAM_ASSIGNMENTS).limit(5000).get(),
    db().collection(PROJECTS).limit(2000).get(),
    db().collection(REQUIREMENTS).limit(3000).get(),
    db().collection(TASKS).limit(5000).get(),
  ]);
  const assignments = assignmentSnapshot.docs.map(docToObject).filter((item) => item.userId === userId || normalizeEmail(item.email) === email);
  const projectIds = new Set(assignments.map((item) => item.projectId));
  const projects = projectSnapshot.docs.map(docToObject).filter((project) => projectIds.has(project.projectId));
  const requirements = requirementSnapshot.docs.map(docToObject).filter((requirement) => {
    if (requirement.assignedUserId === userId) return true;
    return (requirement.assignedTeamMembers || []).some((member) => member.userId === userId || normalizeEmail(member.email) === email);
  });
  const tasks = taskSnapshot.docs.map(docToObject).filter((task) => task.assignedUserId === userId || normalizeEmail(task.assignedEmail) === email);
  const completedTasks = tasks.filter((task) => task.status === 'Completed').length;
  return {
    profile: normalizeValue(user),
    assignments,
    projects,
    requirements,
    tasks,
    metrics: {
      assignedProjects: projects.length,
      assignedRequirements: requirements.length,
      assignedTasks: tasks.length,
      completedTasks,
      completionPercentage: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
      upcomingDeadlines: tasks.filter((task) => task.dueDate && task.status !== 'Completed').slice(0, 10),
    },
  };
}

async function engineeringDashboard(user = {}, { projectId = '' } = {}) {
  if (user.is_admin || user.role === 'senior_developer') {
    const dashboard = await adminDashboard();
    if (!projectId) return { access: 'admin', ...dashboard };
    return {
      access: 'admin',
      ...dashboard,
      projects: dashboard.projects.filter((project) => project.projectId === projectId),
      requirements: dashboard.requirements.filter((requirement) => requirement.projectId === projectId),
      assignments: dashboard.assignments.filter((assignment) => assignment.projectId === projectId),
      projectRepositories: dashboard.projectRepositories.filter((repository) => repository.projectId === projectId),
      githubActivity: dashboard.githubActivity.filter((activity) => activity.projectId === projectId),
    };
  }

  const role = cleanText(user.teamRole || user.userType || user.role);
  const userId = user.clientId || user.id || clientIdFromEmail(user.email);
  const email = normalizeEmail(user.email);
  const [assignmentSnapshot, projectSnapshot, requirementSnapshot, taskSnapshot, teamMembers, repositorySnapshot, githubActivitySnapshot] = await Promise.all([
    db().collection(TEAM_ASSIGNMENTS).limit(5000).get(),
    db().collection(PROJECTS).limit(2000).get(),
    db().collection(REQUIREMENTS).limit(3000).get(),
    db().collection(TASKS).limit(5000).get(),
    listTeamMembers(),
    db().collection(PROJECT_REPOSITORIES).limit(2000).get(),
    db().collection(GITHUB_ACTIVITY).limit(2000).get(),
  ]);
  const ownAssignments = assignmentSnapshot.docs.map(docToObject).filter((item) => item.userId === userId || normalizeEmail(item.email) === email);
  const projectIds = new Set(ownAssignments.map((item) => item.projectId).filter(Boolean));
  if (projectId && projectIds.has(projectId)) {
    projectIds.clear();
    projectIds.add(projectId);
  }
  const projectItems = projectSnapshot.docs.map(docToObject).filter((project) => projectIds.has(project.projectId));
  const canSeeProject = role === 'Project Manager' || role === 'Team Lead';
  const requirementItems = requirementSnapshot.docs.map(docToObject).filter((requirement) => {
    if (!projectIds.has(requirement.projectId)) return false;
    if (canSeeProject) return true;
    if (requirement.assignedUserId === userId || requirement.memberId === userId) return true;
    return (requirement.assignedTeamMembers || []).some((member) => member.userId === userId || member.memberId === userId || normalizeEmail(member.email) === email);
  });
  const taskItems = taskSnapshot.docs.map(docToObject).filter((task) => {
    if (!projectIds.has(task.projectId)) return false;
    return canSeeProject || task.assignedUserId === userId || task.memberId === userId || normalizeEmail(task.assignedEmail) === email;
  });
  return {
    access: canSeeProject ? 'assigned_project' : 'own_work',
    profile: normalizeValue(user),
    projects: projectItems,
    requirements: requirementItems,
    tasks: taskItems,
    assignments: ownAssignments.filter((assignment) => projectIds.has(assignment.projectId)),
    teamMembers: canSeeProject ? teamMembers.items.filter((member) => member.active !== false && member.status !== 'Inactive') : teamMembers.items.filter((member) => member.userId === userId || normalizeEmail(member.email) === email),
    projectRepositories: repositorySnapshot.docs.map(docToObject).filter((repository) => projectIds.has(repository.projectId)),
    githubActivity: githubActivitySnapshot.docs.map(docToObject).filter((activity) => projectIds.has(activity.projectId)),
  };
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
  await writeAudit('message_sent', { email: message.senderEmail, role: message.senderRole }, { messageId, clientEmail: message.clientEmail, message });
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
  await writeAudit('document_uploaded', { email: payload.actorEmail || payload.clientEmail, role: payload.uploadedBy }, { documentId, clientEmail: document.clientEmail, document });
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
  await writeAudit('portfolio_project_upserted', actor, { projectKey, project });
  return normalizeValue(project);
}

async function buildProjectAiOperationalContext(context = {}) {
  const project = context.projectId ? await getProjectById(context.projectId) : null;
  const requestId = context.requestId || project?.requestId || '';
  const request = requestId ? await projectRequestStore.getByRequestId(requestId).catch(() => null) : null;
  const clientEmail = normalizeEmail(context.clientEmail || project?.clientEmail || request?.contact?.email);
  const [requirements, assignments, messages, documents, quotations, invoices, payments] = await Promise.all([
    context.projectId ? listRequirements({ projectId: context.projectId, limit: 100 }) : Promise.resolve({ items: [] }),
    context.projectId ? getProjectAssignments(context.projectId) : Promise.resolve([]),
    clientEmail ? listCollectionForClient(MESSAGES, clientEmail) : Promise.resolve([]),
    clientEmail ? listCollectionForClient(DOCUMENTS, clientEmail) : Promise.resolve([]),
    clientEmail ? listCollectionForClient(QUOTATIONS, clientEmail) : Promise.resolve([]),
    clientEmail ? listCollectionForClient(INVOICES, clientEmail) : Promise.resolve([]),
    clientEmail ? listCollectionForClient(PAYMENTS, clientEmail) : Promise.resolve([]),
  ]);

  return compactPortalMetadata({
    project,
    request,
    requirements: requirements.items || [],
    assignments,
    messages: messages.slice(0, 20),
    documents: documents.slice(0, 20),
    quotations: quotations.slice(0, 20),
    invoices: invoices.slice(0, 20),
    payments: payments.slice(0, 20),
  });
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
  const operationalContext = await buildProjectAiOperationalContext(context);
  const aiBaseUrl = process.env.YENKASA_AI_ENGINE_URL || process.env.YENKASA_AI_BACKEND_URL || '';
  if (aiBaseUrl && typeof fetch === 'function') {
    const baseUrl = aiBaseUrl.replace(/\/+$/, '');
    const endpoints = [
      { path: '/api/ai/chat', body: { question, audience: 'engineering', operational_context: JSON.stringify(operationalContext), history: [] } },
      { path: '/chat', body: { question, audience: 'engineering', operational_context: JSON.stringify(operationalContext), history: [] } },
      { path: '/api/chat', body: { message: question, context: operationalContext, source: 'softotech_project_portal' } },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.YENKASA_AI_EVENT_API_KEY ? { Authorization: `Bearer ${process.env.YENKASA_AI_EVENT_API_KEY}` } : {}),
          },
          body: JSON.stringify(endpoint.body),
        });
        if (response.ok) {
          const payloadJson = await response.json();
          await writeAudit('project_ai_assistant_used', actor, { ...context, endpoint: endpoint.path, operationalContext });
          return { answer: payloadJson.answer || payloadJson.response || payloadJson.message || 'YenkasaAI returned a response.', source: 'yenkasa_ai', endpoint: endpoint.path, raw: payloadJson };
        }
        console.warn('[SoftOTechPortal] YenkasaAI endpoint rejected request:', {
          endpoint: endpoint.path,
          status: response.status,
        });
      } catch (error) {
        console.warn('[SoftOTechPortal] YenkasaAI request failed:', {
          endpoint: endpoint.path,
          message: error.message,
        });
      }
    }
  }

  await writeAudit('project_ai_assistant_used', actor, { ...context, fallback: true, operationalContext });
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
  addRequirementComment,
  clientDashboard,
  CLIENT_STATUSES,
  convertLeadToClient,
  createClient,
  createInvoice,
  createLead,
  createMessage,
  createProject,
  updateProject,
  createQuotation,
  createRequirement,
  createRequirementChangeRequest,
  developerDashboard,
  engineeringDashboard,
  generateRequirementsForProject,
  generateProposal,
  createGitHubOAuthUrl,
  githubConnection,
  handleGitHubOAuthCallback,
  listGitHubBranches,
  listGitHubFolders,
  listGitHubRepositories,
  listProjectGitHubActivity,
  listProjectRepositoryMappings,
  removeProjectRepositoryMapping,
  migrateApprovedProjectRequirements,
  saveProjectRepositoryMapping,
  syncProjectRepositoryMapping,
  getClientById,
  getProjectAssignments,
  listClients,
  listLeads,
  listRequirements,
  listTeamMembers,
  loginClient,
  projectAiAssistant,
  publishPortalIntelligenceEvent,
  registerClient,
  recordPayment,
  respondToQuotation,
  signPortalToken,
  saveProjectAssignments,
  TEAM_ROLES,
  updateClientProfile,
  updateClientStatus,
  updateLead,
  updateProjectMilestones,
  updateRequirement,
  upsertPortfolioProject,
  uploadPaymentReceipt,
  uploadRequirementAttachment,
  uploadDocument,
  verifyPortalToken,
  _internals: {
    approvalRequirementTemplatesFromRequest,
    sourceRequirementEntries,
  },
};
