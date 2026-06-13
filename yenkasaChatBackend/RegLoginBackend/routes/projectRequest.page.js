const express = require('express');

const router = express.Router();

const PROJECT_CATEGORIES = ['Website', 'Mobile App', 'AI Solution', 'Software Development', 'UI/UX Design'];
const PROJECT_TYPES = [
  'Website Development',
  'Mobile App Development',
  'AI Solution Development',
  'Business Software',
  'UI/UX Design',
  'Cloud Infrastructure',
  'Custom Project',
  'Business Website',
  'E-commerce Store',
  'School Website',
  'Church Website',
  'Portfolio Website',
  'Blog/News Website',
  'Custom Web Application',
  'Mobile App',
  'Android App',
  'iOS App',
  'Cross-platform Mobile App',
  'Web + Mobile Platform',
  'AI Chatbot/Automation',
  'Business Software',
  'UI/UX Design Project',
];
const PAGES = ['Home', 'About Us', 'Services', 'Products', 'Gallery', 'Blog', 'Contact Us', 'FAQ', 'Login/Register', 'User Profile', 'Dashboard', 'Notifications', 'Payments', 'Admin', 'Other'];
const PLATFORMS = ['Website', 'Android App', 'iOS App', 'Web Dashboard', 'Admin Portal', 'Backend API', 'Desktop App', 'Not Sure'];
const FEATURES = ['Contact Form', 'Online Payments', 'User Registration/Login', 'Booking System', 'Live Chat', 'E-commerce Store', 'Admin Dashboard', 'File Uploads', 'Newsletter', 'Push Notifications', 'In-app Chat', 'API Integration', 'AI Assistant', 'Reports/Analytics', 'Custom Feature'];
const STATUSES = ['New', 'In Review', 'Proposal Sent', 'Approved', 'In Progress', 'Rejected', 'Completed'];
const SERVICES = [
  {
    title: 'Website Development',
    description: 'Professional business websites, landing pages, company profiles, blogs, and conversion-focused web presence.',
    features: ['Responsive pages', 'SEO-ready structure', 'Contact and lead forms', 'Analytics setup'],
    price: 'From GHS 2,000',
    duration: '1-3 weeks',
  },
  {
    title: 'Mobile App Development',
    description: 'Android, iOS, and cross-platform mobile apps for communities, commerce, bookings, communication, and internal operations.',
    features: ['Flutter apps', 'Authentication', 'Push notifications', 'API integration'],
    price: 'From GHS 8,000',
    duration: '4-10 weeks',
  },
  {
    title: 'Web Applications',
    description: 'Custom dashboards, portals, operational systems, SaaS tools, and workflow platforms.',
    features: ['Admin dashboards', 'Role-based access', 'Database workflows', 'Reporting'],
    price: 'From GHS 6,000',
    duration: '3-8 weeks',
  },
  {
    title: 'E-Commerce Systems',
    description: 'Online stores, product catalogs, payment flows, inventory management, and seller tools.',
    features: ['Product management', 'Payments', 'Order tracking', 'Customer accounts'],
    price: 'From GHS 5,000',
    duration: '3-6 weeks',
  },
  {
    title: 'Custom Software Solutions',
    description: 'Business-specific software for automation, internal teams, reporting, operations, and growth.',
    features: ['Workflow design', 'Custom database', 'Team permissions', 'Business reports'],
    price: 'From GHS 7,500',
    duration: '4-12 weeks',
  },
  {
    title: 'AI Solutions',
    description: 'AI assistants, retrieval systems, analytics intelligence, automation, and operational copilots.',
    features: ['AI chat flows', 'Data retrieval', 'Insight generation', 'Automation'],
    price: 'From GHS 10,000',
    duration: '4-12 weeks',
  },
  {
    title: 'UI/UX Design',
    description: 'Modern interface design for mobile apps, websites, portals, and internal platforms.',
    features: ['Wireframes', 'High-fidelity screens', 'Design systems', 'Prototype flows'],
    price: 'From GHS 2,500',
    duration: '1-4 weeks',
  },
  {
    title: 'API Development',
    description: 'Secure backend APIs, integrations, webhooks, authentication, and scalable service architecture.',
    features: ['REST APIs', 'Auth and roles', 'Webhook handling', 'Documentation'],
    price: 'From GHS 4,000',
    duration: '2-6 weeks',
  },
  {
    title: 'Cloud Deployment',
    description: 'Production deployment, backups, storage migration, server hardening, and failover readiness.',
    features: ['Cloud Run', 'Heroku', 'GCS storage', 'Monitoring'],
    price: 'From GHS 3,500',
    duration: '1-3 weeks',
  },
  {
    title: 'Technical Consulting',
    description: 'Architecture review, debugging, product planning, infrastructure decisions, and delivery strategy.',
    features: ['Architecture audit', 'Roadmap planning', 'Risk review', 'Implementation plan'],
    price: 'From GHS 800',
    duration: '1-5 days',
  },
];

function options(values) {
  return values.map((value) => `<option>${value}</option>`).join('');
}

function choices(name, values) {
  return values.map((value) => `<label class="choice"><input type="checkbox" name="${name}" value="${value}"><span>${value}</span></label>`).join('');
}

function pageShell({ title, body, extraHead = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://www.yenkasa.xyz/website-request">
  <title>${title}</title>
  <style>
    :root { --ink:#14211a; --muted:#617269; --line:#dce8e1; --brand:#147a49; --brand2:#0f5132; --bg:#f6faf7; --panel:#fff; --soft:#e9f5ed; --danger:#9b1c1c; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
    a { color:inherit; }
    .topbar { position:sticky; top:0; z-index:20; background:rgba(255,255,255,.95); border-bottom:1px solid var(--line); backdrop-filter:blur(12px); }
    .nav { max-width:1180px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .brand { display:flex; align-items:center; gap:10px; font-weight:800; text-decoration:none; }
    .mark { width:42px; height:42px; border-radius:8px; object-fit:cover; background:#10271b; }
    .nav-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .btn { appearance:none; border:0; background:var(--brand); color:white; border-radius:8px; padding:12px 16px; font-weight:800; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; min-height:44px; }
    .btn.secondary { background:var(--soft); color:var(--brand2); }
    .btn.ghost { background:white; color:var(--ink); border:1px solid var(--line); }
    .btn:disabled { opacity:.65; cursor:not-allowed; }
    .wrap { max-width:1180px; margin:0 auto; padding:34px 20px 60px; }
    .hero { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr); gap:26px; align-items:end; margin-bottom:24px; }
    h1 { font-size:clamp(2rem,4vw,4.1rem); line-height:1; margin:0 0 16px; letter-spacing:0; max-width:900px; }
    .lead { color:var(--muted); font-size:1.06rem; line-height:1.65; margin:0; max-width:740px; }
    .summary { background:#10271b; color:white; border-radius:8px; padding:22px; box-shadow:0 18px 40px rgba(20,33,26,.14); }
    .summary strong { display:block; font-size:1.65rem; margin-bottom:6px; }
    .summary span { color:#cfebd8; }
    .form { display:grid; gap:18px; }
    .section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:22px; box-shadow:0 10px 28px rgba(20,33,26,.05); }
    .section h2 { margin:0 0 16px; font-size:1.13rem; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
    .field { display:grid; gap:7px; }
    label { font-weight:750; font-size:.92rem; }
    input, select, textarea { width:100%; border:1px solid #cfdcd4; border-radius:8px; padding:12px 13px; font:inherit; background:white; color:var(--ink); min-height:44px; }
    textarea { min-height:112px; resize:vertical; line-height:1.5; }
    input:focus, select:focus, textarea:focus { outline:3px solid rgba(20,122,73,.18); border-color:var(--brand); }
    .choices { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .choice { border:1px solid var(--line); border-radius:8px; padding:10px; display:flex; gap:8px; align-items:flex-start; background:#fbfdfb; font-weight:650; min-height:44px; }
    .choice input { width:auto; min-height:auto; margin-top:3px; }
    .full { grid-column:1 / -1; }
    .error { color:var(--danger); font-weight:800; margin:0; display:none; }
    .success-note { color:var(--brand2); font-weight:800; display:none; }
    .foot { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; color:var(--muted); }
    .tabs { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px; }
    .tab { border:1px solid var(--line); background:white; color:var(--ink); border-radius:8px; padding:10px 14px; font-weight:800; cursor:pointer; }
    .tab.active { background:var(--brand); color:white; border-color:var(--brand); }
    .table-list article { border-bottom:1px solid var(--line); padding:18px 0; }
    .meta { color:var(--muted); line-height:1.6; }
    .auth-gate { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; align-items:center; margin-bottom:18px; }
    .auth-gate strong { display:block; font-size:1.15rem; margin-bottom:6px; }
    .hidden { display:none !important; }
    @media (max-width: 860px) { .hero, .grid { grid-template-columns:1fr; } .choices { grid-template-columns:1fr; } .wrap { padding-top:24px; } }
    @media (max-width: 640px) { .auth-gate { grid-template-columns:1fr; } }
  </style>
  ${extraHead}
</head>
<body>
  <header class="topbar">
    <nav class="nav">
      <a class="brand" href="/"><img class="mark" src="/images/logoYenkasaSoftOTechEmblem.png" alt="Yenkasa Soft-O-Tech"><span>Yenkasa Soft-O-Tech</span></a>
      <div class="nav-actions">
        <a class="btn ghost" href="/">Portfolio</a>
        <a class="btn ghost" href="/software-solutions">Software Solutions</a>
        <a class="btn ghost" href="/services">Services</a>
        <a class="btn ghost" href="/client/login?returnTo=/request-project">Client Login</a>
        <a class="btn secondary" href="/admin">Admin</a>
        <a class="btn" href="/request-project">Request a Project</a>
      </div>
    </nav>
  </header>
  ${body}
</body>
</html>`;
}

router.get('/website-request', (req, res) => {
  res.send(pageShell({
    title: 'Website & App Project Request | Yenkasa Soft-O-Tech',
    body: `<main class="wrap">
  <section class="hero">
    <div>
      <h1>Website & App Project Request</h1>
      <p class="lead">Register your client details and submit requirements for a website, mobile app, AI solution, business software, or UI/UX project.</p>
    </div>
    <aside class="summary"><strong>Client intake</strong><span>Request ID, secure file uploads, client profile, email confirmation, and admin workflow tracking.</span></aside>
  </section>

  <section class="section auth-gate" id="authGate">
    <div>
      <strong>Client login required</strong>
      <p class="lead" style="margin:0;">Create or login to your client account before the project details form becomes available. This keeps your request, invoice and files connected to your portal.</p>
    </div>
    <div class="actions">
      <a class="btn" href="/client/register?returnTo=/request-project">Register</a>
      <a class="btn ghost" href="/client/login?returnTo=/request-project">Login</a>
    </div>
  </section>

  <form id="requestForm" class="form hidden" enctype="multipart/form-data" novalidate>
    <section class="section"><h2>A. Client Registration</h2><div class="grid">
      <div class="field"><label for="fullName">Full Name</label><input id="fullName" name="fullName" autocomplete="name" required></div>
      <div class="field"><label for="companyName">Company/Organization Name</label><input id="companyName" name="companyName" autocomplete="organization"></div>
      <div class="field"><label for="phoneNumber">Phone Number</label><input id="phoneNumber" name="phoneNumber" autocomplete="tel" required></div>
      <div class="field"><label for="whatsappNumber">WhatsApp Number</label><input id="whatsappNumber" name="whatsappNumber" autocomplete="tel"></div>
      <div class="field"><label for="emailAddress">Email Address</label><input id="emailAddress" name="emailAddress" type="email" autocomplete="email" required></div>
      <div class="field"><label for="businessLocation">Business Location</label><input id="businessLocation" name="businessLocation"></div>
      <div class="field"><label for="preferredContactMethod">Preferred Contact Method</label><select id="preferredContactMethod" name="preferredContactMethod"><option value="">Select method</option><option>Email</option><option>Phone Call</option><option>WhatsApp</option><option>SMS</option></select></div>
      <div class="field"><label for="bestTimeToContact">Best Time to Contact</label><input id="bestTimeToContact" name="bestTimeToContact" placeholder="Weekdays 9am-5pm"></div>
    </div></section>

    <section class="section"><h2>B. Business Information</h2><div class="grid">
      <div class="field full"><label for="businessDescription">Business Description</label><textarea id="businessDescription" name="businessDescription" required></textarea></div>
      <div class="field"><label for="industryType">Industry Type</label><input id="industryType" name="industryType"></div>
      <div class="field"><label for="targetAudience">Target Audience</label><input id="targetAudience" name="targetAudience"></div>
    </div></section>

    <section class="section"><h2>C. Project Requirements</h2><div class="grid">
      <div class="field"><label for="requestCategory">Project Category</label><select id="requestCategory" name="requestCategory" required><option value="">Select category</option>${options(PROJECT_CATEGORIES)}</select></div>
      <div class="field"><label for="projectType">Project Type</label><select id="projectType" name="projectType" required><option value="">Select type</option>${options(PROJECT_TYPES)}</select></div>
      <div class="field full"><label>Target Platforms</label><div class="choices">${choices('platformsRequired', PLATFORMS)}</div></div>
      <div class="field full"><label>Pages or Screens Required</label><div class="choices">${choices('pagesRequired', PAGES)}</div></div>
    </div></section>

    <section class="section"><h2>D. Features Required</h2><div class="choices">${choices('featuresRequired', FEATURES)}</div></section>

    <section class="section"><h2>E. Design & Branding</h2><div class="grid">
      <div class="field"><label for="preferredColors">Preferred Colors</label><input id="preferredColors" name="preferredColors"></div>
      <div class="field"><label for="referenceWebsites">Reference Websites or Apps</label><input id="referenceWebsites" name="referenceWebsites" placeholder="https://example.com, app name, screenshots"></div>
      <div class="field"><label for="companyLogo">Upload Company Logo</label><input id="companyLogo" name="companyLogo" type="file" accept="image/*,.svg"></div>
      <div class="field"><label for="additionalFiles">Upload Additional Images/Documents</label><input id="additionalFiles" name="additionalFiles" type="file" multiple accept="image/*,.pdf,.doc,.docx"></div>
    </div></section>

    <section class="section"><h2>F. Project Details</h2><div class="grid">
      <div class="field"><label for="budgetRange">Budget Range</label><select id="budgetRange" name="budgetRange"><option value="">Select range</option><option>Under GHS 2,000</option><option>GHS 2,000 - GHS 5,000</option><option>GHS 5,000 - GHS 10,000</option><option>GHS 10,000 - GHS 25,000</option><option>Above GHS 25,000</option></select></div>
      <div class="field"><label for="desiredCompletionDate">Desired Completion Date</label><input id="desiredCompletionDate" name="desiredCompletionDate" type="date"></div>
      <div class="field full"><label for="additionalNotes">Additional Notes</label><textarea id="additionalNotes" name="additionalNotes"></textarea></div>
    </div></section>

    <section class="section foot">
      <div class="summary" id="estimateBox" style="margin-bottom:18px;align-items:flex-start;"><strong>Estimated Price</strong><span id="estimateText">Select project type, platforms, pages and features to see an automatic estimate.</span></div>
      <p class="error" id="errorBox"></p>
      <p class="success-note" id="successBox">Submitting request...</p>
      <button class="btn" id="submitBtn" type="submit">Submit Project Request</button>
    </section>
  </form>
</main>
<script>
const form = document.getElementById('requestForm');
const authGate = document.getElementById('authGate');
const button = document.getElementById('submitBtn');
const errorBox = document.getElementById('errorBox');
const successBox = document.getElementById('successBox');
const estimateText = document.getElementById('estimateText');
let portalClient = null;
function portalToken() {
  return localStorage.getItem('softOTechPortalToken') || '';
}
function setField(id, value) {
  const field = document.getElementById(id);
  if (field && value && !field.value) field.value = value;
}
async function requireClientLogin() {
  const token = portalToken();
  if (!token) return;
  try {
    const response = await fetch('/api/project-portal/me', {
      headers: {Authorization: 'Bearer ' + token}
    });
    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.client || payload.client.is_admin) return;
    portalClient = payload.client;
    authGate.classList.add('hidden');
    form.classList.remove('hidden');
    setField('fullName', portalClient.fullName);
    setField('companyName', portalClient.companyName);
    setField('phoneNumber', portalClient.phoneNumber);
    setField('whatsappNumber', portalClient.whatsappNumber);
    setField('emailAddress', portalClient.email);
    setField('businessLocation', portalClient.businessLocation);
    setField('preferredContactMethod', portalClient.preferredContactMethod);
    setField('bestTimeToContact', portalClient.bestTimeToContact);
    updateEstimate();
  } catch (error) {
    localStorage.removeItem('softOTechPortalToken');
  }
}
function formJson() {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) {
    if (['pagesRequired','featuresRequired','platformsRequired'].includes(key)) {
      payload[key] = payload[key] || [];
      payload[key].push(value);
    } else if (typeof value === 'string') {
      payload[key] = value;
    }
  }
  return payload;
}
function money(value, currency) {
  return (currency || 'GHS') + ' ' + Number(value || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
}
let estimateTimer = null;
async function updateEstimate() {
  clearTimeout(estimateTimer);
  estimateTimer = setTimeout(async () => {
    try {
      const response = await fetch('/api/project-requests/estimate', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(formJson())
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Estimate unavailable.');
      const estimate = payload.estimate || {};
      const items = (estimate.lineItems || []).slice(0, 6).map(item => item.description + ': ' + money(item.total, estimate.currency)).join('<br>');
      estimateText.innerHTML = '<b>' + money(estimate.grandTotal, estimate.currency) + '</b><br>' + (items || 'No priced items selected yet.');
    } catch (error) {
      estimateText.textContent = error.message;
    }
  }, 250);
}
form.addEventListener('change', updateEstimate);
form.addEventListener('input', updateEstimate);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.style.display = 'none';
  successBox.style.display = 'block';
  button.disabled = true;
  try {
    const token = portalToken();
    if (!token || !portalClient) throw new Error('Please login as a client before submitting project details.');
    const response = await fetch('/api/project-requests', {
      method: 'POST',
      headers: {Authorization: 'Bearer ' + token},
      body: new FormData(form)
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Request failed.');
    const params = new URLSearchParams({ requestId: payload.requestId });
    if (payload.invoice && payload.invoice.url) params.set('invoiceUrl', payload.invoice.url);
    window.location.href = '/website-request/success?' + params.toString();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.style.display = 'block';
    successBox.style.display = 'none';
    button.disabled = false;
  }
});
requireClientLogin();
</script>`,
  }));
});

router.get('/website-request/success', (req, res) => {
  const requestId = String(req.query.requestId || '').replace(/[^A-Z0-9-]/gi, '');
  const invoiceUrl = String(req.query.invoiceUrl || '').replace(/"/g, '&quot;');
  res.send(pageShell({
    title: 'Request Submitted | Yenkasa Soft-O-Tech',
    body: `<main class="wrap"><section class="section" style="max-width:760px;margin:40px auto;">
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);">Request submitted</h1>
      <p class="lead">Your project request and client contact profile have been received. Keep this Request ID for follow-up.</p>
      <div class="summary" style="margin:22px 0;"><strong>${requestId || 'Request received'}</strong><span>Yenkasa Soft-O-Tech will review the details and contact you. Your invoice PDF has been generated from the selected project details.</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">${invoiceUrl ? `<a class="btn" target="_blank" rel="noopener" href="${invoiceUrl}">Download Invoice PDF</a>` : ''}<a class="btn secondary" href="/">Back to Portfolio</a></div>
    </section></main>`,
  }));
});

router.get('/admin/project-requests', (req, res) => {
  res.send(pageShell({
    title: 'Project Requests Admin | Yenkasa Soft-O-Tech',
    body: `<main class="wrap">
  <section class="hero"><div><h1>Project Requests</h1><p class="lead">Manage website, app, software, AI, and UI/UX leads captured from www.yenkasa.xyz.</p></div><aside class="summary"><strong id="totalCount">--</strong><span>Total captured inquiries</span></aside></section>
  <section class="section"><div class="grid">
    <div class="field full"><label for="token">Soft-O-Tech Admin Login Token</label><input id="token" type="password" placeholder="Login as admin/senior developer or paste portal token"></div>
    <div class="field"><label for="search">Search</label><input id="search" placeholder="Request ID, client, company, email, phone"></div>
    <div class="field"><label for="status">Status</label><select id="status"><option value="">All statuses</option>${options(STATUSES)}</select></div>
    <div class="field"><label for="from">From</label><input id="from" type="date"></div>
    <div class="field"><label for="to">To</label><input id="to" type="date"></div>
  </div><div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" id="loadBtn">Load Requests</button><button class="btn secondary" id="clientsBtn">Load Clients</button><button class="btn secondary" id="analyticsBtn">Load Analytics</button><a class="btn ghost" href="/client/login?returnTo=/admin/project-requests">Admin Login</a></div><p class="error" id="adminError"></p></section>
  <div class="tabs"><button class="tab active" data-panel="requestsPanel">Requests</button><button class="tab" data-panel="clientsPanel">Clients</button><button class="tab" data-panel="analyticsPanel">Analytics</button></div>
  <section class="section table-list" id="requestsPanel"><p class="lead">Enter an admin token and load requests.</p></section>
  <section class="section table-list" id="clientsPanel" style="display:none;"><p class="lead">Load clients to view registered lead profiles.</p></section>
  <section class="section" id="analyticsPanel" style="display:none;"><p class="lead">Load analytics to view request trends.</p></section>
</main>
<script>
const token = document.getElementById('token');
const errorBox = document.getElementById('adminError');
const panels = {
  requestsPanel: document.getElementById('requestsPanel'),
  clientsPanel: document.getElementById('clientsPanel'),
  analyticsPanel: document.getElementById('analyticsPanel')
};
const totalCount = document.getElementById('totalCount');
token.value = localStorage.getItem('softOTechPortalToken') || '';
token.addEventListener('input', () => localStorage.setItem('softOTechPortalToken', token.value.trim()));
function headers() { return { 'Authorization': 'Bearer ' + token.value.trim(), 'Content-Type': 'application/json' }; }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function showPanel(id) {
  Object.entries(panels).forEach(([key, panel]) => { panel.style.display = key === id ? 'block' : 'none'; });
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.panel === id));
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showPanel(tab.dataset.panel)));
async function loadRequests() {
  errorBox.style.display = 'none';
  const params = new URLSearchParams();
  ['search','status','from','to'].forEach(id => { const value = document.getElementById(id).value; if (value) params.set(id, value); });
  const response = await fetch('/api/project-portal/admin/project-requests?' + params.toString(), { headers: headers() });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load requests.');
  showPanel('requestsPanel');
  totalCount.textContent = payload.total;
  if (!payload.items.length) { panels.requestsPanel.innerHTML = '<p class="lead">No requests match the filters.</p>'; return; }
  panels.requestsPanel.innerHTML = payload.items.map(item => {
    const files = (item.files || []).map(file => '<a class="btn ghost" target="_blank" rel="noopener" href="' + escapeHtml(file.url) + '">' + escapeHtml(file.originalName) + '</a>').join(' ');
    const invoice = item.invoice || {};
    const estimate = item.pricingEstimate || {};
    const contact = item.contact || {};
    const req = item.requirements || {};
    return '<article>' +
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><h2 style="margin:0;">' + escapeHtml(item.requestId) + '</h2><select data-id="' + escapeHtml(item.requestId) + '" class="statusSelect">' + ${JSON.stringify(STATUSES)}.map(status => '<option ' + (status === item.status ? 'selected' : '') + '>' + status + '</option>').join('') + '</select></div>' +
      '<p><strong>' + escapeHtml(contact.fullName) + '</strong> - ' + escapeHtml(contact.companyName) + ' - ' + escapeHtml(contact.email) + '</p>' +
      '<p class="meta">Phone: ' + escapeHtml(contact.phoneNumber) + ' | WhatsApp: ' + escapeHtml(contact.whatsappNumber) + ' | Preferred: ' + escapeHtml(contact.preferredContactMethod) + ' | Best time: ' + escapeHtml(contact.bestTimeToContact) + '</p>' +
      '<p class="meta">' + escapeHtml(item.requestCategory) + ' | ' + escapeHtml(req.projectType || req.websiteType) + ' | Platforms: ' + escapeHtml((req.platformsRequired || []).join(", ")) + '</p>' +
      '<p class="meta">Pages/Screens: ' + escapeHtml((req.pagesRequired || []).join(", ")) + ' | Features: ' + escapeHtml((req.featuresRequired || []).join(", ")) + '</p>' +
      '<p class="meta">Estimated Invoice: ' + escapeHtml((estimate.currency || 'GHS') + ' ' + Number(estimate.grandTotal || invoice.amount || 0).toLocaleString()) + (invoice.url ? ' | <a target="_blank" rel="noopener" href="' + escapeHtml(invoice.url) + '">Download invoice PDF</a>' : '') + '</p>' +
      '<p>' + escapeHtml(item.business?.description) + '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + files + '</div>' +
    '</article>';
  }).join('');
}
async function loadClients() {
  errorBox.style.display = 'none';
  const params = new URLSearchParams();
  const search = document.getElementById('search').value;
  if (search) params.set('search', search);
  const response = await fetch('/api/project-portal/admin/project-request-clients?' + params.toString(), { headers: headers() });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load clients.');
  showPanel('clientsPanel');
  totalCount.textContent = payload.total;
  if (!payload.items.length) { panels.clientsPanel.innerHTML = '<p class="lead">No client profiles match the search.</p>'; return; }
  panels.clientsPanel.innerHTML = payload.items.map(client => '<article>' +
    '<h2 style="margin:0 0 8px;">' + escapeHtml(client.fullName || client.email) + '</h2>' +
    '<p><strong>' + escapeHtml(client.companyName) + '</strong> - ' + escapeHtml(client.email) + '</p>' +
    '<p class="meta">Phone: ' + escapeHtml(client.phoneNumber) + ' | WhatsApp: ' + escapeHtml(client.whatsappNumber) + ' | Location: ' + escapeHtml(client.businessLocation) + '</p>' +
    '<p class="meta">Preferred: ' + escapeHtml(client.preferredContactMethod) + ' | Best time: ' + escapeHtml(client.bestTimeToContact) + '</p>' +
    '<p class="meta">Requests: ' + escapeHtml(client.requestCount) + ' | Latest: ' + escapeHtml(client.latestRequestId) + ' | ' + escapeHtml(client.latestProjectType) + '</p>' +
  '</article>').join('');
}
async function updateStatus(requestId, status) {
  const response = await fetch('/api/project-portal/admin/project-requests/' + encodeURIComponent(requestId) + '/status', {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ status })
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not update status.');
}
document.getElementById('loadBtn').addEventListener('click', async () => { try { await loadRequests(); } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; } });
document.getElementById('clientsBtn').addEventListener('click', async () => { try { await loadClients(); } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; } });
document.getElementById('analyticsBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/project-portal/admin/project-request-analytics', { headers: headers() });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load analytics.');
    showPanel('analyticsPanel');
    panels.analyticsPanel.innerHTML = '<h2>Analytics</h2><p>Total: ' + payload.total + ' | Conversion rate: ' + payload.conversionRate + '% | Storage: ' + escapeHtml(payload.storageProvider) + '</p><p>Categories: ' + (payload.byCategory || []).map(i => escapeHtml(i.category) + ' (' + i.count + ')').join(', ') + '</p><p>Types: ' + payload.byType.map(i => escapeHtml(i.type) + ' (' + i.count + ')').join(', ') + '</p><p>Monthly: ' + payload.monthly.map(i => escapeHtml(i.month) + ' (' + i.count + ')').join(', ') + '</p>';
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
panels.requestsPanel.addEventListener('change', async (event) => {
  if (!event.target.classList.contains('statusSelect')) return;
  try { await updateStatus(event.target.dataset.id, event.target.value); } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
</script>`,
  }));
});

router.get('/request-project', (req, res) => {
  res.redirect(302, '/website-request');
});

router.get('/services', (req, res) => {
  res.send(pageShell({
    title: 'Services | Yenkasa Soft-O-Tech',
    extraHead: `<style>
      .services-hero { min-height:420px; display:grid; align-items:end; padding:70px 0 32px; }
      .service-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
      .service-card { background:white; border:1px solid var(--line); border-radius:8px; padding:22px; box-shadow:0 10px 28px rgba(20,33,26,.05); display:grid; gap:14px; }
      .service-card h2 { margin:0; font-size:1.2rem; }
      .service-card p { margin:0; color:var(--muted); line-height:1.6; }
      .feature-list { margin:0; padding-left:18px; color:#314238; line-height:1.7; }
      .service-meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .meta-box { background:#f6faf7; border:1px solid var(--line); border-radius:8px; padding:12px; }
      .meta-box span { display:block; color:var(--muted); font-size:.82rem; font-weight:700; margin-bottom:4px; }
      .portfolio-strip, .trust-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; }
      .mini-card { background:white; border:1px solid var(--line); border-radius:8px; padding:20px; box-shadow:0 10px 28px rgba(20,33,26,.05); }
      .mini-card h3 { margin:0 0 8px; }
      .mini-card p { margin:0; color:var(--muted); line-height:1.55; }
      .process { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
      .process .mini-card strong { display:grid; place-items:center; width:34px; height:34px; border-radius:8px; background:#e9f5ed; color:var(--brand2); margin-bottom:12px; }
      @media (max-width: 980px) { .service-grid, .portfolio-strip, .trust-grid, .process { grid-template-columns:1fr 1fr; } }
      @media (max-width: 640px) { .service-grid, .portfolio-strip, .trust-grid, .process { grid-template-columns:1fr; } .services-hero { min-height:auto; padding-top:34px; } }
    </style>`,
    body: `<main class="wrap">
      <section class="services-hero">
        <div>
          <h1>Software services for serious businesses.</h1>
          <p class="lead">Yenkasa Soft-O-Tech builds websites, mobile apps, AI tools, cloud systems, and custom software with professional delivery workflows and client project tracking.</p>
          <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;"><a class="btn" href="/request-project">Request a Project</a><a class="btn ghost" href="/software-solutions">Software Solutions Portal</a><a class="btn ghost" href="/client/login">Client Portal</a></div>
        </div>
      </section>

      <section class="service-grid">${SERVICES.map((service) => `<article class="service-card">
        <h2>${service.title}</h2>
        <p>${service.description}</p>
        <ul class="feature-list">${service.features.map((feature) => `<li>${feature}</li>`).join('')}</ul>
        <div class="service-meta"><div class="meta-box"><span>Starting From</span><strong>${service.price}</strong></div><div class="meta-box"><span>Estimated Duration</span><strong>${service.duration}</strong></div></div>
        <a class="btn" href="/request-project?service=${encodeURIComponent(service.title)}">Request Service</a>
      </article>`).join('')}</section>

      <section class="section" style="margin-top:26px;"><h2>Featured Platforms</h2><div class="portfolio-strip">
        <article class="mini-card"><h3>Yenkasa App</h3><p>Community, chat, livestream, rewards, moderation, and operational intelligence platform.</p></article>
        <article class="mini-card"><h3>Yenkasa Store</h3><p>Commerce tooling for products, vendors, payments, and customer acquisition.</p></article>
        <article class="mini-card"><h3>YenkasaAI</h3><p>Operational intelligence, repository awareness, incident analysis, and executive insights.</p></article>
        <article class="mini-card"><h3>Client Projects</h3><p>Custom websites, portals, dashboards, cloud deployments, and business automation systems.</p></article>
      </div></section>

      <section class="section"><h2>Development Process</h2><div class="process">
        <article class="mini-card"><strong>1</strong><h3>Discovery</h3><p>Requirements, business goals, technical risks, and success criteria.</p></article>
        <article class="mini-card"><strong>2</strong><h3>Design</h3><p>Wireframes, screens, information architecture, and delivery plan.</p></article>
        <article class="mini-card"><strong>3</strong><h3>Build</h3><p>Frontend, backend, database, integrations, and admin workflows.</p></article>
        <article class="mini-card"><strong>4</strong><h3>Test</h3><p>QA, security review, deployment checks, and performance verification.</p></article>
        <article class="mini-card"><strong>5</strong><h3>Launch</h3><p>Cloud deployment, handoff, training, support, and growth planning.</p></article>
      </div></section>

      <section class="section"><h2>Team</h2><div class="trust-grid">
        <article class="mini-card"><h3>Bright Kofi Ofosu Menya</h3><p>Founder & CEO</p></article>
        <article class="mini-card"><h3>Arhinful Hudson</h3><p>Frontend Developer</p></article>
        <article class="mini-card"><h3>Elorm Wisdom</h3><p>Backend Engineer</p></article>
        <article class="mini-card"><h3>Ruth Awini</h3><p>Financial Director & Head of Marketing</p></article>
      </div></section>

      <section class="section"><h2>FAQ</h2><div class="grid">
        <article class="mini-card"><h3>How do we start?</h3><p>Submit a project request. The team reviews it and follows up with questions, timeline, and quotation.</p></article>
        <article class="mini-card"><h3>Can I track progress?</h3><p>Yes. Approved clients get portal access for updates, files, messages, invoices, and project status.</p></article>
        <article class="mini-card"><h3>Do you handle deployment?</h3><p>Yes. We support Cloud Run, Heroku, DigitalOcean, storage, backups, and failover planning.</p></article>
        <article class="mini-card"><h3>Do you build AI systems?</h3><p>Yes. We build AI assistants, retrieval systems, operational intelligence, and automation tools.</p></article>
      </div></section>
    </main>`,
  }));
});

module.exports = router;
