const admin = require('firebase-admin');

const DEFAULT_PROJECT_ID = 'project-10405180-0afd-4ecc-9f8';
const PRICING_COLLECTION = process.env.SOFTOTECH_PRICING_COLLECTION || 'softotech_pricing_items';

const DEFAULT_ITEMS = [
  { key: 'ui_ux_design', label: 'UI/UX Design', billingType: 'One-Time', unitPrice: 1500, category: 'base', triggers: ['Website Development', 'Mobile App Development', 'Business Software', 'Custom Project', 'UI/UX Design Project'] },
  { key: 'frontend_mobile_app_development', label: 'Frontend Mobile App Development', billingType: 'One-Time', unitPrice: 4500, category: 'platform', triggers: ['Android App', 'iOS App', 'Cross-platform Mobile App', 'Mobile App Development', 'Mobile App'] },
  { key: 'frontend_web_development', label: 'Frontend Web Development', billingType: 'One-Time', unitPrice: 2500, category: 'platform', triggers: ['Website Development', 'Business Website', 'Portfolio Website', 'Blog/News Website', 'Custom Web Application'] },
  { key: 'backend_api_development', label: 'Backend/API Development', billingType: 'One-Time', unitPrice: 3500, category: 'platform', triggers: ['Backend API', 'Admin Portal', 'Business Software', 'Web + Mobile Platform', 'Custom Web Application'] },
  { key: 'database_setup', label: 'Database Setup & Configuration', billingType: 'One-Time', unitPrice: 1200, category: 'base', triggers: ['Business Software', 'Custom Web Application', 'Web + Mobile Platform', 'AI Solution Development'] },
  { key: 'admin_dashboard', label: 'Admin Dashboard Development', billingType: 'One-Time', unitPrice: 1800, category: 'feature', triggers: ['Admin Dashboard', 'Admin'] },
  { key: 'auth_security', label: 'Authentication & Security Integration', billingType: 'One-Time', unitPrice: 1200, category: 'feature', triggers: ['User Registration/Login', 'Login/Register', 'User Profile'] },
  { key: 'payment_gateway', label: 'Payment Gateway Integration', billingType: 'One-Time', unitPrice: 1500, category: 'feature', triggers: ['Online Payments', 'Payments', 'E-commerce Store'] },
  { key: 'location_service', label: 'GPS/Location Service Integration', billingType: 'One-Time', unitPrice: 900, category: 'feature', triggers: ['Location', 'GPS'] },
  { key: 'push_notifications', label: 'Push Notification Service Integration', billingType: 'Annual / Monthly', unitPrice: 800, category: 'feature', triggers: ['Push Notifications', 'Notifications'] },
  { key: 'email_notifications', label: 'Email Notification Service', billingType: 'Annual / Monthly', unitPrice: 500, category: 'feature', triggers: ['Newsletter', 'Contact Form'] },
  { key: 'sms_notifications', label: 'SMS Notification Service', billingType: 'Annual / Monthly', unitPrice: 600, category: 'feature', triggers: ['SMS'] },
  { key: 'cloud_hosting', label: 'Cloud Hosting Service', billingType: 'Monthly / Annual', unitPrice: 1000, category: 'ops', triggers: ['Cloud Infrastructure', 'Backend API', 'Admin Portal'] },
  { key: 'domain_ssl', label: 'Domain & SSL Certificate', billingType: 'Annual', unitPrice: 450, category: 'ops', triggers: ['Website Development', 'Business Website', 'Portfolio Website', 'Custom Web Application'] },
  { key: 'third_party_api_setup', label: 'API & Third-Party Service Setup', billingType: 'One-Time', unitPrice: 1200, category: 'feature', triggers: ['API Integration', 'AI Assistant'] },
  { key: 'file_storage', label: 'File Storage / Media Hosting', billingType: 'Monthly / Annual', unitPrice: 750, category: 'feature', triggers: ['File Uploads', 'Gallery'] },
  { key: 'testing_qa', label: 'Testing & Quality Assurance', billingType: 'One-Time', unitPrice: 1000, category: 'base', triggers: ['Website Development', 'Mobile App Development', 'Business Software', 'Custom Project'] },
  { key: 'deployment', label: 'Deployment & Production Setup', billingType: 'One-Time', unitPrice: 1000, category: 'ops', triggers: ['Website Development', 'Mobile App Development', 'Business Software', 'Cloud Infrastructure'] },
  { key: 'maintenance_support', label: 'Maintenance & Technical Support', billingType: 'Monthly', unitPrice: 800, category: 'ops', triggers: ['Maintenance', 'Support'] },
  { key: 'bug_fixes_monitoring', label: 'Bug Fixes & Monitoring', billingType: 'Monthly', unitPrice: 500, category: 'ops', triggers: ['Monitoring'] },
  { key: 'server_management', label: 'Server Management', billingType: 'Monthly', unitPrice: 700, category: 'ops', triggers: ['Cloud Infrastructure', 'Server'] },
  { key: 'custom_features', label: 'Additional Features / Customization', billingType: 'One-Time', unitPrice: 1500, category: 'feature', triggers: ['Custom Feature', 'Custom Project'] },
];

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

function pricingCollection() {
  return db().collection(PRICING_COLLECTION);
}

async function ensureDefaultPricing() {
  const snapshot = await pricingCollection().limit(1).get();
  if (!snapshot.empty) return;
  const batch = db().batch();
  const now = new Date();
  DEFAULT_ITEMS.forEach((item) => {
    batch.set(pricingCollection().doc(item.key), { ...item, active: true, createdAt: now, updatedAt: now });
  });
  await batch.commit();
}

async function listPricingItems({ includeInactive = false } = {}) {
  await ensureDefaultPricing();
  const snapshot = await pricingCollection().orderBy('label', 'asc').get();
  return snapshot.docs
    .map((doc) => normalizeValue({ id: doc.id, ...doc.data() }))
    .filter((item) => includeInactive || item.active !== false);
}

async function savePricingItems(items = [], actor = {}) {
  if (!Array.isArray(items)) {
    const error = new Error('Pricing items must be an array.');
    error.statusCode = 400;
    throw error;
  }
  const batch = db().batch();
  const now = new Date();
  for (const item of items) {
    const key = String(item.key || item.id || item.label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!key) continue;
    batch.set(pricingCollection().doc(key), {
      key,
      label: String(item.label || key).trim(),
      billingType: String(item.billingType || 'One-Time').trim(),
      unitPrice: Number(item.unitPrice || 0),
      category: String(item.category || 'feature').trim(),
      triggers: Array.isArray(item.triggers) ? item.triggers.map((value) => String(value).trim()).filter(Boolean) : [],
      active: item.active !== false,
      updatedBy: actor.email || '',
      updatedAt: now,
    }, { merge: true });
  }
  await batch.commit();
  return listPricingItems({ includeInactive: true });
}

function selectedSignals(input = {}) {
  const values = [
    input.requestCategory,
    input.projectType,
    input.websiteType,
    ...(input.pagesRequired || []),
    ...(input.featuresRequired || []),
    ...(input.platformsRequired || []),
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  return new Set(values);
}

function quantityFor(item, input = {}) {
  if (item.key === 'frontend_web_development') return Math.max(1, Number(input.pagesRequired?.length || 1));
  if (item.key === 'frontend_mobile_app_development') return Math.max(1, Number(input.platformsRequired?.filter((value) => /android|ios|mobile/i.test(value)).length || 1));
  return 1;
}

async function estimate(input = {}) {
  const items = await listPricingItems();
  const signals = selectedSignals(input);
  const selected = [];
  for (const item of items) {
    const triggers = Array.isArray(item.triggers) ? item.triggers : [];
    const matched = triggers.some((trigger) => signals.has(String(trigger).trim().toLowerCase()));
    if (!matched) continue;
    const quantity = quantityFor(item, input);
    const unitPrice = Number(item.unitPrice || 0);
    selected.push({
      key: item.key,
      description: item.label,
      billingType: item.billingType || 'One-Time',
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    });
  }
  const subtotal = selected.reduce((sum, item) => sum + item.total, 0);
  const discount = Number(input.discount || 0);
  const tax = Number(input.tax || 0);
  const grandTotal = Math.max(subtotal - discount + tax, 0);
  return {
    currency: input.currency || 'GHS',
    lineItems: selected,
    subtotal,
    discount,
    tax,
    grandTotal,
  };
}

module.exports = {
  DEFAULT_ITEMS,
  estimate,
  listPricingItems,
  savePricingItems,
};
