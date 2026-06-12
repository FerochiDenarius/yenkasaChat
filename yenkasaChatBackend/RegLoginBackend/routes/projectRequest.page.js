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
    @media (max-width: 860px) { .hero, .grid { grid-template-columns:1fr; } .choices { grid-template-columns:1fr; } .wrap { padding-top:24px; } }
  </style>
  ${extraHead}
</head>
<body>
  <header class="topbar">
    <nav class="nav">
      <a class="brand" href="/web"><img class="mark" src="/web/images/yenkasa-soft-o-tech-emblem.png" alt="Yenkasa Soft-O-Tech"><span>Yenkasa Soft-O-Tech</span></a>
      <div class="nav-actions">
        <a class="btn ghost" href="/web">Home</a>
        <a class="btn ghost" href="/client/login">Client Login</a>
        <a class="btn secondary" href="/admin">Admin</a>
        <a class="btn" href="/website-request">Request a Project</a>
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

  <form id="requestForm" class="form" enctype="multipart/form-data" novalidate>
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
      <p class="error" id="errorBox"></p>
      <p class="success-note" id="successBox">Submitting request...</p>
      <button class="btn" id="submitBtn" type="submit">Register Client & Submit Request</button>
    </section>
  </form>
</main>
<script>
const form = document.getElementById('requestForm');
const button = document.getElementById('submitBtn');
const errorBox = document.getElementById('errorBox');
const successBox = document.getElementById('successBox');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.style.display = 'none';
  successBox.style.display = 'block';
  button.disabled = true;
  try {
    const response = await fetch('/api/project-requests', { method: 'POST', body: new FormData(form) });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Request failed.');
    window.location.href = '/website-request/success?requestId=' + encodeURIComponent(payload.requestId);
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.style.display = 'block';
    successBox.style.display = 'none';
    button.disabled = false;
  }
});
</script>`,
  }));
});

router.get('/website-request/success', (req, res) => {
  const requestId = String(req.query.requestId || '').replace(/[^A-Z0-9-]/gi, '');
  res.send(pageShell({
    title: 'Request Submitted | Yenkasa Soft-O-Tech',
    body: `<main class="wrap"><section class="section" style="max-width:760px;margin:40px auto;">
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);">Request submitted</h1>
      <p class="lead">Your project request and client contact profile have been received. Keep this Request ID for follow-up.</p>
      <div class="summary" style="margin:22px 0;"><strong>${requestId || 'Request received'}</strong><span>Yenkasa Soft-O-Tech will review the details and contact you.</span></div>
      <a class="btn" href="/web">Back to Home</a>
    </section></main>`,
  }));
});

router.get('/admin/project-requests', (req, res) => {
  res.send(pageShell({
    title: 'Project Requests Admin | Yenkasa Soft-O-Tech',
    body: `<main class="wrap">
  <section class="hero"><div><h1>Project Requests</h1><p class="lead">Manage website, app, software, AI, and UI/UX leads captured from www.yenkasa.xyz.</p></div><aside class="summary"><strong id="totalCount">--</strong><span>Total captured inquiries</span></aside></section>
  <section class="section"><div class="grid">
    <div class="field full"><label for="token">Admin Bearer Token</label><input id="token" type="password" placeholder="Paste admin access token"></div>
    <div class="field"><label for="search">Search</label><input id="search" placeholder="Request ID, client, company, email, phone"></div>
    <div class="field"><label for="status">Status</label><select id="status"><option value="">All statuses</option>${options(STATUSES)}</select></div>
    <div class="field"><label for="from">From</label><input id="from" type="date"></div>
    <div class="field"><label for="to">To</label><input id="to" type="date"></div>
  </div><div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" id="loadBtn">Load Requests</button><button class="btn secondary" id="clientsBtn">Load Clients</button><button class="btn secondary" id="analyticsBtn">Load Analytics</button></div><p class="error" id="adminError"></p></section>
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
token.value = localStorage.getItem('projectRequestAdminToken') || '';
token.addEventListener('input', () => localStorage.setItem('projectRequestAdminToken', token.value.trim()));
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
  const response = await fetch('/api/project-requests/admin?' + params.toString(), { headers: headers() });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load requests.');
  showPanel('requestsPanel');
  totalCount.textContent = payload.total;
  if (!payload.items.length) { panels.requestsPanel.innerHTML = '<p class="lead">No requests match the filters.</p>'; return; }
  panels.requestsPanel.innerHTML = payload.items.map(item => {
    const files = (item.files || []).map(file => '<a class="btn ghost" target="_blank" rel="noopener" href="' + escapeHtml(file.url) + '">' + escapeHtml(file.originalName) + '</a>').join(' ');
    const contact = item.contact || {};
    const req = item.requirements || {};
    return '<article>' +
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><h2 style="margin:0;">' + escapeHtml(item.requestId) + '</h2><select data-id="' + escapeHtml(item.requestId) + '" class="statusSelect">' + ${JSON.stringify(STATUSES)}.map(status => '<option ' + (status === item.status ? 'selected' : '') + '>' + status + '</option>').join('') + '</select></div>' +
      '<p><strong>' + escapeHtml(contact.fullName) + '</strong> - ' + escapeHtml(contact.companyName) + ' - ' + escapeHtml(contact.email) + '</p>' +
      '<p class="meta">Phone: ' + escapeHtml(contact.phoneNumber) + ' | WhatsApp: ' + escapeHtml(contact.whatsappNumber) + ' | Preferred: ' + escapeHtml(contact.preferredContactMethod) + ' | Best time: ' + escapeHtml(contact.bestTimeToContact) + '</p>' +
      '<p class="meta">' + escapeHtml(item.requestCategory) + ' | ' + escapeHtml(req.projectType || req.websiteType) + ' | Platforms: ' + escapeHtml((req.platformsRequired || []).join(", ")) + '</p>' +
      '<p class="meta">Pages/Screens: ' + escapeHtml((req.pagesRequired || []).join(", ")) + ' | Features: ' + escapeHtml((req.featuresRequired || []).join(", ")) + '</p>' +
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
  const response = await fetch('/api/project-requests/admin/clients?' + params.toString(), { headers: headers() });
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
  const response = await fetch('/api/project-requests/admin/' + encodeURIComponent(requestId) + '/status', {
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
    const response = await fetch('/api/project-requests/admin/analytics', { headers: headers() });
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

module.exports = router;
