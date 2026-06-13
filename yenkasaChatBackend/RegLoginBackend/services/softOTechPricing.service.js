const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const DEFAULT_PROJECT_ID = 'project-10405180-0afd-4ecc-9f8';
const CATEGORY_COLLECTION = process.env.SOFTOTECH_PRICING_CATEGORY_COLLECTION || 'softotech_service_categories';
const PRICING_COLLECTION = process.env.SOFTOTECH_PRICING_COLLECTION || 'softotech_pricing_items';

const BILLING_TYPES = ['Fixed Price', 'Hourly', 'Daily', 'Weekly', 'Monthly', 'One-Time'];

const DEFAULT_CATEGORIES = [
  ['domain-hosting', 'Domain & Hosting', 'Domains, hosting plans, DNS, SSL, CDN, and infrastructure basics.'],
  ['website-development', 'Website Development', 'Business, school, church, ecommerce, blog, and portfolio websites.'],
  ['mobile-app-development', 'Mobile App Development', 'Android, iOS, Flutter, React Native, stores, chat, and streaming.'],
  ['ui-ux-design', 'UI/UX Design', 'Product design, responsive design, dashboards, prototypes, and design systems.'],
  ['backend-services', 'Backend Services', 'APIs, databases, authentication, notifications, and integrations.'],
  ['cloud-infrastructure', 'Cloud Infrastructure', 'Deployment, proxy, DNS, SSL, CDN, server monitoring, backup, and DR.'],
  ['ai-development', 'AI Development', 'Chatbots, RAG, agents, OCR, recommendations, and OIL dashboards.'],
  ['maintenance-support', 'Maintenance & Support', 'Monthly support, content updates, monitoring, bug fixes, and emergency support.'],
  ['security-services', 'Security Services', 'Security audit, firewall, access control, penetration testing, and backup setup.'],
  ['digital-marketing', 'Digital Marketing', 'Launch support, campaign pages, analytics, SEO, and growth support.'],
].map(([categoryId, categoryName, description]) => ({
  categoryId,
  categoryName,
  description,
  isActive: true,
}));

function item(itemId, categoryId, serviceName, unitPrice, billingType = 'One-Time', extra = {}) {
  return {
    itemId,
    key: itemId,
    categoryId,
    serviceName,
    label: serviceName,
    description: extra.description || serviceName,
    unitPrice,
    currency: extra.currency || 'GHS',
    billingType,
    minimumPrice: extra.minimumPrice ?? unitPrice,
    maximumPrice: extra.maximumPrice ?? unitPrice,
    estimatedDuration: extra.estimatedDuration || '',
    discountPercentage: Number(extra.discountPercentage || 0),
    taxPercentage: Number(extra.taxPercentage || 0),
    profitMargin: Number(extra.profitMargin || 0),
    estimatedHours: Number(extra.estimatedHours || 0),
    estimatedDays: Number(extra.estimatedDays || 0),
    internalCost: Number(extra.internalCost || 0),
    sellingPrice: Number(extra.sellingPrice || unitPrice),
    triggers: extra.triggers || [serviceName],
    isActive: extra.isActive !== false,
    active: extra.isActive !== false,
  };
}

const DEFAULT_ITEMS = [
  item('com-domain', 'domain-hosting', '.com Domain', 220, 'Fixed Price', { triggers: ['.com Domain', 'Domain Registration'] }),
  item('org-domain', 'domain-hosting', '.org Domain', 240, 'Fixed Price', { triggers: ['.org Domain', 'Domain Registration'] }),
  item('net-domain', 'domain-hosting', '.net Domain', 240, 'Fixed Price', { triggers: ['.net Domain', 'Domain Registration'] }),
  item('edu-domain', 'domain-hosting', '.edu Domain', 350, 'Fixed Price', { triggers: ['.edu Domain', 'School Website'] }),
  item('info-domain', 'domain-hosting', '.info Domain', 180, 'Fixed Price', { triggers: ['.info Domain', 'Domain Registration'] }),
  item('shared-hosting', 'domain-hosting', 'Shared Hosting', 900, 'Yearly', { billingType: 'Fixed Price', triggers: ['Shared Hosting', 'Website Development'] }),
  item('vps-hosting', 'domain-hosting', 'VPS Hosting', 1800, 'Monthly', { triggers: ['VPS Hosting', 'Backend API', 'Cloud Infrastructure'] }),
  item('dedicated-hosting', 'domain-hosting', 'Dedicated Hosting', 4500, 'Monthly', { triggers: ['Dedicated Hosting', 'High Traffic'] }),
  item('cloud-hosting', 'domain-hosting', 'Cloud Hosting', 1500, 'Monthly', { triggers: ['Cloud Hosting', 'Cloud Infrastructure', 'Backend API'] }),

  item('landing-page-design', 'website-development', 'Landing Page Design', 1200, 'One-Time', { triggers: ['Landing Page', 'Business Website'] }),
  item('multi-page-website', 'website-development', 'Multi-Page Website Design', 2800, 'One-Time', { triggers: ['Multi-Page Website', 'Business Website', 'Website Development'] }),
  item('corporate-website', 'website-development', 'Corporate Website', 4200, 'One-Time', { triggers: ['Corporate Website', 'Business Website'] }),
  item('school-website', 'website-development', 'School Website', 5000, 'One-Time', { triggers: ['School Website'] }),
  item('church-website', 'website-development', 'Church Website', 3500, 'One-Time', { triggers: ['Church Website'] }),
  item('ecommerce-website', 'website-development', 'E-Commerce Website', 7500, 'One-Time', { triggers: ['E-commerce Store', 'E-Commerce Website', 'Online Payments'] }),
  item('blog-website', 'website-development', 'Blog Website', 2800, 'One-Time', { triggers: ['Blog', 'Blog/News Website'] }),
  item('portfolio-website', 'website-development', 'Portfolio Website', 2500, 'One-Time', { triggers: ['Portfolio Website'] }),

  item('ui-design', 'ui-ux-design', 'UI Design', 1500, 'One-Time', { triggers: ['UI Design', 'UI/UX Design'] }),
  item('responsive-design', 'ui-ux-design', 'Responsive Design', 1200, 'One-Time', { triggers: ['Responsive Design', 'Website Development', 'Mobile App Development'] }),
  item('frontend-development', 'ui-ux-design', 'Frontend Development', 2500, 'One-Time', { triggers: ['Frontend Development', 'Website Development', 'Custom Web Application'] }),
  item('admin-dashboard-ui', 'ui-ux-design', 'Admin Dashboard', 1800, 'One-Time', { triggers: ['Admin Dashboard'] }),

  item('api-development', 'backend-services', 'API Development', 3500, 'One-Time', { triggers: ['API Development', 'Backend API', 'Custom Web Application'] }),
  item('database-design', 'backend-services', 'Database Design', 1500, 'One-Time', { triggers: ['Database Design', 'Business Software'] }),
  item('authentication-system', 'backend-services', 'Authentication System', 1200, 'One-Time', { triggers: ['Authentication System', 'User Registration/Login'] }),
  item('payment-integration', 'backend-services', 'Payment Integration', 1500, 'One-Time', { triggers: ['Payment Integration', 'Online Payments', 'E-commerce Store'] }),
  item('notification-system', 'backend-services', 'Notification System', 900, 'One-Time', { triggers: ['Notification System', 'Newsletter', 'Push Notification Setup'] }),

  item('android-app', 'mobile-app-development', 'Android App Development', 7000, 'One-Time', { triggers: ['Android App Development', 'Android App', 'Mobile App Development'] }),
  item('ios-app', 'mobile-app-development', 'iOS App Development', 8000, 'One-Time', { triggers: ['iOS App Development', 'iOS App', 'Mobile App Development'] }),
  item('flutter-development', 'mobile-app-development', 'Flutter Development', 8500, 'One-Time', { triggers: ['Flutter Development', 'Cross-platform Mobile App', 'Mobile App Development'] }),
  item('react-native-development', 'mobile-app-development', 'React Native Development', 8000, 'One-Time', { triggers: ['React Native Development', 'Mobile App Development'] }),
  item('app-store-deployment', 'mobile-app-development', 'App Store Deployment', 1500, 'One-Time', { triggers: ['App Store Deployment', 'iOS App'] }),
  item('play-store-deployment', 'mobile-app-development', 'Play Store Deployment', 1200, 'One-Time', { triggers: ['Play Store Deployment', 'Android App'] }),
  item('push-notification-setup', 'mobile-app-development', 'Push Notification Setup', 1000, 'One-Time', { triggers: ['Push Notification Setup', 'Notifications'] }),
  item('live-streaming-integration', 'mobile-app-development', 'Live Streaming Integration', 3500, 'One-Time', { triggers: ['Live Streaming Integration', 'Livestream'] }),
  item('chat-integration', 'mobile-app-development', 'Chat Integration', 2500, 'One-Time', { triggers: ['Chat Integration', 'Live Chat'] }),
  item('payment-gateway-mobile', 'mobile-app-development', 'Payment Gateway Integration', 1800, 'One-Time', { triggers: ['Payment Gateway Integration', 'Online Payments'] }),

  item('dns-configuration', 'cloud-infrastructure', 'DNS Configuration', 500, 'One-Time', { triggers: ['DNS Configuration', 'Domain Registration'] }),
  item('proxy-configuration', 'cloud-infrastructure', 'Proxy Configuration', 900, 'One-Time', { triggers: ['Proxy Configuration', 'Cloud Infrastructure'] }),
  item('ssl-installation', 'cloud-infrastructure', 'SSL Installation', 450, 'One-Time', { triggers: ['SSL Installation', 'SSL Setup'] }),
  item('cdn-configuration', 'cloud-infrastructure', 'CDN Configuration', 800, 'One-Time', { triggers: ['CDN Configuration'] }),
  item('cloud-deployment', 'cloud-infrastructure', 'Cloud Deployment', 1500, 'One-Time', { triggers: ['Cloud Deployment', 'Cloud Infrastructure'] }),

  item('ai-chatbot', 'ai-development', 'AI Chatbot', 5000, 'One-Time', { triggers: ['AI Chatbot', 'AI Solution Development'] }),
  item('rag-implementation', 'ai-development', 'RAG Implementation', 6500, 'One-Time', { triggers: ['RAG Implementation', 'AI Solution Development'] }),
  item('vector-database-setup', 'ai-development', 'Vector Database Setup', 2500, 'One-Time', { triggers: ['Vector Database Setup'] }),
  item('ai-agent-development', 'ai-development', 'AI Agent Development', 7500, 'One-Time', { triggers: ['AI Agent Development'] }),
  item('document-intelligence', 'ai-development', 'Document Intelligence', 6000, 'One-Time', { triggers: ['Document Intelligence'] }),
  item('ocr-integration', 'ai-development', 'OCR Integration', 3500, 'One-Time', { triggers: ['OCR Integration'] }),
  item('recommendation-engine', 'ai-development', 'Recommendation Engine', 7000, 'One-Time', { triggers: ['Recommendation Engine'] }),
  item('oil-dashboard', 'ai-development', 'Operational Intelligence Dashboard', 9000, 'One-Time', { triggers: ['Operational Intelligence Dashboard', 'AI Solution Development'] }),
  item('custom-ai-training', 'ai-development', 'Custom AI Training', 12000, 'One-Time', { triggers: ['Custom AI Training'] }),

  item('ssl-setup', 'security-services', 'SSL Setup', 450, 'One-Time', { triggers: ['SSL Setup', 'SSL Installation'] }),
  item('firewall-configuration', 'security-services', 'Firewall Configuration', 1200, 'One-Time', { triggers: ['Firewall Configuration'] }),
  item('cloud-security-setup', 'security-services', 'Cloud Security Setup', 2500, 'One-Time', { triggers: ['Cloud Security Setup'] }),
  item('access-control-configuration', 'security-services', 'Access Control Configuration', 1800, 'One-Time', { triggers: ['Access Control Configuration'] }),
  item('security-audit', 'security-services', 'Security Audit', 3500, 'One-Time', { triggers: ['Security Audit'] }),
  item('penetration-testing', 'security-services', 'Penetration Testing', 6000, 'One-Time', { triggers: ['Penetration Testing'] }),
  item('backup-configuration', 'security-services', 'Backup Configuration', 1500, 'One-Time', { triggers: ['Backup Configuration'] }),
  item('disaster-recovery-setup', 'security-services', 'Disaster Recovery Setup', 3500, 'One-Time', { triggers: ['Disaster Recovery Setup'] }),

  item('monthly-website-maintenance', 'maintenance-support', 'Monthly Website Maintenance', 800, 'Monthly', { triggers: ['Monthly Website Maintenance', 'Maintenance'] }),
  item('monthly-app-maintenance', 'maintenance-support', 'Monthly App Maintenance', 1200, 'Monthly', { triggers: ['Monthly App Maintenance', 'Maintenance'] }),
  item('server-monitoring', 'maintenance-support', 'Server Monitoring', 700, 'Monthly', { triggers: ['Server Monitoring', 'Monitoring'] }),
  item('database-maintenance', 'maintenance-support', 'Database Maintenance', 900, 'Monthly', { triggers: ['Database Maintenance'] }),
  item('content-updates', 'maintenance-support', 'Content Updates', 500, 'Monthly', { triggers: ['Content Updates'] }),
  item('emergency-support', 'maintenance-support', 'Emergency Support', 1500, 'Monthly', { triggers: ['Emergency Support'] }),
  item('bug-fixes', 'maintenance-support', 'Bug Fixes', 800, 'Monthly', { triggers: ['Bug Fixes'] }),
  item('performance-optimization', 'maintenance-support', 'Performance Optimization', 1800, 'One-Time', { triggers: ['Performance Optimization'] }),
];

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
      acc[key] = normalizeValue(entry);
      return acc;
    }, {});
  }
  return value;
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function categoryCollection() {
  return db().collection(CATEGORY_COLLECTION);
}

function pricingCollection() {
  return db().collection(PRICING_COLLECTION);
}

async function ensureDefaultPricing() {
  const [categorySnapshot, itemSnapshot] = await Promise.all([
    categoryCollection().limit(1).get(),
    pricingCollection().limit(1).get(),
  ]);
  const batch = db().batch();
  const stamp = now();
  let changed = false;
  if (categorySnapshot.empty) {
    for (const category of DEFAULT_CATEGORIES) {
      batch.set(categoryCollection().doc(category.categoryId), { ...category, createdAt: stamp, updatedAt: stamp }, { merge: true });
    }
    changed = true;
  }
  if (itemSnapshot.empty) {
    for (const pricingItem of DEFAULT_ITEMS) {
      batch.set(pricingCollection().doc(pricingItem.itemId), { ...pricingItem, createdAt: stamp, updatedAt: stamp }, { merge: true });
    }
    changed = true;
  }
  if (changed) await batch.commit();
}

async function listCategories({ includeInactive = false } = {}) {
  await ensureDefaultPricing();
  const snapshot = await categoryCollection().orderBy('categoryName', 'asc').get();
  return snapshot.docs
    .map((doc) => normalizeValue({ id: doc.id, ...doc.data() }))
    .filter((category) => includeInactive || category.isActive !== false);
}

async function saveCategories(categories = [], actor = {}) {
  if (!Array.isArray(categories)) {
    const error = new Error('Categories must be an array.');
    error.statusCode = 400;
    throw error;
  }
  const batch = db().batch();
  const stamp = now();
  for (const category of categories) {
    const categoryId = slug(category.categoryId || category.id || category.categoryName);
    if (!categoryId) continue;
    batch.set(categoryCollection().doc(categoryId), {
      categoryId,
      categoryName: String(category.categoryName || category.name || categoryId).trim(),
      description: String(category.description || '').trim(),
      isActive: category.isActive !== false,
      updatedBy: actor.email || '',
      updatedAt: stamp,
      createdAt: category.createdAt || stamp,
    }, { merge: true });
  }
  await batch.commit();
  return listCategories({ includeInactive: true });
}

function normalizePricingItem(input = {}, actor = {}) {
  const itemId = slug(input.itemId || input.key || input.id || input.serviceName || input.label);
  if (!itemId) return null;
  const unitPrice = Number(input.unitPrice ?? input.sellingPrice ?? 0);
  const internalCost = Number(input.internalCost || 0);
  const profitMargin = input.profitMargin !== undefined
    ? Number(input.profitMargin || 0)
    : unitPrice && internalCost ? Number((((unitPrice - internalCost) / unitPrice) * 100).toFixed(2)) : 0;
  return {
    itemId,
    key: itemId,
    categoryId: slug(input.categoryId || input.category || 'custom'),
    serviceName: String(input.serviceName || input.label || input.description || itemId).trim(),
    label: String(input.label || input.serviceName || itemId).trim(),
    description: String(input.description || input.serviceName || input.label || '').trim(),
    unitPrice,
    currency: String(input.currency || 'GHS').trim().toUpperCase(),
    billingType: BILLING_TYPES.includes(input.billingType) ? input.billingType : String(input.billingType || 'One-Time').trim(),
    minimumPrice: Number(input.minimumPrice ?? unitPrice),
    maximumPrice: Number(input.maximumPrice ?? unitPrice),
    estimatedDuration: String(input.estimatedDuration || '').trim(),
    discountPercentage: Number(input.discountPercentage || 0),
    taxPercentage: Number(input.taxPercentage || 0),
    profitMargin,
    estimatedHours: Number(input.estimatedHours || 0),
    estimatedDays: Number(input.estimatedDays || 0),
    internalCost,
    sellingPrice: Number(input.sellingPrice ?? unitPrice),
    triggers: Array.isArray(input.triggers)
      ? input.triggers.map((value) => String(value).trim()).filter(Boolean)
      : String(input.triggers || '').split(',').map((value) => value.trim()).filter(Boolean),
    isActive: input.isActive !== false && input.active !== false,
    active: input.isActive !== false && input.active !== false,
    updatedBy: actor.email || '',
    updatedAt: now(),
    createdAt: input.createdAt || now(),
  };
}

async function listPricingItems({ includeInactive = false, categoryId = '', search = '' } = {}) {
  await ensureDefaultPricing();
  const snapshot = await pricingCollection().orderBy('serviceName', 'asc').get();
  const needle = String(search || '').trim().toLowerCase();
  return snapshot.docs
    .map((doc) => normalizeValue({ id: doc.id, ...doc.data() }))
    .filter((item) => includeInactive || item.isActive !== false)
    .filter((item) => !categoryId || item.categoryId === categoryId)
    .filter((item) => !needle || [item.serviceName, item.description, item.categoryId, item.billingType].filter(Boolean).join(' ').toLowerCase().includes(needle));
}

async function savePricingItems(items = [], actor = {}) {
  if (!Array.isArray(items)) {
    const error = new Error('Pricing items must be an array.');
    error.statusCode = 400;
    throw error;
  }
  const batch = db().batch();
  for (const raw of items) {
    const pricingItem = normalizePricingItem(raw, actor);
    if (!pricingItem) continue;
    batch.set(pricingCollection().doc(pricingItem.itemId), pricingItem, { merge: true });
  }
  await batch.commit();
  return listPricingItems({ includeInactive: true });
}

async function createPricingItem(input = {}, actor = {}) {
  const pricingItem = normalizePricingItem(input, actor);
  if (!pricingItem) {
    const error = new Error('Service name is required.');
    error.statusCode = 400;
    throw error;
  }
  await pricingCollection().doc(pricingItem.itemId).set(pricingItem, { merge: true });
  return normalizeValue(pricingItem);
}

async function archivePricingItem(itemId, actor = {}) {
  const id = slug(itemId);
  await pricingCollection().doc(id).set({ isActive: false, active: false, updatedBy: actor.email || '', updatedAt: now() }, { merge: true });
  return normalizeValue({ itemId: id, isActive: false });
}

async function duplicatePricingItem(itemId, actor = {}) {
  const id = slug(itemId);
  const doc = await pricingCollection().doc(id).get();
  if (!doc.exists) {
    const error = new Error('Pricing item not found.');
    error.statusCode = 404;
    throw error;
  }
  const copyId = `${id}-copy-${Date.now()}`;
  const copy = {
    ...doc.data(),
    itemId: copyId,
    key: copyId,
    serviceName: `${doc.data().serviceName || id} Copy`,
    label: `${doc.data().label || doc.data().serviceName || id} Copy`,
    updatedBy: actor.email || '',
    createdAt: now(),
    updatedAt: now(),
  };
  await pricingCollection().doc(copyId).set(copy);
  return normalizeValue(copy);
}

function selectedSignals(input = {}) {
  const values = [
    input.requestCategory,
    input.projectType,
    input.websiteType,
    ...(input.pagesRequired || []),
    ...(input.featuresRequired || []),
    ...(input.platformsRequired || []),
    ...(input.selectedServices || []),
    ...(input.serviceIds || []),
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  return new Set(values);
}

function quantityFor(pricingItem, input = {}) {
  if (pricingItem.itemId === 'frontend-development') return Math.max(1, Number(input.pagesRequired?.length || 1));
  if (pricingItem.categoryId === 'mobile-app-development') {
    return Math.max(1, Number(input.platformsRequired?.filter((value) => /android|ios|mobile/i.test(value)).length || 1));
  }
  return 1;
}

function calculateLine(pricingItem, quantity = 1, override = {}) {
  const unitPrice = Number(override.unitPrice ?? pricingItem.sellingPrice ?? pricingItem.unitPrice ?? 0);
  const discountPercentage = Number(override.discountPercentage ?? pricingItem.discountPercentage ?? 0);
  const taxPercentage = Number(override.taxPercentage ?? pricingItem.taxPercentage ?? 0);
  const gross = unitPrice * Number(quantity || 1);
  const discount = gross * (discountPercentage / 100);
  const taxable = Math.max(gross - discount, 0);
  const tax = taxable * (taxPercentage / 100);
  return {
    itemId: pricingItem.itemId || pricingItem.key,
    serviceName: pricingItem.serviceName || pricingItem.label,
    description: pricingItem.description || pricingItem.serviceName || pricingItem.label,
    categoryId: pricingItem.categoryId || pricingItem.category || '',
    billingType: pricingItem.billingType || 'One-Time',
    currency: pricingItem.currency || 'GHS',
    quantity: Number(quantity || 1),
    unitPrice,
    gross,
    discountPercentage,
    discount,
    taxPercentage,
    tax,
    total: taxable + tax,
    internalCost: Number(pricingItem.internalCost || 0) * Number(quantity || 1),
    profit: taxable + tax - (Number(pricingItem.internalCost || 0) * Number(quantity || 1)),
  };
}

async function calculateFromServiceSelections(selections = [], options = {}) {
  await ensureDefaultPricing();
  const items = await listPricingItems({ includeInactive: true });
  const byId = new Map(items.map((pricingItem) => [pricingItem.itemId || pricingItem.key, pricingItem]));
  const lines = [];
  for (const selection of selections) {
    const itemId = String(selection.itemId || selection.key || selection.serviceId || '').trim();
    const pricingItem = byId.get(itemId);
    if (!pricingItem || pricingItem.isActive === false) continue;
    lines.push(calculateLine(pricingItem, Number(selection.quantity || 1), selection));
  }
  return summarizeLines(lines, options);
}

function summarizeLines(lines = [], options = {}) {
  const subtotal = lines.reduce((sum, line) => sum + Number(line.gross || 0), 0);
  const discount = lines.reduce((sum, line) => sum + Number(line.discount || 0), 0) + Number(options.discount || 0);
  const tax = lines.reduce((sum, line) => sum + Number(line.tax || 0), 0) + Number(options.tax || 0);
  const internalCost = lines.reduce((sum, line) => sum + Number(line.internalCost || 0), 0);
  const grandTotal = Math.max(subtotal - discount + tax, 0);
  return {
    currency: options.currency || lines[0]?.currency || 'GHS',
    lineItems: lines,
    serviceCost: subtotal,
    subtotal,
    discount,
    tax,
    internalCost,
    profit: grandTotal - internalCost,
    grandTotal,
  };
}

async function estimate(input = {}) {
  const items = await listPricingItems();
  const signals = selectedSignals(input);
  const selected = [];
  const explicitIds = new Set([...(input.serviceIds || []), ...(input.selectedServices || [])].map((value) => String(value).trim()));
  for (const pricingItem of items) {
    const id = pricingItem.itemId || pricingItem.key;
    const triggers = Array.isArray(pricingItem.triggers) ? pricingItem.triggers : [];
    const matched = explicitIds.has(id) || triggers.some((trigger) => signals.has(String(trigger).trim().toLowerCase()));
    if (!matched) continue;
    selected.push(calculateLine(pricingItem, quantityFor(pricingItem, input)));
  }
  return summarizeLines(selected, input);
}

function toCsv(items = []) {
  const headers = [
    'itemId',
    'categoryId',
    'serviceName',
    'description',
    'unitPrice',
    'currency',
    'billingType',
    'minimumPrice',
    'maximumPrice',
    'estimatedDuration',
    'discountPercentage',
    'taxPercentage',
    'profitMargin',
    'estimatedHours',
    'estimatedDays',
    'internalCost',
    'sellingPrice',
    'isActive',
    'triggers',
  ];
  const escape = (value) => `"${String(Array.isArray(value) ? value.join('|') : value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...items.map((entry) => headers.map((header) => escape(entry[header])).join(','))].join('\n');
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

async function importPricingCsv(csv = '', actor = {}) {
  const lines = String(csv || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const items = lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = row[index];
    });
    if (entry.triggers) entry.triggers = String(entry.triggers).split('|').map((value) => value.trim()).filter(Boolean);
    if (entry.isActive !== undefined) entry.isActive = !['false', '0', 'no'].includes(String(entry.isActive).toLowerCase());
    return entry;
  });
  return savePricingItems(items, actor);
}

async function exportPricingCsv() {
  return toCsv(await listPricingItems({ includeInactive: true }));
}

async function pricingReports({ quotations = [], invoices = [], payments = [] } = {}) {
  const [categories, items] = await Promise.all([
    listCategories({ includeInactive: true }),
    listPricingItems({ includeInactive: true }),
  ]);
  const categoryMap = new Map(categories.map((category) => [category.categoryId, category.categoryName]));
  const counters = new Map();
  const revenue = new Map();
  const profit = new Map();
  const collectLines = (records = []) => {
    for (const record of records) {
      for (const line of record.lineItems || record.serviceItems || []) {
        const key = line.itemId || line.serviceName || 'unknown';
        counters.set(key, (counters.get(key) || 0) + Number(line.quantity || 1));
        revenue.set(key, (revenue.get(key) || 0) + Number(line.total || line.amount || 0));
        profit.set(key, (profit.get(key) || 0) + Number(line.profit || 0));
      }
    }
  };
  collectLines(quotations);
  collectLines(invoices);

  const itemById = new Map(items.map((entry) => [entry.itemId || entry.key, entry]));
  const serviceRows = Array.from(counters.entries()).map(([key, count]) => {
    const pricingItem = itemById.get(key) || {};
    return {
      itemId: key,
      serviceName: pricingItem.serviceName || key,
      categoryId: pricingItem.categoryId || '',
      categoryName: categoryMap.get(pricingItem.categoryId) || pricingItem.categoryId || 'Unknown',
      requests: count,
      revenue: revenue.get(key) || 0,
      profit: profit.get(key) || 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const paidRevenue = payments
    .filter((payment) => ['successful', 'received', 'paid'].includes(String(payment.status || payment.paymentStatus || '').toLowerCase()))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const averageProjectCost = quotations.length
    ? quotations.reduce((sum, quote) => sum + Number(quote.amount || quote.grandTotal || 0), 0) / quotations.length
    : 0;

  return {
    mostRequestedServices: [...serviceRows].sort((a, b) => b.requests - a.requests).slice(0, 10),
    highestRevenueServices: serviceRows.slice(0, 10),
    averageProjectCost,
    paidRevenue,
    profitMarginAnalysis: serviceRows.map((row) => ({
      ...row,
      profitMargin: row.revenue ? Number(((row.profit / row.revenue) * 100).toFixed(2)) : 0,
    })),
    mostProfitableCategories: Array.from(serviceRows.reduce((map, row) => {
      const current = map.get(row.categoryId) || { categoryId: row.categoryId, categoryName: row.categoryName, revenue: 0, profit: 0 };
      current.revenue += row.revenue;
      current.profit += row.profit;
      map.set(row.categoryId, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.profit - a.profit),
  };
}

module.exports = {
  BILLING_TYPES,
  DEFAULT_CATEGORIES,
  DEFAULT_ITEMS,
  archivePricingItem,
  calculateFromServiceSelections,
  createPricingItem,
  duplicatePricingItem,
  estimate,
  exportPricingCsv,
  importPricingCsv,
  listCategories,
  listPricingItems,
  pricingReports,
  saveCategories,
  savePricingItems,
};
