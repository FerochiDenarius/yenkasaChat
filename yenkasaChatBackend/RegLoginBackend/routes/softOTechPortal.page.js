const express = require('express');

const router = express.Router();

function shell({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { --ink:#122018; --muted:#617269; --line:#dce8e1; --brand:#147a49; --brand2:#0f5132; --bg:#f6faf7; --panel:#fff; --soft:#e9f5ed; --danger:#9b1c1c; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
    a { color:inherit; }
    .topbar { position:sticky; top:0; z-index:20; background:rgba(255,255,255,.95); border-bottom:1px solid var(--line); backdrop-filter:blur(12px); }
    .nav { max-width:1180px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .brand { display:flex; align-items:center; gap:10px; font-weight:800; text-decoration:none; }
    .mark { width:42px; height:42px; border-radius:8px; object-fit:cover; background:#10271b; }
    .nav-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .btn { appearance:none; border:0; background:var(--brand); color:white; border-radius:8px; padding:11px 15px; font-weight:800; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; min-height:42px; }
    .btn.secondary { background:var(--soft); color:var(--brand2); }
    .btn.ghost { background:white; color:var(--ink); border:1px solid var(--line); }
    .wrap { max-width:1180px; margin:0 auto; padding:34px 20px 60px; }
    h1 { font-size:clamp(2rem,4vw,3.7rem); line-height:1; margin:0 0 14px; letter-spacing:0; }
    .lead { color:var(--muted); font-size:1.04rem; line-height:1.65; margin:0; }
    .hero { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr); gap:24px; align-items:end; margin-bottom:22px; }
    .summary { background:#10271b; color:white; border-radius:8px; padding:22px; box-shadow:0 18px 40px rgba(20,33,26,.14); }
    .summary strong { display:block; font-size:1.55rem; margin-bottom:6px; }
    .summary span { color:#cfebd8; }
    .section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:22px; box-shadow:0 10px 28px rgba(20,33,26,.05); margin-bottom:18px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:16px; background:#fbfdfb; }
    .card strong { display:block; font-size:1.7rem; margin-bottom:4px; }
    .field { display:grid; gap:7px; }
    label { font-weight:750; font-size:.92rem; }
    input, select, textarea { width:100%; border:1px solid #cfdcd4; border-radius:8px; padding:12px 13px; font:inherit; background:white; color:var(--ink); min-height:44px; }
    textarea { min-height:96px; resize:vertical; line-height:1.5; }
    .full { grid-column:1 / -1; }
    .error { color:var(--danger); font-weight:800; display:none; }
    .tabs { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px; }
    .tab { border:1px solid var(--line); background:white; color:var(--ink); border-radius:8px; padding:10px 14px; font-weight:800; cursor:pointer; }
    .tab.active { background:var(--brand); color:white; border-color:var(--brand); }
    article { border-bottom:1px solid var(--line); padding:16px 0; }
    .meta { color:var(--muted); line-height:1.55; }
    @media (max-width:860px) { .hero, .grid, .cards { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header class="topbar"><nav class="nav">
    <a class="brand" href="/web"><img class="mark" src="/web/images/yenkasa-soft-o-tech-emblem.png" alt="Yenkasa Soft-O-Tech"><span>Yenkasa Soft-O-Tech</span></a>
    <div class="nav-actions">
      <a class="btn ghost" href="/web">Home</a>
      <a class="btn ghost" href="/website-request">Request a Project</a>
      <a class="btn secondary" href="/client/login">Client Portal</a>
      <a class="btn" href="/admin">Admin</a>
    </div>
  </nav></header>
  ${body}
</body>
</html>`;
}

router.get('/client/register', (req, res) => {
  res.send(shell({
    title: 'Client Register | Yenkasa Soft-O-Tech',
    body: `<main class="wrap"><section class="hero"><div><h1>Client Registration</h1><p class="lead">Create a Soft-O-Tech client account to track requests, quotations, invoices, documents, messages, and project progress.</p></div><aside class="summary"><strong>Client portal</strong><span>One login for all project communication and documents.</span></aside></section>
<section class="section"><form id="registerForm" class="grid">
  <div class="field"><label>Full Name</label><input name="fullName" required></div>
  <div class="field"><label>Company</label><input name="companyName"></div>
  <div class="field"><label>Email</label><input name="email" type="email" required></div>
  <div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div>
  <div class="field"><label>Phone</label><input name="phoneNumber"></div>
  <div class="field"><label>WhatsApp</label><input name="whatsappNumber"></div>
  <div class="field"><label>Location</label><input name="businessLocation"></div>
  <div class="field"><label>Preferred Contact</label><select name="preferredContactMethod"><option>Email</option><option>Phone Call</option><option>WhatsApp</option><option>SMS</option></select></div>
  <p class="error full" id="errorBox"></p>
  <div class="full"><button class="btn" type="submit">Create Account</button> <a class="btn ghost" href="/client/login">Login</a></div>
</form></section></main>
<script>
document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('errorBox');
  errorBox.style.display = 'none';
  try {
    const response = await fetch('/api/project-portal/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Registration failed.');
    localStorage.setItem('softOTechPortalToken', payload.token);
    window.location.href = '/client/dashboard';
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
</script>`,
  }));
});

router.get('/client/login', (req, res) => {
  res.send(shell({
    title: 'Client Login | Yenkasa Soft-O-Tech',
    body: `<main class="wrap"><section class="hero"><div><h1>Client Portal Login</h1><p class="lead">Access project requests, quotations, invoices, messages, documents, and delivery updates.</p></div><aside class="summary"><strong>Secure access</strong><span>Client accounts are stored in Google Cloud Firestore.</span></aside></section>
<section class="section"><form id="loginForm" class="grid">
  <div class="field"><label>Email</label><input name="email" type="email" required></div>
  <div class="field"><label>Password</label><input name="password" type="password" required></div>
  <p class="error full" id="errorBox"></p>
  <div class="full"><button class="btn" type="submit">Login</button> <a class="btn ghost" href="/client/register">Register</a></div>
</form></section></main>
<script>
document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('errorBox');
  errorBox.style.display = 'none';
  try {
    const response = await fetch('/api/project-portal/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Login failed.');
    localStorage.setItem('softOTechPortalToken', payload.token);
    window.location.href = payload.client?.is_admin ? '/admin' : '/client/dashboard';
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
</script>`,
  }));
});

router.get('/client/dashboard', (req, res) => {
  res.send(shell({
    title: 'Client Dashboard | Yenkasa Soft-O-Tech',
    body: `<main class="wrap"><section class="hero"><div><h1>Client Dashboard</h1><p class="lead">Track project requests, quotations, invoices, documents, and messages.</p></div><aside class="summary"><strong id="clientName">Client</strong><span id="clientEmail">Loading profile...</span></aside></section>
<section class="cards" id="widgets"></section>
<section class="section"><div class="tabs"><button class="tab active" data-panel="requests">Requests</button><button class="tab" data-panel="projects">Projects</button><button class="tab" data-panel="quotations">Quotations</button><button class="tab" data-panel="invoices">Invoices</button><button class="tab" data-panel="messages">Messages</button><button class="tab" data-panel="documents">Documents</button><button class="tab" data-panel="profile">Profile</button></div><div id="panel"></div><p class="error" id="errorBox"></p></section></main>
<script>
const token = localStorage.getItem('softOTechPortalToken') || '';
if (!token) window.location.href = '/client/login';
const panel = document.getElementById('panel');
const errorBox = document.getElementById('errorBox');
let dashboard = null;
function headers(extra={}) { return { Authorization:'Bearer ' + token, ...extra }; }
function esc(v) { return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rows(items, empty) { return items?.length ? items.map(item => '<article><h3>' + esc(item.requestId || item.projectId || item.quotationId || item.invoiceNumber || item.subject || item.originalName || item.title) + '</h3><p class="meta">' + esc(item.status || item.createdAt || '') + '</p><pre style="white-space:pre-wrap;font:inherit;">' + esc(JSON.stringify(item, null, 2)) + '</pre></article>').join('') : '<p class="lead">' + empty + '</p>'; }
function render(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  if (name === 'profile') {
    const p = dashboard.profile || {};
    panel.innerHTML = '<form id="profileForm" class="grid"><div class="field"><label>Full Name</label><input name="fullName" value="' + esc(p.fullName) + '"></div><div class="field"><label>Company</label><input name="companyName" value="' + esc(p.companyName) + '"></div><div class="field"><label>Phone</label><input name="phoneNumber" value="' + esc(p.phoneNumber) + '"></div><div class="field"><label>WhatsApp</label><input name="whatsappNumber" value="' + esc(p.whatsappNumber) + '"></div><div class="field"><label>Location</label><input name="businessLocation" value="' + esc(p.businessLocation) + '"></div><div class="field"><label>Best Time</label><input name="bestTimeToContact" value="' + esc(p.bestTimeToContact) + '"></div><div class="full"><button class="btn">Save Profile</button></div></form>';
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    return;
  }
  if (name === 'messages') {
    panel.innerHTML = '<form id="messageForm" class="grid"><div class="field"><label>Subject</label><input name="subject"></div><div class="field full"><label>Message</label><textarea name="body"></textarea></div><div class="full"><button class="btn">Send Message</button></div></form>' + rows(dashboard.messages, 'No messages yet.');
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    return;
  }
  if (name === 'documents') {
    panel.innerHTML = '<form id="docForm" enctype="multipart/form-data" class="grid"><div class="field"><label>Document</label><input type="file" name="document" required></div><div class="field"><label>Request ID</label><input name="requestId"></div><div class="full"><button class="btn">Upload Document</button></div></form>' + rows(dashboard.documents, 'No documents yet.');
    document.getElementById('docForm').addEventListener('submit', uploadDocument);
    return;
  }
  panel.innerHTML = rows(dashboard[name], 'Nothing to show yet.');
}
async function saveProfile(event) { event.preventDefault(); await fetch('/api/project-portal/me', { method:'PATCH', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); await load(); render('profile'); }
async function sendMessage(event) { event.preventDefault(); await fetch('/api/project-portal/client/messages', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); await load(); render('messages'); }
async function uploadDocument(event) { event.preventDefault(); await fetch('/api/project-portal/client/documents', { method:'POST', headers:headers(), body:new FormData(event.target) }); await load(); render('documents'); }
async function load() {
  const response = await fetch('/api/project-portal/client/dashboard', { headers:headers() });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load dashboard.');
  dashboard = payload.dashboard;
  document.getElementById('clientName').textContent = dashboard.profile.fullName || 'Client';
  document.getElementById('clientEmail').textContent = dashboard.profile.email || '';
  document.getElementById('widgets').innerHTML = Object.entries(dashboard.widgets).map(([k,v]) => '<div class="card"><strong>' + v + '</strong><span>' + esc(k.replace(/[A-Z]/g, m => ' ' + m).trim()) + '</span></div>').join('');
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => render(tab.dataset.panel)));
load().then(() => render('requests')).catch(error => { errorBox.textContent = error.message; errorBox.style.display = 'block'; });
</script>`,
  }));
});

router.get('/admin', (req, res) => {
  res.send(shell({
    title: 'Admin Dashboard | Yenkasa Soft-O-Tech',
    body: `<main class="wrap"><section class="hero"><div><h1>Operations Dashboard</h1><p class="lead">Manage clients, project requests, projects, quotations, invoices, messages, documents, analytics, and settings.</p></div><aside class="summary"><strong>Admin system</strong><span>Senior developer accounts can access this dashboard.</span></aside></section>
<section class="section"><div class="grid"><div class="field full"><label>Portal Token</label><input id="token" type="password" placeholder="Login as admin first or paste token"></div></div><p class="error" id="errorBox"></p><div style="margin-top:12px;"><button class="btn" id="loadBtn">Load Admin Dashboard</button> <a class="btn ghost" href="/client/login">Admin Login</a> <a class="btn secondary" href="/admin/project-requests">Legacy Request Admin</a></div></section>
<section class="cards" id="metrics"></section>
<section class="section"><div class="tabs"><button class="tab active" data-panel="clients">Clients</button><button class="tab" data-panel="requests">Project Requests</button><button class="tab" data-panel="projects">Projects</button><button class="tab" data-panel="quotations">Quotations</button><button class="tab" data-panel="invoices">Invoices</button><button class="tab" data-panel="messages">Messages</button><button class="tab" data-panel="analytics">Analytics</button><button class="tab" data-panel="settings">Settings</button></div><div id="panel"><p class="lead">Load the dashboard to begin.</p></div></section></main>
<script>
const tokenInput = document.getElementById('token');
tokenInput.value = localStorage.getItem('softOTechPortalToken') || '';
tokenInput.addEventListener('input', () => localStorage.setItem('softOTechPortalToken', tokenInput.value.trim()));
const panel = document.getElementById('panel');
const errorBox = document.getElementById('errorBox');
let dashboard = null;
function headers(extra={}) { return { Authorization:'Bearer ' + tokenInput.value.trim(), ...extra }; }
function esc(v) { return String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rows(items, empty) { return items?.length ? items.map(item => '<article><h3>' + esc(item.requestId || item.projectId || item.quotationId || item.invoiceNumber || item.email || item.title || item.subject) + '</h3><pre style="white-space:pre-wrap;font:inherit;">' + esc(JSON.stringify(item, null, 2)) + '</pre></article>').join('') : '<p class="lead">' + empty + '</p>'; }
function render(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  if (!dashboard) return;
  if (name === 'requests') panel.innerHTML = rows(dashboard.requests || [], 'No project requests yet.');
  else if (name === 'analytics') panel.innerHTML = '<pre style="white-space:pre-wrap;font:inherit;">' + esc(JSON.stringify(dashboard.analytics, null, 2)) + '</pre>';
  else if (name === 'settings') panel.innerHTML = '<p class="lead">Admin emails are configured with SOFTOTECH_ADMIN_EMAILS or ADMIN_EMAILS. Storage uses Firestore collections for clients, requests, projects, quotations, invoices, messages, and documents.</p>';
  else panel.innerHTML = rows(dashboard[name], 'Nothing to show yet.');
}
async function loadAdmin() {
  errorBox.style.display = 'none';
  const response = await fetch('/api/project-portal/admin/dashboard', { headers:headers() });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load admin dashboard.');
  dashboard = payload.dashboard;
  document.getElementById('metrics').innerHTML = Object.entries(dashboard.metrics).map(([k,v]) => '<div class="card"><strong>' + v + '</strong><span>' + esc(k.replace(/[A-Z]/g, m => ' ' + m).trim()) + '</span></div>').join('');
  render('clients');
}
document.getElementById('loadBtn').addEventListener('click', () => loadAdmin().catch(error => { errorBox.textContent = error.message; errorBox.style.display = 'block'; }));
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => render(tab.dataset.panel)));
</script>`,
  }));
});

module.exports = router;
