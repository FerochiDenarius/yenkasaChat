const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const ProjectRequest = require('../models/projectRequest.model');

const DEFAULT_PROJECT_ID = 'project-10405180-0afd-4ecc-9f8';
const DEFAULT_COLLECTION = 'project_requests';

function storageProvider() {
  return String(process.env.PROJECT_REQUEST_STORAGE || 'firestore').trim().toLowerCase();
}

function useMongo() {
  return ['mongo', 'mongodb', 'mongoose'].includes(storageProvider());
}

function collectionName() {
  return process.env.PROJECT_REQUEST_COLLECTION || DEFAULT_COLLECTION;
}

function clientCollectionName() {
  return process.env.PROJECT_REQUEST_CLIENT_COLLECTION || 'project_request_clients';
}

function firestoreProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    DEFAULT_PROJECT_ID;
}

function firestoreDatabaseId() {
  return process.env.SOFTOTECH_FIRESTORE_DATABASE_ID ||
    process.env.PROJECT_REQUEST_FIRESTORE_DATABASE_ID ||
    process.env.FIRESTORE_DATABASE_ID ||
    '(default)';
}

function getFirebaseCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  return admin.credential.applicationDefault();
}

function firestoreDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: getFirebaseCredential(),
      projectId: firestoreProjectId(),
    });
  }
  return getFirestore(admin.app(), firestoreDatabaseId());
}

function requestCollection() {
  return firestoreDb().collection(collectionName());
}

function clientCollection() {
  return firestoreDb().collection(clientCollectionName());
}

function counterCollection() {
  return firestoreDb().collection(process.env.SOFTOTECH_COUNTER_COLLECTION || 'softotech_counters');
}

function clientIdFromEmail(email) {
  return Buffer.from(String(email || '').trim().toLowerCase()).toString('base64url');
}

function normalizeValue(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      acc[key] = normalizeValue(entry);
      return acc;
    }, {});
  }
  return value;
}

function toPlainDocument(doc) {
  if (!doc.exists) return null;
  return normalizeValue({ id: doc.id, ...doc.data() });
}

function searchableText(item) {
  return [
    item.requestId,
    item.requestCategory,
    item.contact?.fullName,
    item.contact?.companyName,
    item.contact?.email,
    item.contact?.phoneNumber,
    item.contact?.whatsappNumber,
    item.contact?.country,
    item.contact?.city,
    item.contact?.businessAddress,
    item.overview?.projectName,
    item.overview?.projectDescription,
    item.objectives?.problemToSolve,
    item.objectives?.businessGoals,
    item.requirements?.projectType,
    item.requirements?.websiteType,
    ...(item.requirements?.featuresRequired || []),
    ...(item.requirements?.platformsRequired || []),
    ...(item.integrations || []),
    item.business?.industryType,
  ].filter(Boolean).join(' ').toLowerCase();
}

function inDateRange(item, from, to) {
  const submittedAt = new Date(item.submittedAt || item.createdAt || 0);
  if (Number.isNaN(submittedAt.getTime())) return false;
  if (from && submittedAt < new Date(from)) return false;
  if (to && submittedAt > new Date(to)) return false;
  return true;
}

function sortNewestFirst(a, b) {
  return new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0);
}

async function exists(requestId) {
  if (useMongo()) {
    return Boolean(await ProjectRequest.exists({ requestId }));
  }
  const doc = await requestCollection().doc(requestId).get();
  return doc.exists;
}

async function getByRequestId(requestId) {
  if (!requestId) return null;
  if (useMongo()) {
    const request = await ProjectRequest.findOne({ requestId }).lean();
    return request ? normalizeValue(request) : null;
  }
  const doc = await requestCollection().doc(requestId).get();
  return doc.exists ? toPlainDocument(doc) : null;
}

async function nextTrackingId() {
  const year = new Date().getFullYear();
  if (useMongo()) {
    const count = await ProjectRequest.countDocuments({
      requestId: new RegExp(`^YST-${year}-`),
    });
    return `YST-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  const ref = counterCollection().doc(`project_requests_${year}`);
  const next = await firestoreDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? Number(snapshot.data().value || 0) : 0;
    const value = current + 1;
    transaction.set(ref, { value, year, updatedAt: new Date() }, { merge: true });
    return value;
  });
  return `YST-${year}-${String(next).padStart(4, '0')}`;
}

async function create(payload) {
  if (useMongo()) {
    return ProjectRequest.create(payload);
  }
  const now = new Date();
  const document = {
    ...payload,
    storageProvider: 'firestore',
    createdAt: now,
    updatedAt: now,
  };
  await requestCollection().doc(payload.requestId).set(document);
  await upsertClientProfile(document);
  return normalizeValue(document);
}

async function upsertClientProfile(request) {
  const email = request.contact?.email;
  if (!email) return null;
  const now = new Date();
  const ref = clientCollection().doc(clientIdFromEmail(email));
  const snapshot = await ref.get();
  const current = snapshot.exists ? snapshot.data() : {};
  const requestIds = new Set([...(current.requestIds || []), request.requestId]);
  const client = {
    email,
    fullName: request.contact?.fullName || current.fullName || '',
    companyName: request.contact?.companyName || current.companyName || '',
    phoneNumber: request.contact?.phoneNumber || current.phoneNumber || '',
    whatsappNumber: request.contact?.whatsappNumber || current.whatsappNumber || '',
    businessLocation: request.contact?.businessLocation || current.businessLocation || '',
    preferredContactMethod: request.contact?.preferredContactMethod || current.preferredContactMethod || '',
    bestTimeToContact: request.contact?.bestTimeToContact || current.bestTimeToContact || '',
    latestRequestId: request.requestId,
    latestProjectType: request.requirements?.projectType || request.requirements?.websiteType || '',
    latestRequestCategory: request.requestCategory || '',
    requestIds: Array.from(requestIds),
    requestCount: requestIds.size,
    firstSeenAt: current.firstSeenAt || request.submittedAt || now,
    lastSeenAt: request.submittedAt || now,
    updatedAt: now,
  };
  await ref.set(client, { merge: true });
  return normalizeValue(client);
}

async function list({ search = '', status = '', from = '', to = '', limit = 50, page = 1 } = {}) {
  if (useMongo()) {
    const query = {};
    if (status && ProjectRequest.PROJECT_REQUEST_STATUSES.includes(status)) query.status = status;
    if (from || to) {
      query.submittedAt = {};
      if (from) query.submittedAt.$gte = new Date(from);
      if (to) query.submittedAt.$lte = new Date(to);
    }
    if (search) {
      query.$or = [
        { requestId: new RegExp(search, 'i') },
        { 'contact.fullName': new RegExp(search, 'i') },
        { 'contact.companyName': new RegExp(search, 'i') },
        { 'contact.email': new RegExp(search, 'i') },
        { 'requirements.websiteType': new RegExp(search, 'i') },
        { 'requirements.projectType': new RegExp(search, 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      ProjectRequest.find(query).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProjectRequest.countDocuments(query),
    ]);
    return { items: normalizeValue(items), total, page, limit };
  }

  const snapshot = await requestCollection().orderBy('submittedAt', 'desc').limit(1000).get();
  const needle = String(search || '').trim().toLowerCase();
  let items = snapshot.docs.map(toPlainDocument).filter(Boolean);
  if (status) items = items.filter((item) => item.status === status);
  if (from || to) items = items.filter((item) => inDateRange(item, from, to));
  if (needle) items = items.filter((item) => searchableText(item).includes(needle));
  items.sort(sortNewestFirst);

  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit };
}

async function listClients({ search = '', limit = 50, page = 1 } = {}) {
  if (useMongo()) {
    const result = await list({ search, limit: 500, page: 1 });
    const clientsByEmail = new Map();
    for (const request of result.items) {
      const email = request.contact?.email;
      if (!email) continue;
      const existing = clientsByEmail.get(email) || {
        email,
        fullName: request.contact?.fullName || '',
        companyName: request.contact?.companyName || '',
        phoneNumber: request.contact?.phoneNumber || '',
        whatsappNumber: request.contact?.whatsappNumber || '',
        businessLocation: request.contact?.businessLocation || '',
        preferredContactMethod: request.contact?.preferredContactMethod || '',
        bestTimeToContact: request.contact?.bestTimeToContact || '',
        requestIds: [],
        requestCount: 0,
      };
      existing.latestRequestId = request.requestId;
      existing.latestProjectType = request.requirements?.projectType || request.requirements?.websiteType || '';
      existing.latestRequestCategory = request.requestCategory || '';
      existing.requestIds.push(request.requestId);
      existing.requestCount = existing.requestIds.length;
      existing.lastSeenAt = request.submittedAt || request.createdAt;
      clientsByEmail.set(email, existing);
    }
    const items = Array.from(clientsByEmail.values());
    return { items, total: items.length, page, limit };
  }

  const snapshot = await clientCollection().orderBy('lastSeenAt', 'desc').limit(1000).get();
  const needle = String(search || '').trim().toLowerCase();
  let items = snapshot.docs.map(toPlainDocument).filter(Boolean);
  if (needle) {
    items = items.filter((client) => [
      client.email,
      client.fullName,
      client.companyName,
      client.phoneNumber,
      client.whatsappNumber,
      client.latestProjectType,
    ].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }
  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit };
}

async function analytics() {
  const convertedStatuses = new Set(['Approved', 'Completed']);

  if (useMongo()) {
    const [total, byType, byCategory, byStatus, monthly, converted] = await Promise.all([
      ProjectRequest.countDocuments({}),
      ProjectRequest.aggregate([{ $group: { _id: '$requirements.websiteType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      ProjectRequest.aggregate([{ $group: { _id: '$requestCategory', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      ProjectRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      ProjectRequest.aggregate([
        { $group: { _id: { year: { $year: '$submittedAt' }, month: { $month: '$submittedAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ]),
      ProjectRequest.countDocuments({ status: { $in: Array.from(convertedStatuses) } }),
    ]);
    return {
      total,
      converted,
      byType: byType.map((item) => ({ type: item._id || 'Unknown', count: item.count })),
      byCategory: byCategory.map((item) => ({ category: item._id || 'Unknown', count: item.count })),
      byStatus: byStatus.map((item) => ({ status: item._id || 'Unknown', count: item.count })),
      monthly: monthly.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        count: item.count,
      })),
    };
  }

  const snapshot = await requestCollection().limit(5000).get();
  const items = snapshot.docs.map(toPlainDocument).filter(Boolean);
  const counters = {
    byType: new Map(),
    byCategory: new Map(),
    byStatus: new Map(),
    monthly: new Map(),
  };

  let converted = 0;
  for (const item of items) {
    const type = item.requirements?.projectType || item.requirements?.websiteType || 'Unknown';
    const category = item.requestCategory || 'Unknown';
    const status = item.status || 'Unknown';
    const date = new Date(item.submittedAt || item.createdAt || Date.now());
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    counters.byType.set(type, (counters.byType.get(type) || 0) + 1);
    counters.byCategory.set(category, (counters.byCategory.get(category) || 0) + 1);
    counters.byStatus.set(status, (counters.byStatus.get(status) || 0) + 1);
    counters.monthly.set(month, (counters.monthly.get(month) || 0) + 1);
    if (convertedStatuses.has(status)) converted += 1;
  }

  const mapToRows = (map, key) => Array.from(map.entries())
    .map(([name, count]) => ({ [key]: name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: items.length,
    converted,
    byType: mapToRows(counters.byType, 'type'),
    byCategory: mapToRows(counters.byCategory, 'category'),
    byStatus: mapToRows(counters.byStatus, 'status'),
    monthly: mapToRows(counters.monthly, 'month').slice(0, 12),
  };
}

async function updateEmailNotifications(requestId, emailNotifications) {
  if (useMongo()) {
    return ProjectRequest.updateOne({ requestId }, { $set: { emailNotifications } });
  }
  return requestCollection().doc(requestId).set({
    emailNotifications,
    updatedAt: new Date(),
  }, { merge: true });
}

async function updatePricingAndInvoice(requestId, pricingEstimate, invoice) {
  const update = {
    pricingEstimate: normalizeValue(pricingEstimate),
    invoice: normalizeValue(invoice),
    updatedAt: new Date(),
  };
  if (useMongo()) {
    return ProjectRequest.updateOne({ requestId }, { $set: update });
  }
  return requestCollection().doc(requestId).set(update, { merge: true });
}

async function updateStatus(requestId, status, changedBy = null) {
  if (useMongo()) {
    const request = await ProjectRequest.findOne({ requestId });
    if (!request) return null;
    request.status = status;
    request.statusHistory.push({ status, changedBy, changedAt: new Date() });
    await request.save();
    return normalizeValue(request.toObject());
  }

  const ref = requestCollection().doc(requestId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const current = doc.data();
  const statusHistory = Array.isArray(current.statusHistory) ? current.statusHistory : [];
  const updated = {
    status,
    statusHistory: [...statusHistory, { status, changedBy: changedBy ? String(changedBy) : null, changedAt: new Date() }],
    updatedAt: new Date(),
  };
  await ref.set(updated, { merge: true });
  return normalizeValue({ id: requestId, ...current, ...updated });
}

module.exports = {
  analytics,
  clientCollectionName,
  collectionName,
  create,
  exists,
  getByRequestId,
  list,
  listClients,
  nextTrackingId,
  storageProvider,
  updateEmailNotifications,
  updatePricingAndInvoice,
  updateStatus,
};
