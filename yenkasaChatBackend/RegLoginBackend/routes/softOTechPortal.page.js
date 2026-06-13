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
    :root {
      --ink:#071226;
      --muted:#69758c;
      --line:#e3e9f2;
      --blue:#1265ff;
      --blue2:#0446c7;
      --green:#14b85a;
      --orange:#f6a313;
      --purple:#7c3aed;
      --red:#ef4444;
      --bg:#f6f8fc;
      --panel:#ffffff;
      --nav:#071b33;
      --nav2:#020b18;
    }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
    a { color:inherit; text-decoration:none; }
    button, input, select, textarea { font:inherit; }
    .public-shell { min-height:100vh; display:grid; grid-template-columns:minmax(300px,.88fr) minmax(0,1.12fr); background:linear-gradient(135deg,#06182f,#0c2444 42%,#f8fbff 42%); }
    .public-brand { color:white; padding:44px; display:flex; flex-direction:column; justify-content:space-between; min-height:100vh; }
    .brand-row { display:flex; align-items:center; gap:12px; font-weight:900; letter-spacing:.08em; }
    .brand-row img { width:48px; height:48px; border-radius:10px; object-fit:cover; }
    .public-copy h1 { font-size:clamp(2.4rem,5vw,5.2rem); line-height:.95; margin:0 0 18px; letter-spacing:0; max-width:640px; }
    .public-copy p { color:#bfd0ea; line-height:1.7; font-size:1.05rem; max-width:560px; }
    .auth-card { align-self:center; justify-self:center; width:min(560px,calc(100vw - 32px)); background:white; border:1px solid var(--line); border-radius:16px; padding:28px; box-shadow:0 24px 70px rgba(7,18,38,.12); }
    .auth-card h2 { margin:0 0 8px; font-size:1.65rem; }
    .lead { color:var(--muted); line-height:1.65; margin:0; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .field { display:grid; gap:7px; }
    label { font-weight:750; font-size:.9rem; }
    input, select, textarea { width:100%; min-height:44px; border:1px solid #d5deeb; border-radius:10px; padding:12px 13px; background:white; color:var(--ink); }
    textarea { min-height:96px; resize:vertical; line-height:1.5; }
    input:focus, select:focus, textarea:focus { outline:3px solid rgba(18,101,255,.16); border-color:var(--blue); }
    .full { grid-column:1 / -1; }
    .btn { appearance:none; border:0; min-height:44px; border-radius:10px; padding:11px 15px; background:var(--blue); color:white; font-weight:850; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
    .btn.secondary { background:#eef4ff; color:var(--blue2); }
    .btn.ghost { background:white; color:var(--ink); border:1px solid var(--line); }
    .btn.warn { background:#fff3e0; color:#b45309; }
    .btn.danger { background:#fff1f2; color:#be123c; }
    .error { color:#b91c1c; font-weight:800; display:none; }
    .app-shell { min-height:100vh; display:grid; grid-template-columns:280px minmax(0,1fr); }
    .sidebar { background:linear-gradient(180deg,var(--nav),var(--nav2)); color:white; padding:28px 14px; position:sticky; top:0; min-height:100vh; align-self:start; }
    .sidebar .brand-row { padding:0 12px 28px; }
    .side-nav { display:grid; gap:8px; }
    .nav-item { width:100%; border:0; color:#d9e8ff; background:transparent; border-radius:10px; padding:13px 16px; display:flex; align-items:center; gap:12px; font-weight:800; cursor:pointer; text-align:left; }
    .nav-item.active, .nav-item:hover { background:linear-gradient(135deg,#1265ff,#0253dc); color:white; }
    .nav-icon { width:25px; height:25px; border:1px solid rgba(255,255,255,.35); border-radius:7px; display:grid; place-items:center; font-size:.72rem; font-weight:900; }
    .workspace { min-width:0; }
    .topbar { height:88px; background:white; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; gap:18px; padding:0 28px; position:sticky; top:0; z-index:10; }
    .topbar h1 { margin:0; font-size:1.28rem; letter-spacing:0; }
    .topbar p { margin:4px 0 0; color:var(--muted); }
    .top-actions { display:flex; align-items:center; gap:14px; }
    .avatar { width:46px; height:46px; border-radius:999px; background:#dbeafe; color:#0b4dcc; display:grid; place-items:center; font-weight:900; border:1px solid #c5d7ff; }
    .content { padding:24px 28px 42px; display:grid; gap:20px; }
    .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:18px; }
    .metric-card, .panel { background:white; border:1px solid var(--line); border-radius:16px; box-shadow:0 14px 36px rgba(7,18,38,.05); }
    .metric-card { padding:22px; min-height:142px; display:grid; grid-template-columns:auto 1fr; gap:16px; align-items:start; }
    .metric-icon { width:54px; height:54px; border-radius:16px; display:grid; place-items:center; color:white; font-weight:900; box-shadow:0 12px 28px rgba(18,101,255,.22); }
    .metric-card small { color:var(--muted); font-weight:750; }
    .metric-card strong { display:block; font-size:1.45rem; margin:10px 0 8px; }
    .status-pill { display:inline-flex; align-items:center; min-height:28px; border-radius:999px; padding:5px 12px; font-size:.82rem; font-weight:850; background:#ede9fe; color:#6d28d9; }
    .status-pill.green { background:#dcfce7; color:#15803d; }
    .status-pill.blue { background:#dbeafe; color:#1d4ed8; }
    .status-pill.orange { background:#ffedd5; color:#c2410c; }
    .progress-track { height:10px; border-radius:999px; background:#eef2f7; overflow:hidden; margin-top:14px; }
    .progress-bar { height:100%; background:linear-gradient(90deg,#13b85a,#23c46c); border-radius:999px; width:0; }
    .dashboard-grid { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr); gap:20px; align-items:start; }
    .panel { padding:22px; }
    .panel-head { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:18px; }
    .panel h2 { margin:0; font-size:1.12rem; }
    .timeline { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0; padding:24px 0 6px; }
    .step { position:relative; display:grid; justify-items:center; text-align:center; gap:9px; color:var(--muted); }
    .step:before { content:""; position:absolute; top:24px; left:-50%; width:100%; height:3px; background:#d9e1ec; z-index:0; }
    .step:first-child:before { display:none; }
    .step.done:before { background:#18b45b; }
    .step-dot { width:50px; height:50px; border-radius:999px; display:grid; place-items:center; background:#eef2f7; color:#6b7280; border:6px solid white; box-shadow:0 0 0 1px var(--line); position:relative; z-index:1; font-weight:900; }
    .step.done .step-dot { background:#16b95a; color:white; }
    .step.active .step-dot { background:#1265ff; color:white; box-shadow:0 0 0 8px #dbeafe; }
    .step strong { color:var(--ink); font-size:.92rem; }
    .list { display:grid; gap:0; }
    .list-row { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; border-top:1px solid var(--line); padding:15px 0; }
    .list-row:first-child { border-top:0; }
    .row-icon { width:38px; height:38px; border-radius:999px; display:grid; place-items:center; color:white; font-weight:900; }
    .row-title { font-weight:850; }
    .row-meta { color:var(--muted); font-size:.9rem; margin-top:3px; }
    .info-table { display:grid; }
    .info-row { display:grid; grid-template-columns:1fr 1.25fr; gap:14px; border-top:1px solid var(--line); padding:15px 0; }
    .info-row:first-child { border-top:0; }
    .info-row span:first-child { font-weight:850; }
    .info-row span:last-child { color:#4b5870; }
    .quick-actions { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px; }
    .quick-action { border:0; border-radius:14px; min-height:76px; background:#f8fafc; color:var(--ink); font-weight:850; cursor:pointer; display:grid; place-items:center; gap:6px; }
    .quick-action span { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; font-weight:900; }
    .donut { width:160px; aspect-ratio:1; border-radius:50%; background:conic-gradient(var(--blue) 0 42%, var(--green) 42% 62%, var(--orange) 62% 100%); display:grid; place-items:center; margin:auto; }
    .donut-inner { width:94px; aspect-ratio:1; border-radius:50%; background:white; display:grid; place-items:center; text-align:center; font-weight:900; }
    .cost-grid { display:grid; grid-template-columns:180px 1fr; gap:20px; align-items:center; }
    .legend { display:grid; gap:14px; }
    .legend-row { display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center; }
    .dot { width:10px; height:10px; border-radius:999px; }
    .records { display:grid; gap:12px; }
    .record { border:1px solid var(--line); border-radius:14px; padding:16px; background:white; display:grid; gap:8px; }
    .record-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .record-title { font-weight:900; }
    .record-meta { color:var(--muted); line-height:1.5; }
    .empty { border:1px dashed #cdd7e6; border-radius:14px; padding:24px; color:var(--muted); background:#fbfdff; }
    .form-panel { display:grid; gap:14px; max-width:980px; }
    @media (max-width:1180px) { .metrics, .quick-actions { grid-template-columns:repeat(2,minmax(0,1fr)); } .dashboard-grid { grid-template-columns:1fr; } .cost-grid { grid-template-columns:1fr; } }
    @media (max-width:860px) { .public-shell { grid-template-columns:1fr; background:#f8fbff; } .public-brand { min-height:auto; padding:26px; background:linear-gradient(135deg,#06182f,#0c2444); } .app-shell { grid-template-columns:1fr; } .sidebar { position:relative; min-height:auto; } .side-nav { grid-template-columns:repeat(2,minmax(0,1fr)); } .topbar { height:auto; padding:18px; align-items:flex-start; } .content { padding:18px; } .metrics, .quick-actions, .grid { grid-template-columns:1fr; } .timeline { grid-template-columns:1fr; gap:16px; } .step:before { display:none; } }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function publicBrand() {
  return `<aside class="public-brand">
    <a class="brand-row" href="/"><img src="/images/logoYenkasaSoftOTech.jpeg" alt="Yenkasa Soft-O-Tech"><span>YENKASA<br>SOFT-O-TECH</span></a>
    <div class="public-copy">
      <h1>Build, manage, and track your project.</h1>
      <p>Client intake, requests, quotations, invoices, documents, and project communication in one professional workspace.</p>
    </div>
    <div><a class="btn secondary" href="/request-project">Request a Project</a></div>
  </aside>`;
}

function sidebar(active = 'dashboard', mode = 'client') {
  const clientItems = [
    ['dashboard', 'DB', 'Dashboard'],
    ['requests', 'PR', 'Project Requests'],
    ['projects', 'PD', 'Project Details'],
    ['costs', '$', 'Project Cost'],
    ['duration', 'DU', 'Project Duration'],
    ['requirements', 'RQ', 'Requirements'],
    ['updates', 'UP', 'Project Updates'],
    ['messages', 'MS', 'Messages'],
    ['documents', 'FL', 'Files & Documents'],
    ['invoices', 'IN', 'Invoices'],
    ['payments', 'PY', 'Payments'],
    ['support', 'SP', 'Support'],
    ['profile', 'AC', 'Account Settings'],
  ];
  const adminItems = [
    ['dashboard', 'DB', 'Dashboard'],
    ['clients', 'CL', 'Clients'],
    ['requests', 'PR', 'Project Requests'],
    ['projects', 'PJ', 'Projects'],
    ['team', 'TM', 'Team Assignments'],
    ['payments', 'PY', 'Payments'],
    ['pricing', 'PC', 'Pricing Catalog'],
    ['quotations', 'QT', 'Quotations'],
    ['invoices', 'IN', 'Invoices'],
    ['documents', 'FL', 'Files & Assets'],
    ['messages', 'MS', 'Messages'],
    ['timeline', 'TL', 'Project Timeline'],
    ['risks', 'RK', 'Risk Tracking'],
    ['deliverables', 'DV', 'Deliverables'],
    ['assistant', 'AI', 'Project AI'],
    ['analytics', 'AN', 'Analytics'],
    ['settings', 'ST', 'Settings'],
  ];
  const items = mode === 'admin' ? adminItems : clientItems;
  return `<aside class="sidebar">
    <a class="brand-row" href="/"><img src="/images/logoYenkasaSoftOTech.jpeg" alt="Yenkasa Soft-O-Tech"><span>YENKASA<br>SOFT-O-TECH</span></a>
    <nav class="side-nav">${items.map(([key, icon, label]) => `<button class="nav-item ${key === active ? 'active' : ''}" data-panel="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</nav>
    <div style="margin-top:28px;"><button class="nav-item" id="logoutBtn"><span class="nav-icon">EX</span>Logout</button></div>
  </aside>`;
}

router.get('/software-solutions', (req, res) => {
  res.send(shell({
    title: 'Software Solutions Portal | Yenkasa Soft-O-Tech',
    body: `<main class="public-shell">${publicBrand()}<section class="auth-card">
      <h2>Software Solutions Portal</h2>
      <p class="lead" style="margin-bottom:22px;">Request a website, mobile app, AI solution, business software, cloud deployment, or UI/UX project. Existing clients and Soft-O-Tech admins can access their workspaces here.</p>
      <div class="grid">
        <a class="record" href="/request-project"><div class="record-head"><div class="record-title">Request a Project</div><span class="status-pill blue">Lead Intake</span></div><div class="record-meta">Submit requirements, budget, timeline, files, and contact details.</div></a>
        <a class="record" href="/client/register"><div class="record-head"><div class="record-title">Client Registration</div><span class="status-pill green">New Client</span></div><div class="record-meta">Create a client account before or after submitting a request.</div></a>
        <a class="record" href="/client/login"><div class="record-head"><div class="record-title">Client Login</div><span class="status-pill">Portal</span></div><div class="record-meta">Track projects, messages, documents, invoices, payments, and quotations.</div></a>
        <a class="record" href="/admin"><div class="record-head"><div class="record-title">Admin Login</div><span class="status-pill orange">Team</span></div><div class="record-meta">Manage clients, requests, projects, proposals, milestones, and payments.</div></a>
        <a class="record full" href="/services"><div class="record-head"><div class="record-title">View Services</div><span class="status-pill blue">Soft-O-Tech</span></div><div class="record-meta">Website Development, Mobile Apps, AI Solutions, API Development, Cloud Deployment, UI/UX Design, and Technical Consulting.</div></a>
      </div>
    </section></main>`,
  }));
});

router.get('/client/register', (req, res) => {
  res.send(shell({
    title: 'Client Register | Yenkasa Soft-O-Tech',
    body: `<main class="public-shell">${publicBrand()}<section class="auth-card">
      <h2>Create client account</h2>
      <p class="lead" style="margin-bottom:22px;">Register once, then track every request, quotation, invoice, document, and project update from your portal.</p>
      <form id="registerForm" class="grid">
        <div class="field"><label>Full Name</label><input name="fullName" autocomplete="name" required></div>
        <div class="field"><label>Company</label><input name="companyName" autocomplete="organization"></div>
        <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label>Password</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div>
        <div class="field"><label>Phone</label><input name="phoneNumber" autocomplete="tel"></div>
        <div class="field"><label>WhatsApp</label><input name="whatsappNumber" autocomplete="tel"></div>
        <div class="field"><label>Location</label><input name="businessLocation"></div>
        <div class="field"><label>Preferred Contact</label><select name="preferredContactMethod"><option>Email</option><option>Phone Call</option><option>WhatsApp</option><option>SMS</option></select></div>
        <p class="error full" id="errorBox"></p>
        <div class="full" style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" type="submit">Create Account</button><a class="btn ghost" href="/client/login">Login Instead</a></div>
      </form>
    </section></main>
<script>
document.getElementById('registerForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  var errorBox = document.getElementById('errorBox');
  errorBox.style.display = 'none';
  try {
    var response = await fetch('/api/project-portal/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    var payload = await response.json();
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
    body: `<main class="public-shell">${publicBrand()}<section class="auth-card">
      <h2>Client portal login</h2>
      <p class="lead" style="margin-bottom:22px;">Access your project workspace, documents, quotations, invoices, and messages.</p>
      <form id="loginForm" class="grid">
        <div class="field full"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
        <div class="field full"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div>
        <p class="error full" id="errorBox"></p>
        <div class="full" style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" type="submit">Login</button><a class="btn ghost" href="/client/register">Create Account</a></div>
      </form>
    </section></main>
<script>
document.getElementById('loginForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  var errorBox = document.getElementById('errorBox');
  errorBox.style.display = 'none';
  try {
    var response = await fetch('/api/project-portal/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    var payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Login failed.');
    localStorage.setItem('softOTechPortalToken', payload.token);
    window.location.href = payload.client && payload.client.is_admin ? '/admin' : '/client/dashboard';
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
</script>`,
  }));
});

router.get('/client/dashboard', (req, res) => {
  res.send(shell({
    title: 'Client Dashboard | Yenkasa Soft-O-Tech',
    body: `<main class="app-shell">${sidebar('dashboard', 'client')}<section class="workspace">
      <header class="topbar"><div><h1 id="welcomeTitle">Welcome back</h1><p id="welcomeSub">Here is what is happening with your project.</p></div><div class="top-actions"><a class="btn ghost" href="/request-project">New Request</a><div class="avatar" id="avatar">YS</div></div></header>
      <section class="content">
        <section class="metrics" id="metrics"></section>
        <section id="mainPanel"></section>
        <p class="error" id="errorBox"></p>
      </section>
    </section></main>
<script>
var token = localStorage.getItem('softOTechPortalToken') || '';
if (!token) window.location.href = '/client/login';
var dashboard = null;
var activePanel = 'dashboard';
var mainPanel = document.getElementById('mainPanel');
var errorBox = document.getElementById('errorBox');
function headers(extra) { return Object.assign({ Authorization:'Bearer ' + token }, extra || {}); }
function esc(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function money(value) { var amount = Number(value || 0); return 'GHS ' + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(value) { if (!value) return 'Not scheduled'; var d = new Date(value); return Number.isNaN(d.getTime()) ? 'Not scheduled' : d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' }); }
function initials(name, email) { var source = String(name || email || 'YS').trim(); return source.split(/\\s+/).slice(0,2).map(function(part) { return part[0] || ''; }).join('').toUpperCase() || 'YS'; }
function statusClass(status) { status = String(status || '').toLowerCase(); if (status.includes('complete') || status.includes('approved') || status.includes('paid')) return 'green'; if (status.includes('progress') || status.includes('sent')) return 'blue'; if (status.includes('pending') || status.includes('review')) return 'orange'; return ''; }
function projectProgress(status) { status = String(status || '').toLowerCase(); if (status.includes('completed')) return 100; if (status.includes('deployment')) return 86; if (status.includes('testing')) return 74; if (status.includes('development') || status.includes('progress')) return 65; if (status.includes('planning')) return 28; return 12; }
function latestProject() { return (dashboard.projects && dashboard.projects[0]) || null; }
function latestRequest() { return (dashboard.requests && dashboard.requests[0]) || null; }
function projectName() { var p = latestProject(); var r = latestRequest(); return (p && p.title) || (r && (r.requirements && (r.requirements.projectType || r.requirements.websiteType))) || 'Project workspace'; }
function projectStatus() { var p = latestProject(); var r = latestRequest(); return (p && p.status) || (r && r.status) || 'New'; }
function latestQuotationAmount() { var q = (dashboard.quotations || [])[0]; return Number(q && q.amount || 0); }
function paidAmount() { return (dashboard.invoices || []).filter(function(i) { return ['paid','completed'].includes(String(i.status || '').toLowerCase()); }).reduce(function(sum, i) { return sum + Number(i.amount || 0); }, 0); }
function expectedDelivery() { var p = latestProject(); return (p && (p.deadline || p.dueDate)) || ((dashboard.invoices || [])[0] && dashboard.invoices[0].dueDate) || ''; }
function renderMetrics() {
  var progress = projectProgress(projectStatus());
  var totalCost = latestQuotationAmount() || (dashboard.invoices || []).reduce(function(sum, i) { return sum + Number(i.amount || 0); }, 0);
  var cards = [
    ['ST', 'Project Status', projectStatus(), '<span class="status-pill ' + statusClass(projectStatus()) + '">On Track</span>', 'linear-gradient(135deg,#7c3aed,#2563eb)'],
    ['PG', 'Overall Progress', progress + '%', '<div class="progress-track"><div class="progress-bar" style="width:' + progress + '%"></div></div>', 'linear-gradient(135deg,#18b45b,#12a150)'],
    ['ED', 'Expected Delivery', fmtDate(expectedDelivery()), '<small>' + (expectedDelivery() ? 'Delivery date set' : 'Awaiting schedule') + '</small>', 'linear-gradient(135deg,#1265ff,#2447e8)'],
    ['GH', 'Total Project Cost', money(totalCost), '<a style="color:var(--blue);font-weight:850;" href="#" data-open="costs">View breakdown</a>', 'linear-gradient(135deg,#f6a313,#f97316)']
  ];
  document.getElementById('metrics').innerHTML = cards.map(function(card) {
    return '<article class="metric-card"><div class="metric-icon" style="background:' + card[4] + '">' + card[0] + '</div><div><small>' + card[1] + '</small><strong>' + esc(card[2]) + '</strong>' + card[3] + '</div></article>';
  }).join('');
}
function renderTimeline() {
  var status = projectStatus().toLowerCase();
  var active = status.includes('testing') ? 3 : status.includes('deployment') ? 4 : status.includes('development') || status.includes('progress') ? 2 : status.includes('planning') ? 0 : 1;
  var steps = ['Planning','Design','Development','Testing','Deployment'];
  return '<div class="timeline">' + steps.map(function(step, index) {
    var cls = index < active ? 'done' : index === active ? 'active' : '';
    var mark = index < active ? 'OK' : index === active ? 'GO' : String(index + 1);
    return '<div class="step ' + cls + '"><div class="step-dot">' + mark + '</div><strong>' + step + '</strong><span class="row-meta">' + (index < active ? 'Completed' : index === active ? 'In Progress' : 'Pending') + '</span></div>';
  }).join('') + '</div>';
}
function renderUpdates() {
  var updates = [];
  (dashboard.messages || []).slice(0,2).forEach(function(item) { updates.push({title:item.subject || 'New message', meta:item.body || 'Message received', tag:'Message'}); });
  (dashboard.documents || []).slice(0,2).forEach(function(item) { updates.push({title:item.originalName || 'Document uploaded', meta:'A file was added to the project.', tag:'File'}); });
  (dashboard.requests || []).slice(0,2).forEach(function(item) { updates.push({title:item.requestId || 'Project request', meta:(item.requirements && (item.requirements.projectType || item.requirements.websiteType)) || 'Request submitted', tag:item.status || 'Request'}); });
  if (!updates.length) return '<div class="empty">No recent updates yet.</div>';
  return '<div class="list">' + updates.map(function(item, index) {
    var colors = ['var(--green)','var(--blue)','var(--purple)'];
    return '<div class="list-row"><div class="row-icon" style="background:' + colors[index % colors.length] + '">' + item.tag.slice(0,2).toUpperCase() + '</div><div><div class="row-title">' + esc(item.title) + '</div><div class="row-meta">' + esc(item.meta) + '</div></div><span class="status-pill ' + statusClass(item.tag) + '">' + esc(item.tag) + '</span></div>';
  }).join('') + '</div>';
}
function renderCostSummary() {
  var total = latestQuotationAmount() || (dashboard.invoices || []).reduce(function(sum, i) { return sum + Number(i.amount || 0); }, 0);
  var paid = paidAmount();
  var balance = Math.max(total - paid, 0);
  return '<div class="cost-grid"><div class="donut"><div class="donut-inner"><span>Total</span><br>' + money(total).replace('GHS ','GHS<br>') + '</div></div><div class="legend"><div class="legend-row"><span class="dot" style="background:var(--blue)"></span><span>Total Cost</span><strong>' + money(total) + '</strong></div><div class="legend-row"><span class="dot" style="background:var(--green)"></span><span>Amount Paid</span><strong>' + money(paid) + '</strong></div><div class="legend-row"><span class="dot" style="background:var(--orange)"></span><span>Balance Remaining</span><strong>' + money(balance) + '</strong></div></div></div>';
}
function renderProjectInfo() {
  var p = latestProject() || {};
  var r = latestRequest() || {};
  var req = r.requirements || {};
  var rows = [
    ['Project Name', projectName()],
    ['Project Type', p.projectType || req.projectType || req.websiteType || 'Not selected'],
    ['Started On', fmtDate(p.createdAt || r.submittedAt)],
    ['Expected Delivery', fmtDate(expectedDelivery())],
    ['Project Manager', p.projectManager || 'Not assigned']
  ];
  return '<div class="info-table">' + rows.map(function(row) { return '<div class="info-row"><span>' + row[0] + '</span><span>' + esc(row[1]) + '</span></div>'; }).join('') + '</div>';
}
function renderOverview() {
  mainPanel.innerHTML = '<div class="dashboard-grid"><div style="display:grid;gap:20px;"><section class="panel"><div class="panel-head"><h2>Project Timeline</h2><button class="btn ghost" data-open="projects">View full timeline</button></div>' + renderTimeline() + '</section><section class="panel"><div class="panel-head"><h2>Recent Updates</h2><button class="btn ghost" data-open="messages">View all updates</button></div>' + renderUpdates() + '</section><section class="panel"><h2 style="margin-bottom:18px;">Quick Actions</h2><div class="quick-actions"><button class="quick-action" data-open="requests"><span style="background:#fff7ed;color:#f97316">RQ</span>Request Change</button><button class="quick-action" data-open="documents"><span style="background:#f3e8ff;color:#7c3aed">UP</span>Upload Files</button><button class="quick-action" data-open="messages"><span style="background:#dcfce7;color:#16a34a">MS</span>Send Message</button><button class="quick-action" data-open="invoices"><span style="background:#dbeafe;color:#1265ff">IN</span>View Invoices</button><button class="quick-action" data-open="costs"><span style="background:#fff1f2;color:#e11d48">PY</span>Make Payment</button></div></section></div><div style="display:grid;gap:20px;"><section class="panel"><h2 style="margin-bottom:18px;">Project Cost Summary</h2>' + renderCostSummary() + '</section><section class="panel"><div class="panel-head"><h2>Project Information</h2></div>' + renderProjectInfo() + '<button class="btn ghost" style="width:100%;margin-top:18px;" data-open="projects">View Project Details</button></section></div></div>';
}
function recordList(items, empty, formatter) {
  if (!items || !items.length) return '<div class="empty">' + empty + '</div>';
  return '<div class="records">' + items.map(formatter).join('') + '</div>';
}
function record(title, status, meta, action) { return '<article class="record"><div class="record-head"><div class="record-title">' + esc(title) + '</div><span class="status-pill ' + statusClass(status) + '">' + esc(status || 'Open') + '</span></div><div class="record-meta">' + meta + '</div>' + (action || '') + '</article>'; }
function renderPanel(name) {
  activePanel = name;
  document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.panel === name); });
  if (name === 'dashboard') return renderOverview();
  if (name === 'requests') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Requests</h2><a class="btn" href="/request-project">New Request</a></div>' + recordList(dashboard.requests, 'No project requests yet.', function(item) { var req = item.requirements || {}; return record(item.requestId, item.status, esc(req.projectType || req.websiteType || 'Project request') + '<br>Submitted ' + fmtDate(item.submittedAt)); }) + '</section>';
  if (name === 'projects') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Details</h2></div>' + renderProjectInfo() + renderTimeline() + '</section>';
  if (name === 'costs') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Cost</h2></div>' + renderCostSummary() + '</section>';
  if (name === 'duration') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Duration</h2></div>' + renderTimeline() + '<div class="info-table"><div class="info-row"><span>Expected Delivery</span><span>' + fmtDate(expectedDelivery()) + '</span></div><div class="info-row"><span>Current Progress</span><span>' + projectProgress(projectStatus()) + '%</span></div></div></section>';
  if (name === 'requirements') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Requirements</h2><a class="btn" href="/request-project">Submit New Requirement</a></div>' + recordList(dashboard.requests, 'No requirements have been submitted yet.', function(item) { var req = item.requirements || {}; return record(item.requestId || 'Requirement', item.status, esc(req.projectName || req.projectType || req.websiteType || 'Project') + '<br>' + esc(req.requirements || req.additionalNotes || req.businessDescription || 'No detailed requirement text saved.')); }) + '</section>';
  if (name === 'updates') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Updates</h2></div>' + renderUpdates() + '</section>';
  if (name === 'messages') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Messages</h2></div><form id="messageForm" class="form-panel"><div class="grid"><div class="field"><label>Subject</label><input name="subject"></div><div class="field full"><label>Message</label><textarea name="body"></textarea></div></div><button class="btn" type="submit">Send Message</button></form><div style="height:16px"></div>' + recordList(dashboard.messages, 'No messages yet.', function(item) { return record(item.subject || 'Message', item.senderRole || 'Message', esc(item.body || '') + '<br>' + fmtDate(item.createdAt)); }) + '</section>';
  if (name === 'documents') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Files & Documents</h2></div><form id="docForm" enctype="multipart/form-data" class="form-panel"><div class="grid"><div class="field"><label>Document</label><input type="file" name="document" required></div><div class="field"><label>Request ID</label><input name="requestId"></div></div><button class="btn" type="submit">Upload Document</button></form><div style="height:16px"></div>' + recordList(dashboard.documents, 'No documents yet.', function(item) { return record(item.originalName || 'Document', item.uploadedBy || 'File', '<a style="color:var(--blue);font-weight:850;" target="_blank" rel="noopener" href="' + esc(item.url) + '">Download file</a><br>' + fmtDate(item.createdAt)); }) + '</section>';
  if (name === 'invoices') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Invoices</h2></div>' + recordList(dashboard.invoices, 'No invoices yet.', function(item) { return record(item.invoiceNumber || 'Invoice', item.status, money(item.amount) + '<br>Due ' + fmtDate(item.dueDate)); }) + '</section>';
  if (name === 'payments') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Payments</h2></div>' + recordList(dashboard.payments, 'No payments recorded yet.', function(item) { return record(item.paymentId || 'Payment', item.status, money(item.amount) + '<br>' + esc(item.milestoneTitle || item.method || 'Payment record')); }) + '</section>';
  if (name === 'support') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Support</h2></div><form id="messageForm" class="form-panel"><div class="grid"><div class="field"><label>Subject</label><input name="subject" value="Support Request"></div><div class="field full"><label>Message</label><textarea name="body" placeholder="Describe what you need help with."></textarea></div></div><button class="btn" type="submit">Send Support Message</button></form></section>';
  if (name === 'profile') { var p = dashboard.profile || {}; mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Account Settings</h2></div><form id="profileForm" class="grid"><div class="field"><label>Full Name</label><input name="fullName" value="' + esc(p.fullName) + '"></div><div class="field"><label>Company</label><input name="companyName" value="' + esc(p.companyName) + '"></div><div class="field"><label>Phone</label><input name="phoneNumber" value="' + esc(p.phoneNumber) + '"></div><div class="field"><label>WhatsApp</label><input name="whatsappNumber" value="' + esc(p.whatsappNumber) + '"></div><div class="field"><label>Location</label><input name="businessLocation" value="' + esc(p.businessLocation) + '"></div><div class="field"><label>Best Time</label><input name="bestTimeToContact" value="' + esc(p.bestTimeToContact) + '"></div><div class="full"><button class="btn">Save Profile</button></div></form></section>'; document.getElementById('profileForm').addEventListener('submit', saveProfile); }
  if (name === 'messages' || name === 'support') document.getElementById('messageForm').addEventListener('submit', sendMessage);
  if (name === 'documents') document.getElementById('docForm').addEventListener('submit', uploadDocument);
}
async function saveProfile(event) { event.preventDefault(); await fetch('/api/project-portal/me', { method:'PATCH', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); await load(); renderPanel('profile'); }
async function sendMessage(event) { event.preventDefault(); await fetch('/api/project-portal/client/messages', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); await load(); renderPanel('messages'); }
async function uploadDocument(event) { event.preventDefault(); await fetch('/api/project-portal/client/documents', { method:'POST', headers:headers(), body:new FormData(event.target) }); await load(); renderPanel('documents'); }
async function load() {
  var response = await fetch('/api/project-portal/client/dashboard', { headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load dashboard.');
  dashboard = payload.dashboard;
  var profile = dashboard.profile || {};
  document.getElementById('welcomeTitle').textContent = 'Welcome back, ' + (profile.fullName || 'Client');
  document.getElementById('welcomeSub').textContent = 'Here is what is happening with ' + projectName() + '.';
  document.getElementById('avatar').textContent = initials(profile.fullName, profile.email);
  renderMetrics();
}
document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.addEventListener('click', function() { renderPanel(btn.dataset.panel); }); });
document.body.addEventListener('click', function(event) { var target = event.target.closest('[data-open]'); if (target) { event.preventDefault(); renderPanel(target.dataset.open); } });
document.getElementById('logoutBtn').addEventListener('click', function() { localStorage.removeItem('softOTechPortalToken'); window.location.href = '/client/login'; });
load().then(function() { renderPanel('dashboard'); }).catch(function(error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; });
</script>`,
  }));
});

router.get('/admin', (req, res) => {
  res.send(shell({
    title: 'Admin Dashboard | Yenkasa Soft-O-Tech',
    body: `<main class="app-shell">${sidebar('dashboard', 'admin')}<section class="workspace">
      <header class="topbar"><div><h1>Soft-O-Tech Operations</h1><p>Clients, requests, projects, quotations, invoices, messages, and analytics.</p></div><div class="top-actions"><a class="btn ghost" href="/admin/project-requests">Request Admin</a><div class="avatar">AD</div></div></header>
      <section class="content">
        <section class="panel" id="tokenPanel"><div class="grid"><div class="field full"><label>Portal Token</label><input id="token" type="password" placeholder="Login as admin first or paste token"></div></div><p class="error" id="errorBox"></p><div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" id="loadBtn">Load Admin Dashboard</button><a class="btn ghost" href="/client/login">Admin Login</a></div></section>
        <section class="metrics" id="metrics"></section>
        <section id="mainPanel"></section>
      </section>
    </section></main>
<script>
var tokenInput = document.getElementById('token');
tokenInput.value = localStorage.getItem('softOTechPortalToken') || '';
tokenInput.addEventListener('input', function() { localStorage.setItem('softOTechPortalToken', tokenInput.value.trim()); });
var dashboard = null;
var mainPanel = document.getElementById('mainPanel');
var errorBox = document.getElementById('errorBox');
function headers(extra) { return Object.assign({ Authorization:'Bearer ' + tokenInput.value.trim() }, extra || {}); }
function esc(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function money(value) { var amount = Number(value || 0); return 'GHS ' + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(value) { if (!value) return 'Not scheduled'; var d = new Date(value); return Number.isNaN(d.getTime()) ? 'Not scheduled' : d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' }); }
function statusClass(status) { status = String(status || '').toLowerCase(); if (status.includes('complete') || status.includes('approved') || status.includes('paid')) return 'green'; if (status.includes('progress') || status.includes('sent')) return 'blue'; if (status.includes('pending') || status.includes('review')) return 'orange'; return ''; }
function renderMetrics() {
  var m = dashboard.metrics || {};
  var cards = [['CL','Total Clients',m.totalClients || 0,'Registered client profiles','linear-gradient(135deg,#1265ff,#2447e8)'],['PR','Total Requests',m.totalRequests || 0,'Captured leads','linear-gradient(135deg,#7c3aed,#2563eb)'],['OP','Open Projects',m.openProjects || 0,'Active delivery work','linear-gradient(135deg,#18b45b,#12a150)'],['RV','Revenue Generated',money(m.revenueGenerated || 0),'Paid or completed invoices','linear-gradient(135deg,#f6a313,#f97316)']];
  document.getElementById('metrics').innerHTML = cards.map(function(card) { return '<article class="metric-card"><div class="metric-icon" style="background:' + card[4] + '">' + card[0] + '</div><div><small>' + card[1] + '</small><strong>' + esc(card[2]) + '</strong><span class="row-meta">' + esc(card[3]) + '</span></div></article>'; }).join('');
}
function recordList(items, empty, formatter) { if (!items || !items.length) return '<div class="empty">' + empty + '</div>'; return '<div class="records">' + items.map(formatter).join('') + '</div>'; }
function record(title, status, meta) { return '<article class="record"><div class="record-head"><div class="record-title">' + esc(title) + '</div><span class="status-pill ' + statusClass(status) + '">' + esc(status || 'Open') + '</span></div><div class="record-meta">' + meta + '</div></article>'; }
function renderOverview() {
  var analytics = dashboard.analytics || {};
  var monthly = analytics.monthly || [];
  mainPanel.innerHTML = '<div class="dashboard-grid"><div style="display:grid;gap:20px;"><section class="panel"><div class="panel-head"><h2>Recent Project Requests</h2><button class="btn ghost" data-open="requests">View all</button></div>' + recordList((dashboard.requests || []).slice(0,5), 'No requests yet.', function(item) { var req = item.requirements || {}; return record(item.requestId || 'Request', item.status, esc((item.contact && item.contact.fullName) || 'Client') + ' - ' + esc(req.projectType || req.websiteType || 'Project')); }) + '</section><section class="panel"><div class="panel-head"><h2>Recent Clients</h2><button class="btn ghost" data-open="clients">View clients</button></div>' + recordList((dashboard.clients || []).slice(0,5), 'No clients yet.', function(item) { return record(item.fullName || item.email, item.userType || 'Client', esc(item.companyName || '') + '<br>' + esc(item.email || '')); }) + '</section></div><div style="display:grid;gap:20px;"><section class="panel"><h2 style="margin-bottom:18px;">Monthly Leads</h2>' + recordList(monthly, 'No analytics yet.', function(item) { return record(item.month, item.count + ' leads', 'Captured project inquiries'); }) + '</section><section class="panel"><h2 style="margin-bottom:18px;">Operations Summary</h2><div class="info-table"><div class="info-row"><span>Completed Projects</span><span>' + esc((dashboard.metrics || {}).completedProjects || 0) + '</span></div><div class="info-row"><span>Monthly Leads</span><span>' + esc((dashboard.metrics || {}).monthlyLeads || 0) + '</span></div><div class="info-row"><span>Revenue</span><span>' + money((dashboard.metrics || {}).revenueGenerated || 0) + '</span></div></div></section></div></div>';
}
function renderPanel(name) {
  document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.panel === name); });
  if (!dashboard) return;
  if (name === 'dashboard') return renderOverview();
  if (name === 'clients') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Clients</h2></div>' + recordList(dashboard.clients, 'No clients yet.', function(item) { return record(item.fullName || item.email, item.userType || 'Client', esc(item.companyName || '') + '<br>' + esc(item.email || '') + ' - ' + esc(item.phoneNumber || '')); }) + '</section>';
  if (name === 'requests') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Requests</h2><a class="btn ghost" href="/admin/project-requests">Detailed Request Admin</a></div>' + recordList(dashboard.requests, 'No project requests yet.', function(item) { var req = item.requirements || {}; return record(item.requestId || 'Request', item.status, esc((item.contact && item.contact.fullName) || '') + '<br>' + esc(req.projectType || req.websiteType || 'Project')); }) + '</section>';
  if (name === 'projects') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Projects</h2></div>' + recordList(dashboard.projects, 'No projects yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Manager: ' + esc(item.projectManager || 'Not assigned') + '<br>Deadline: ' + fmtDate(item.deadline)); }) + '</section>';
  if (name === 'team') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Team Assignments</h2></div>' + recordList(dashboard.projects, 'No team assignments yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Manager: ' + esc(item.projectManager || 'Not assigned') + '<br>Team: ' + esc((item.assignedDevelopers || []).join(', ') || 'Not assigned')); }) + '</section>';
  if (name === 'payments') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Payments</h2></div>' + recordList(dashboard.payments, 'No payments recorded yet.', function(item) { return record(item.paymentId || 'Payment', item.status, money(item.amount) + '<br>' + esc(item.clientEmail || '') + '<br>' + esc(item.milestoneTitle || item.invoiceNumber || 'Payment')); }) + '</section>';
  if (name === 'pricing') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Pricing Catalog</h2><button class="btn" id="savePricingBtn">Save Prices</button></div><p class="row-meta" style="margin-bottom:14px;">Edit unit prices and triggers. These prices calculate automatic project estimates and generate client invoice PDFs after request submission.</p><div id="pricingEditor" class="records"><div class="empty">Loading pricing catalog...</div></div></section>';
  if (name === 'quotations') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Quotations</h2></div>' + recordList(dashboard.quotations, 'No quotations yet.', function(item) { return record(item.quotationId || item.title, item.status, money(item.amount) + '<br>' + esc(item.clientEmail || '')); }) + '</section>';
  if (name === 'invoices') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Invoices</h2></div>' + recordList(dashboard.invoices, 'No invoices yet.', function(item) { return record(item.invoiceNumber || 'Invoice', item.status, money(item.amount) + '<br>Due ' + fmtDate(item.dueDate)); }) + '</section>';
  if (name === 'documents') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Files & Assets</h2></div>' + recordList(dashboard.documents, 'No documents yet.', function(item) { return record(item.originalName || 'Document', item.uploadedBy || 'File', esc(item.clientEmail || '') + '<br><a style="color:var(--blue);font-weight:850;" target="_blank" rel="noopener" href="' + esc(item.url) + '">Download file</a>'); }) + '</section>';
  if (name === 'messages') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Messages</h2></div>' + recordList(dashboard.messages, 'No messages yet.', function(item) { return record(item.subject || 'Message', item.senderRole || 'Message', esc(item.clientEmail || '') + '<br>' + esc(item.body || '')); }) + '</section>';
  if (name === 'timeline') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Timeline</h2></div>' + recordList(dashboard.projects, 'No timeline data yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Progress: ' + esc(item.progress || 0) + '%<br>Deadline: ' + fmtDate(item.deadline)); }) + '</section>';
  if (name === 'risks') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Risk Tracking</h2></div>' + recordList(dashboard.projects, 'No project risks recorded yet.', function(item) { return record(item.projectId || item.title, item.riskLevel || 'Low', esc(item.title || '') + '<br>Status: ' + esc(item.status || 'Pending') + '<br>Progress: ' + esc(item.progress || 0) + '%'); }) + '</section>';
  if (name === 'deliverables') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Deliverables</h2></div>' + recordList(dashboard.projects, 'No deliverables recorded yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>' + esc((item.deliverables || []).join(', ') || 'No deliverables listed yet.')); }) + '</section>';
  if (name === 'assistant') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project AI Assistant</h2></div><form id="assistantForm" class="form-panel"><div class="grid"><div class="field"><label>Client Email</label><input name="clientEmail"></div><div class="field"><label>Project ID</label><input name="projectId"></div><div class="field full"><label>Question</label><textarea name="question" placeholder="Ask for a proposal outline, risk summary, next milestone, or project status explanation."></textarea></div></div><button class="btn" type="submit">Ask YenkasaAI</button></form><div id="assistantAnswer" class="empty" style="margin-top:16px;">Assistant response will appear here.</div></section>';
  if (name === 'analytics') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Analytics</h2></div><div class="dashboard-grid"><div>' + recordList((dashboard.analytics && dashboard.analytics.byType) || [], 'No type analytics yet.', function(item) { return record(item.type, item.count + ' requests', 'Project category performance'); }) + '</div><div>' + recordList((dashboard.analytics && dashboard.analytics.byStatus) || [], 'No status analytics yet.', function(item) { return record(item.status, item.count + ' requests', 'Pipeline status'); }) + '</div></div></section>';
  if (name === 'settings') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Settings</h2></div><div class="info-table"><div class="info-row"><span>Admin Emails</span><span>SOFTOTECH_ADMIN_EMAILS or ADMIN_EMAILS</span></div><div class="info-row"><span>Storage</span><span>Google Firestore under the current GCloud project</span></div><div class="info-row"><span>Media</span><span>Google Cloud Storage through mediaStorage</span></div></div></section>';
  if (name === 'assistant') document.getElementById('assistantForm').addEventListener('submit', askAssistant);
  if (name === 'pricing') loadPricing();
}
async function askAssistant(event) {
  event.preventDefault();
  var responseBox = document.getElementById('assistantAnswer');
  responseBox.textContent = 'Thinking...';
  var response = await fetch('/api/project-portal/assistant', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(Object.fromEntries(new FormData(event.target))) });
  var payload = await response.json();
  responseBox.textContent = (payload.result && payload.result.answer) || payload.message || 'No answer returned.';
}
async function loadPricing() {
  var host = document.getElementById('pricingEditor');
  var response = await fetch('/api/project-portal/admin/pricing', { headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) { host.innerHTML = '<div class="empty">' + esc(payload.message || 'Pricing unavailable.') + '</div>'; return; }
  host.innerHTML = (payload.items || []).map(function(item) {
    return '<article class="record pricing-row" data-key="' + esc(item.key) + '"><div class="grid"><div class="field"><label>Item</label><input data-field="label" value="' + esc(item.label) + '"></div><div class="field"><label>Billing Type</label><input data-field="billingType" value="' + esc(item.billingType) + '"></div><div class="field"><label>Unit Price</label><input data-field="unitPrice" type="number" min="0" step="0.01" value="' + esc(item.unitPrice) + '"></div><div class="field"><label>Category</label><input data-field="category" value="' + esc(item.category) + '"></div><div class="field full"><label>Triggers, comma-separated</label><input data-field="triggers" value="' + esc((item.triggers || []).join(', ')) + '"></div><label style="display:flex;gap:8px;align-items:center;"><input data-field="active" type="checkbox" ' + (item.active === false ? '' : 'checked') + '> Active</label></div></article>';
  }).join('');
  document.getElementById('savePricingBtn').addEventListener('click', savePricing);
}
async function savePricing() {
  var rows = Array.from(document.querySelectorAll('.pricing-row')).map(function(row) {
    var value = function(field) { return row.querySelector('[data-field="' + field + '"]'); };
    return {
      key: row.dataset.key,
      label: value('label').value,
      billingType: value('billingType').value,
      unitPrice: Number(value('unitPrice').value || 0),
      category: value('category').value,
      triggers: value('triggers').value.split(',').map(function(item) { return item.trim(); }).filter(Boolean),
      active: value('active').checked
    };
  });
  var response = await fetch('/api/project-portal/admin/pricing', { method:'PUT', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify({ items: rows }) });
  var payload = await response.json();
  if (!response.ok || !payload.success) alert(payload.message || 'Could not save pricing.');
  else alert('Pricing saved. New project requests will use the updated prices.');
}
async function loadAdmin() {
  errorBox.style.display = 'none';
  var response = await fetch('/api/project-portal/admin/dashboard', { headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load admin dashboard.');
  dashboard = payload.dashboard;
  document.getElementById('tokenPanel').style.display = 'none';
  renderMetrics();
  renderPanel('dashboard');
}
document.getElementById('loadBtn').addEventListener('click', function() { loadAdmin().catch(function(error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }); });
document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.addEventListener('click', function() { renderPanel(btn.dataset.panel); }); });
document.body.addEventListener('click', function(event) { var target = event.target.closest('[data-open]'); if (target) { event.preventDefault(); renderPanel(target.dataset.open); } });
document.getElementById('logoutBtn').addEventListener('click', function() { localStorage.removeItem('softOTechPortalToken'); window.location.href = '/client/login'; });
if (tokenInput.value.trim()) loadAdmin().catch(function() {});
</script>`,
  }));
});

module.exports = router;
