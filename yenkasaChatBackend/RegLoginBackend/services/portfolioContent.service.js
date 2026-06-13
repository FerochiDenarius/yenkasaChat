const admin = require('firebase-admin');

const DEFAULT_PROJECT_ID = 'project-10405180-0afd-4ecc-9f8';
const DEFAULT_COLLECTION = 'softotech_portfolio_content';
const DEFAULT_DOC_ID = 'main';

function firestoreProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    DEFAULT_PROJECT_ID;
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
  return admin.firestore();
}

function collectionName() {
  return process.env.PORTFOLIO_CONTENT_COLLECTION || DEFAULT_COLLECTION;
}

function documentId() {
  return process.env.PORTFOLIO_CONTENT_DOC_ID || DEFAULT_DOC_ID;
}

function defaultContent() {
  return {
    products: [
      { id: 'app', name: 'Yenkasa App', description: 'Social networking, communities, livestreaming, chat, wallet, rewards and YKC economy.', status: 'Live product', stack: ['Kotlin', 'Node.js', 'MongoDB', 'Socket.IO', 'Cloudinary', 'Agora'], achievements: ['Communities', 'Livestreaming', 'Wallet'], screenshots: [], videos: [] },
      { id: 'store', name: 'Yenkasa Store', description: 'Seller onboarding, product catalog, orders, payments and commission-based commerce.', status: 'Launched commerce pillar', stack: ['Web', 'Node.js', 'Paystack'], achievements: ['Seller onboarding', 'Catalog', 'Payments'], screenshots: [], videos: [] },
      { id: 'ai', name: 'YenkasaAI', description: 'Operational Intelligence Platform for monitoring, analysis, memory, insights and anomaly detection.', status: 'Cloud Run deployed', stack: ['FastAPI', 'Python', 'PostgreSQL', 'Chroma', 'Google Cloud', 'Gemini'], achievements: ['Cloud Run', 'Memory Engine', 'OCR', 'AI Insights'], screenshots: [], videos: [] },
      { id: 'ecosystem', name: 'Yenkasa Ecosystem', description: 'Current product system across Yenkasa App, Store, AI, Web and Soft-O-Tech services.', status: 'Current product overview', stack: ['Mobile', 'Web', 'AI', 'Cloud', 'Commerce'], achievements: ['App', 'Store', 'AI', 'Client operations'], screenshots: [], videos: [] },
      { id: 'web', name: 'Yenkasa Web', description: 'Public web, validation, policy, product pages and web-based ecosystem surfaces.', status: 'Public web presence', stack: ['HTML', 'CSS', 'JavaScript'], achievements: ['Official website', 'Policy pages', 'SEO'], screenshots: [], videos: [] },
      { id: 'services', name: 'Soft-O-Tech Services', description: 'Client websites, apps, AI solutions, cloud deployments and custom software projects.', status: 'Client acquisition platform', stack: ['Firestore', 'GCS', 'Node.js', 'Project Portal'], achievements: ['Project requests', 'Client portal', 'Admin dashboard'], screenshots: [], videos: [] },
      { id: 'client-projects', name: 'Client Projects', description: 'Portfolio media and case studies for future client work.', status: 'Ready for uploads', stack: ['Web', 'Mobile', 'AI', 'Cloud'], achievements: ['Reusable case study structure'], screenshots: [], videos: [] },
      { id: 'future', name: 'Future Products', description: 'Upcoming tools for organizations, intelligence, commerce and creator growth.', status: 'Roadmap direction', stack: ['AI', 'Cloud', 'Mobile', 'Web'], achievements: ['Ecosystem foundation'], screenshots: [], videos: [] },
    ],
    milestones: [],
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
}

function cleanProduct(product) {
  return {
    id: String(product?.id || '').trim(),
    name: String(product?.name || '').trim(),
    description: String(product?.description || '').trim(),
    status: String(product?.status || '').trim(),
    stack: normalizeArray(product?.stack).map((item) => String(item).trim()).filter(Boolean),
    achievements: normalizeArray(product?.achievements).map((item) => String(item).trim()).filter(Boolean),
    screenshots: normalizeArray(product?.screenshots).map((item) => ({
      title: String(item?.title || '').trim(),
      src: String(item?.src || item?.url || '').trim(),
    })).filter((item) => item.title && item.src),
    videos: normalizeArray(product?.videos).map((item) => ({
      title: String(item?.title || '').trim(),
      src: String(item?.src || item?.url || '').trim(),
    })).filter((item) => item.title && item.src),
  };
}

function cleanContent(content) {
  const fallback = defaultContent();
  const products = normalizeArray(content?.products).map(cleanProduct).filter((product) => product.id);
  const byId = new Map(fallback.products.map((product) => [product.id, product]));
  for (const product of products) {
    byId.set(product.id, { ...byId.get(product.id), ...product });
  }
  return {
    products: Array.from(byId.values()),
    milestones: normalizeArray(content?.milestones).map((item) => ({
      date: String(item?.date || '').trim(),
      title: String(item?.title || '').trim(),
      description: String(item?.description || '').trim(),
    })).filter((item) => item.date && item.title),
  };
}

async function getContent() {
  const ref = firestoreDb().collection(collectionName()).doc(documentId());
  const doc = await ref.get();
  if (!doc.exists) return defaultContent();
  return cleanContent(doc.data());
}

async function saveContent(content, actor = {}) {
  const clean = cleanContent(content);
  const ref = firestoreDb().collection(collectionName()).doc(documentId());
  await ref.set({
    ...clean,
    updatedAt: new Date(),
    updatedBy: actor.email || actor.id || 'portfolio-admin',
  }, { merge: true });
  return clean;
}

module.exports = {
  collectionName,
  defaultContent,
  getContent,
  saveContent,
};
