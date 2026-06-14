const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const DEFAULT_PROJECT_ID = 'project-10405180-0afd-4ecc-9f8';
const DEFAULT_COLLECTION = 'softotech_portfolio_content';
const DEFAULT_DOC_ID = 'main';

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

function collectionName() {
  return process.env.PORTFOLIO_CONTENT_COLLECTION || DEFAULT_COLLECTION;
}

function documentId() {
  return process.env.PORTFOLIO_CONTENT_DOC_ID || DEFAULT_DOC_ID;
}

function defaultContent() {
  return {
    products: [
      { id: 'app', name: 'Yenkasa App', description: 'Yenkasa App is the social and community hub of the ecosystem. It brings together communities, posts, chat, livestreaming, wallet activity, creator rewards, and moderation into one mobile-first experience.\n\nThe product is built for real Ghanaian community activity: students, creators, organizations, sellers, and local groups can communicate, publish, earn, and manage engagement from a single platform.', status: 'Live product', stack: ['Kotlin', 'Node.js', 'MongoDB', 'Socket.IO', 'Cloudinary', 'Agora'], achievements: ['Communities', 'Livestreaming', 'Wallet'], screenshots: [], videos: [] },
      { id: 'store', name: 'Yenkasa Store', description: 'Yenkasa Store extends the platform into commerce. It supports seller onboarding, product catalogs, order flows, payments, and commission-based business activity.\n\nThe goal is to help communities and vendors sell inside the same ecosystem where users already discover content, creators, and trusted local businesses.', status: 'Launched commerce pillar', stack: ['Web', 'Node.js', 'Paystack'], achievements: ['Seller onboarding', 'Catalog', 'Payments'], screenshots: [], videos: [] },
      { id: 'ai', name: 'YenkasaAI', description: 'YenkasaAI is the operational intelligence layer behind the ecosystem. It monitors platform activity, repository knowledge, incidents, memory, analytics, and executive insight generation.\n\nIt is designed to help the team understand what is happening across Yenkasa products, detect failures quickly, and support agents that can reason over code, operations, and business data.', status: 'Cloud Run deployed', stack: ['FastAPI', 'Python', 'PostgreSQL', 'Chroma', 'Google Cloud', 'Gemini'], achievements: ['Cloud Run', 'Memory Engine', 'OCR', 'AI Insights'], screenshots: [], videos: [] },
      { id: 'ecosystem', name: 'Yenkasa Ecosystem', description: 'The Yenkasa Ecosystem connects social networking, commerce, AI, public web, and client software services into one long-term product strategy.\n\nEach pillar supports the others: the app creates engagement, the store enables transactions, YenkasaAI provides intelligence, and Soft-O-Tech turns the same engineering capability into client solutions.', status: 'Current product overview', stack: ['Mobile', 'Web', 'AI', 'Cloud', 'Commerce'], achievements: ['App', 'Store', 'AI', 'Client operations'], screenshots: [], videos: [] },
      { id: 'web', name: 'Yenkasa Web', description: 'Yenkasa Web is the public-facing layer for brand trust, product discovery, policies, validation pages, and ecosystem storytelling.\n\nIt gives users, partners, and clients a structured way to understand the products, access support surfaces, and move into the correct app, store, AI, or client project workflow.', status: 'Public web presence', stack: ['HTML', 'CSS', 'JavaScript'], achievements: ['Official website', 'Policy pages', 'SEO'], screenshots: [], videos: [] },
      { id: 'services', name: 'Soft-O-Tech Services', description: 'Soft-O-Tech Services turns Yenkasa engineering into a client delivery business. It covers websites, mobile apps, AI solutions, cloud deployments, dashboards, integrations, and custom software.\n\nThe project portal, pricing catalog, quotation workflow, admin dashboard, and GCS media storage are designed to support professional delivery from first request to final handoff.', status: 'Client acquisition platform', stack: ['Firestore', 'GCS', 'Node.js', 'Project Portal'], achievements: ['Project requests', 'Client portal', 'Admin dashboard'], screenshots: [], videos: [] },
      { id: 'client-projects', name: 'Client Projects', description: 'Client Projects will hold case studies, media, screenshots, videos, and delivery summaries for work completed through Yenkasa Soft-O-Tech.\n\nThis area is structured so each future contract can become a professional portfolio entry showing the business problem, implemented solution, technology used, and measurable outcome.', status: 'Ready for uploads', stack: ['Web', 'Mobile', 'AI', 'Cloud'], achievements: ['Reusable case study structure'], screenshots: [], videos: [] },
      { id: 'future', name: 'Future Products', description: 'Future Products captures the roadmap for upcoming tools across organizations, intelligence, commerce, creators, and business automation.\n\nThe aim is to keep the ecosystem expandable without losing operational discipline: new products should connect to the same identity, data, AI, infrastructure, and client-service foundations.', status: 'Roadmap direction', stack: ['AI', 'Cloud', 'Mobile', 'Web'], achievements: ['Ecosystem foundation'], screenshots: [], videos: [] },
    ],
    teamMembers: [
      { id: 'bright-kofi-ofosu-menya', name: 'Bright Kofi Ofosu Menya', role: 'Founder & CEO', photo: '/images/default.png', background: 'Founder, product builder, and Yenkasa ecosystem lead.', fieldOfStudy: 'To be added.', major: 'Software leadership, product architecture, and AI systems.' },
      { id: 'arhinful-hudson', name: 'Arhinful Hudson', role: 'Frontend Developer', photo: '/images/default.png', background: 'Frontend development team member.', fieldOfStudy: 'To be added.', major: 'Frontend engineering and user interface implementation.' },
      { id: 'elorm-wisdom', name: 'Elorm Wisdom', role: 'Backend Engineer', photo: '/images/default.png', background: 'Backend engineering team member.', fieldOfStudy: 'To be added.', major: 'Backend systems, APIs, databases, and integrations.' },
      { id: 'ruth-awini', name: 'Ruth Awini', role: 'Financial Director & Head of Marketing', photo: '/images/default.png', background: 'Finance and marketing leadership team member.', fieldOfStudy: 'To be added.', major: 'Finance, marketing strategy, and business operations.' },
      { id: 'joana-amoquandoh-ayeyi', name: 'Joana Amoquandoh Ayeyi', role: 'Project Manager', photo: '/images/default.png', background: 'Project manager supporting Yenkasa Soft-O-Tech client delivery and coordination.', fieldOfStudy: 'Computer Science Student, Accra Technical University (ATU).', major: 'Project coordination, client communication, requirements tracking, and delivery support.' },
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
    const fallbackProduct = byId.get(product.id);
    const merged = { ...fallbackProduct, ...product };
    if (fallbackProduct?.description && String(product.description || '').trim().length < 160) {
      merged.description = fallbackProduct.description;
    }
    byId.set(product.id, merged);
  }
  const teamSource = normalizeArray(content?.teamMembers || content?.team);
  const teamMembers = (teamSource.length ? teamSource : fallback.teamMembers).map((item) => ({
    id: String(item?.id || item?.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    name: String(item?.name || '').trim(),
    role: String(item?.role || '').trim(),
    photo: String(item?.photo || item?.image || '/images/default.png').trim(),
    background: String(item?.background || '').trim(),
    fieldOfStudy: String(item?.fieldOfStudy || item?.field || '').trim(),
    major: String(item?.major || '').trim(),
  })).filter((item) => item.id && item.name);
  return {
    products: Array.from(byId.values()),
    teamMembers,
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

async function updateTeamMemberPhoto(teamMemberId, photoUrl, actor = {}) {
  const id = String(teamMemberId || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const url = String(photoUrl || '').trim();
  if (!id || !url) return getContent();
  const content = await getContent();
  const teamMembers = normalizeArray(content.teamMembers).map((member) => (
    member.id === id ? { ...member, photo: url } : member
  ));
  const exists = teamMembers.some((member) => member.id === id);
  const nextContent = {
    ...content,
    teamMembers: exists ? teamMembers : [...teamMembers, { id, name: id.replace(/-/g, ' '), role: 'Team Member', photo: url, background: '', fieldOfStudy: '', major: '' }],
  };
  return saveContent(nextContent, actor);
}

module.exports = {
  collectionName,
  defaultContent,
  getContent,
  saveContent,
  updateTeamMemberPhoto,
};
