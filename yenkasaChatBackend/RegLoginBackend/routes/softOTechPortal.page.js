const express = require('express');

const router = express.Router();

function shell({ title, body, nonce = '' }) {
  const scriptNonce = nonce ? ` nonce="${String(nonce).replace(/"/g, '&quot;')}"` : '';
  const safeBody = String(body || '').replace(
    /<script(?![^>]*\bsrc=)([^>]*)>/g,
    `<script${scriptNonce}$1>`,
  );

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
    .sidebar { background:linear-gradient(180deg,var(--nav),var(--nav2)); color:white; padding:28px 14px; position:sticky; top:0; height:100vh; min-height:100vh; align-self:start; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; }
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
    .request-review { display:grid; gap:16px; color:#263246; }
    .request-hero { border-radius:14px; padding:16px; background:linear-gradient(135deg,#f0f7ff,#f7fbff); border:1px solid #bfdbfe; display:grid; gap:8px; }
    .request-hero strong { font-size:1.1rem; color:#071a33; }
    .request-tags { display:flex; gap:8px; flex-wrap:wrap; }
    .request-tag { display:inline-flex; align-items:center; min-height:28px; border-radius:999px; padding:5px 10px; background:white; color:#1d4ed8; border:1px solid #bfdbfe; font-size:.82rem; font-weight:850; }
    .request-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .request-block { border:1px solid var(--line); border-top:5px solid var(--block-color,#1265ff); border-radius:14px; padding:15px; background:var(--block-bg,#fbfdff); box-shadow:0 10px 24px rgba(15,23,42,.04); }
    .request-block h3 { margin:0 0 11px; font-size:.95rem; color:#111827; display:flex; align-items:center; gap:8px; }
    .request-block h3:before { content:""; width:9px; height:9px; border-radius:999px; background:var(--block-color,#1265ff); display:inline-block; }
    .request-block p { margin:0; line-height:1.7; color:#526176; }
    .request-block.client { --block-color:#1265ff; --block-bg:#f8fbff; }
    .request-block.description { --block-color:#14b85a; --block-bg:#f7fef9; }
    .request-block.objectives { --block-color:#7c3aed; --block-bg:#fbf7ff; }
    .request-block.platforms { --block-color:#0ea5e9; --block-bg:#f0f9ff; }
    .request-block.features { --block-color:#f97316; --block-bg:#fff7ed; }
    .request-block.integrations { --block-color:#ef4444; --block-bg:#fff7f7; }
    .request-block.infrastructure { --block-color:#334155; --block-bg:#f8fafc; }
    .request-block.budget { --block-color:#16a34a; --block-bg:#f3fbf6; }
    .request-block.review { --block-color:#9333ea; --block-bg:#faf5ff; }
    .request-chip-list { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
    .request-chip { border:1px solid rgba(15,23,42,.1); border-radius:999px; padding:6px 10px; background:white; color:#334155; font-size:.84rem; font-weight:750; }
    .request-detail-list { display:grid; gap:8px; }
    .request-detail { display:grid; grid-template-columns:150px minmax(0,1fr); gap:12px; align-items:start; border-top:1px solid rgba(15,23,42,.08); padding-top:8px; }
    .request-detail:first-child { border-top:0; padding-top:0; }
    .request-detail span:first-child { color:#64748b; font-weight:850; }
    .request-detail span:last-child { color:#263246; overflow-wrap:anywhere; }
    .assignment-layout { display:grid; grid-template-columns:360px minmax(0,1fr); gap:20px; align-items:start; }
    .assignment-projects { display:grid; gap:10px; max-height:660px; overflow:auto; padding-right:4px; }
    .assignment-project { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fbfdff; cursor:pointer; text-align:left; }
    .assignment-project.active { border-color:#1265ff; background:#eff6ff; box-shadow:0 0 0 3px #dbeafe; }
    .assignment-card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .team-member-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:white; display:grid; gap:10px; }
    .team-member-head { display:flex; gap:10px; align-items:center; }
    .team-member-photo { width:42px; height:42px; border-radius:999px; object-fit:contain; object-position:center top; background:#f8fafc; border:1px solid var(--line); }
    .availability { display:inline-flex; width:max-content; border-radius:999px; padding:4px 9px; font-size:.78rem; font-weight:850; background:#dcfce7; color:#15803d; }
    .availability.Limited { background:#ffedd5; color:#c2410c; }
    .availability.Unavailable { background:#fee2e2; color:#b91c1c; }
    .assignment-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .assignment-role-card { border:1px solid var(--line); border-top:5px solid #1265ff; border-radius:14px; padding:14px; background:#f8fbff; }
    .assignment-role-card:nth-child(2n) { border-top-color:#14b85a; background:#f7fef9; }
    .assignment-role-card:nth-child(3n) { border-top-color:#f97316; background:#fff7ed; }
    .pricing-row { position:relative; padding-left:20px; border-width:2px; box-shadow:0 12px 28px rgba(7,18,38,.06); }
    .pricing-row:before { content:""; position:absolute; inset:0 auto 0 0; width:8px; border-radius:14px 0 0 14px; background:var(--blue); }
    .pricing-row:nth-child(6n+1) { background:#f8fbff; border-color:#bfdbfe; }
    .pricing-row:nth-child(6n+1):before { background:#1265ff; }
    .pricing-row:nth-child(6n+2) { background:#f7fef9; border-color:#bbf7d0; }
    .pricing-row:nth-child(6n+2):before { background:#14b85a; }
    .pricing-row:nth-child(6n+3) { background:#fffaf0; border-color:#fed7aa; }
    .pricing-row:nth-child(6n+3):before { background:#f97316; }
    .pricing-row:nth-child(6n+4) { background:#fbf7ff; border-color:#ddd6fe; }
    .pricing-row:nth-child(6n+4):before { background:#7c3aed; }
    .pricing-row:nth-child(6n+5) { background:#fff7f7; border-color:#fecaca; }
    .pricing-row:nth-child(6n+5):before { background:#ef4444; }
    .pricing-row:nth-child(6n) { background:#f8fafc; border-color:#cbd5e1; }
    .pricing-row:nth-child(6n):before { background:#334155; }
    .empty { border:1px dashed #cdd7e6; border-radius:14px; padding:24px; color:var(--muted); background:#fbfdff; }
    .form-panel { display:grid; gap:14px; max-width:980px; }
    @media (max-width:1180px) { .metrics, .quick-actions { grid-template-columns:repeat(2,minmax(0,1fr)); } .dashboard-grid { grid-template-columns:1fr; } .cost-grid { grid-template-columns:1fr; } }
    @media (max-width:1180px) { .assignment-layout { grid-template-columns:1fr; } .assignment-card-grid, .assignment-summary { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:860px) { .public-shell { grid-template-columns:1fr; background:#f8fbff; } .public-brand { min-height:auto; padding:26px; background:linear-gradient(135deg,#06182f,#0c2444); } .app-shell { grid-template-columns:1fr; } .sidebar { position:relative; height:auto; min-height:auto; max-height:none; overflow:visible; } .side-nav { grid-template-columns:repeat(2,minmax(0,1fr)); } .topbar { height:auto; padding:18px; align-items:flex-start; } .content { padding:18px; } .metrics, .quick-actions, .grid, .request-grid, .assignment-card-grid, .assignment-summary { grid-template-columns:1fr; } .request-detail { grid-template-columns:1fr; gap:4px; } .timeline { grid-template-columns:1fr; gap:16px; } .step:before { display:none; } }
  </style>
</head>
<body>${safeBody}</body>
</html>`;
}

function publicBrand() {
  return `<aside class="public-brand">
    <a class="brand-row" href="/"><img src="/images/logoYenkasaSoftOTechEmblem-512.jpeg" alt="Yenkasa Soft-O-Tech"><span>YENKASA<br>SOFT-O-TECH</span></a>
    <div class="public-copy">
      <h1>Build, manage, and track your project.</h1>
      <p>Client intake, requests, quotations, invoices, documents, and project communication in one professional workspace.</p>
    </div>
    <div><a class="btn secondary" href="/website-request">Request a Project</a></div>
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
    ['proposals', 'PP', 'Proposals'],
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
    ['leads', 'LD', 'Leads'],
    ['requests', 'PR', 'Project Requests'],
    ['projects', 'PJ', 'Projects'],
    ['assignments', 'AS', 'Assignment'],
    ['requirements', 'RQ', 'Requirements'],
    ['team', 'TM', 'Team Assignments'],
    ['payments', 'PY', 'Payments'],
    ['pricing', 'PC', 'Pricing Catalog'],
    ['quotations', 'QT', 'Quotations'],
    ['proposals', 'PP', 'Proposals'],
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
    <a class="brand-row" href="/"><img src="/images/logoYenkasaSoftOTechEmblem-512.jpeg" alt="Yenkasa Soft-O-Tech"><span>YENKASA<br>SOFT-O-TECH</span></a>
    <nav class="side-nav">${items.map(([key, icon, label]) => `<button class="nav-item ${key === active ? 'active' : ''}" data-panel="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</nav>
    <div style="margin-top:28px;"><button class="nav-item" id="logoutBtn"><span class="nav-icon">EX</span>Logout</button></div>
  </aside>`;
}

router.get('/software-solutions', (req, res) => {
  res.send(shell({
    nonce: res.locals.cspNonce,
    title: 'Software Solutions Portal | Yenkasa Soft-O-Tech',
    body: `<main class="public-shell">${publicBrand()}<section class="auth-card">
      <h2>Software Solutions Portal</h2>
      <p class="lead" style="margin-bottom:22px;">Request a website, mobile app, AI solution, business software, cloud deployment, or UI/UX project. Existing clients and Soft-O-Tech admins can access their workspaces here.</p>
      <div class="grid">
        <a class="record" href="/website-request"><div class="record-head"><div class="record-title">Request a Project</div><span class="status-pill blue">Lead Intake</span></div><div class="record-meta">Submit requirements, budget, timeline, files, and contact details.</div></a>
        <a class="record" href="/client/register"><div class="record-head"><div class="record-title">Client Registration</div><span class="status-pill green">New Client</span></div><div class="record-meta">Create a client account before or after submitting a request.</div></a>
        <a class="record" href="/client/login"><div class="record-head"><div class="record-title">Client Login</div><span class="status-pill">Portal</span></div><div class="record-meta">Track projects, messages, documents, invoices, payments, and quotations.</div></a>
        <a class="record" href="/admin/login"><div class="record-head"><div class="record-title">Admin Login</div><span class="status-pill orange">Team</span></div><div class="record-meta">Manage clients, requests, projects, proposals, milestones, and payments.</div></a>
        <a class="record full" href="/services"><div class="record-head"><div class="record-title">View Services</div><span class="status-pill blue">Soft-O-Tech</span></div><div class="record-meta">Website Development, Mobile Apps, AI Solutions, API Development, Cloud Deployment, UI/UX Design, and Technical Consulting.</div></a>
      </div>
    </section></main>`,
  }));
});

router.get('/client/register', (req, res) => {
  res.send(shell({
    nonce: res.locals.cspNonce,
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
        <div class="full" style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" type="submit">Create Account</button><a class="btn ghost" id="loginInstead" href="/client/login">Login Instead</a></div>
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
    var returnTo = new URLSearchParams(window.location.search).get('returnTo') || '';
    window.location.href = returnTo || '/client/dashboard';
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
var registerReturnTo = new URLSearchParams(window.location.search).get('returnTo') || '';
if (registerReturnTo) document.getElementById('loginInstead').href = '/client/login?returnTo=' + encodeURIComponent(registerReturnTo);
</script>`,
  }));
});

router.get('/client/login', (req, res) => {
  res.send(shell({
    nonce: res.locals.cspNonce,
    title: 'Client Login | Yenkasa Soft-O-Tech',
    body: `<main class="public-shell">${publicBrand()}<section class="auth-card">
      <h2>Client portal login</h2>
      <p class="lead" style="margin-bottom:22px;">Access your project workspace, documents, quotations, invoices, and messages.</p>
      <form id="loginForm" class="grid">
        <div class="field full"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
        <div class="field full"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div>
        <p class="error full" id="errorBox"></p>
        <div class="full" style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" type="submit">Login</button><a class="btn ghost" id="registerInstead" href="/client/register">Create Account</a></div>
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
    var returnTo = new URLSearchParams(window.location.search).get('returnTo') || '';
    window.location.href = returnTo || (payload.client && payload.client.is_admin ? '/admin' : '/client/dashboard');
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
var loginReturnTo = new URLSearchParams(window.location.search).get('returnTo') || '';
if (loginReturnTo) document.getElementById('registerInstead').href = '/client/register?returnTo=' + encodeURIComponent(loginReturnTo);
</script>`,
  }));
});

router.get('/admin/login', (req, res) => {
  res.send(shell({
    nonce: res.locals.cspNonce,
    title: 'Admin Login | Yenkasa Soft-O-Tech',
    body: `<main class="public-shell">${publicBrand()}<section class="auth-card">
      <h2>Admin operations login</h2>
      <p class="lead" style="margin-bottom:22px;">Access client management, project requests, quotations, invoices, pricing, and portfolio operations with an approved admin account.</p>
      <form id="adminLoginForm" class="grid">
        <div class="field full"><label>Admin Email</label><input name="email" type="email" autocomplete="email" required></div>
        <div class="field full"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div>
        <p class="error full" id="errorBox"></p>
        <div class="full" style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn" type="submit">Login to Admin</button>
          <a class="btn ghost" href="/client/login">Client Login</a>
          <a class="btn ghost" href="/portfolio-admin/login">Portfolio Admin</a>
        </div>
      </form>
    </section></main>
<script>
document.getElementById('adminLoginForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  var errorBox = document.getElementById('errorBox');
  errorBox.style.display = 'none';
  try {
    var response = await fetch('/api/project-portal/auth/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    var payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Admin login failed.');
    localStorage.setItem('softOTechPortalToken', payload.token);
    localStorage.setItem('portfolioAdminToken', payload.token);
    var returnTo = new URLSearchParams(window.location.search).get('returnTo') || '';
    window.location.href = returnTo || '/admin';
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
</script>`,
  }));
});

function portfolioAdminAuthPage(mode = 'login', nonce = '') {
  const isRegister = mode === 'register';
  const title = isRegister ? 'Portfolio Admin Register | Yenkasa Soft-O-Tech' : 'Portfolio Admin Login | Yenkasa Soft-O-Tech';
  const endpoint = isRegister ? '/api/portfolio/auth/register' : '/api/portfolio/auth/login';
  const formFields = isRegister
    ? `<div class="field"><label>Full Name</label><input name="fullName" autocomplete="name" required></div>
        <div class="field"><label>Company</label><input name="companyName" value="Yenkasa Soft-O-Tech" autocomplete="organization"></div>
        <div class="field"><label>Admin Email</label><input name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label>Password</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div>
        <div class="field"><label>Phone</label><input name="phoneNumber" autocomplete="tel"></div>
        <div class="field"><label>Role Purpose</label><input value="Portfolio media and product content admin" readonly></div>`
    : `<div class="field full"><label>Admin Email</label><input name="email" type="email" autocomplete="email" required></div>
        <div class="field full"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div>`;

  return shell({
    nonce,
    title,
    body: `<main class="public-shell">${publicBrand()}<section class="auth-card">
      <h2>${isRegister ? 'Create portfolio admin account' : 'Portfolio admin login'}</h2>
      <p class="lead" style="margin-bottom:16px;">Login with an internally approved Yenkasa Soft-O-Tech admin account to manage product media, screenshots, videos, and portfolio content.</p>
      <form id="portfolioAuthForm" class="grid">
        ${formFields}
        <p class="error full" id="errorBox"></p>
        <div class="full" style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn" type="submit">${isRegister ? 'Create Admin Account' : 'Login to Portfolio Admin'}</button>
          <a class="btn ghost" href="${isRegister ? '/portfolio-admin/login' : '/portfolio-admin/register'}">${isRegister ? 'Login Instead' : 'Register Admin Email'}</a>
          <a class="btn ghost" href="/">Back to Portfolio</a>
        </div>
      </form>
    </section></main>
<script>
document.getElementById('portfolioAuthForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  var errorBox = document.getElementById('errorBox');
  errorBox.style.display = 'none';
  try {
    var formData = Object.fromEntries(new FormData(event.target));
    var response = await fetch('${endpoint}', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formData) });
    var payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || '${isRegister ? 'Registration' : 'Login'} failed.');
    if (!payload.client || (!payload.client.is_admin && payload.client.role !== 'senior_developer')) throw new Error('This account is not configured as a portfolio admin.');
    localStorage.setItem('softOTechPortalToken', payload.token);
    localStorage.setItem('portfolioAdminToken', payload.token);
    window.location.href = '/portfolio-admin';
  } catch (error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }
});
</script>`,
  });
}

router.get('/portfolio-admin/login', (req, res) => {
  res.send(portfolioAdminAuthPage('login', res.locals.cspNonce));
});

router.get('/portfolio-admin/register', (req, res) => {
  res.send(portfolioAdminAuthPage('register', res.locals.cspNonce));
});

router.get('/portfolio-admin', (req, res) => {
  res.send(shell({
    nonce: res.locals.cspNonce,
    title: 'Portfolio Admin | Yenkasa Soft-O-Tech',
    body: `<main class="app-shell"><aside class="sidebar">
      <a class="brand-row" href="/"><img src="/images/logoYenkasaSoftOTechEmblem-512.jpeg" alt="Yenkasa Soft-O-Tech"><span>YENKASA<br>PORTFOLIO</span></a>
      <nav class="side-nav">
        <button class="nav-item active" type="button"><span class="nav-icon">PR</span>Products</button>
        <a class="nav-item" href="/admin"><span class="nav-icon">AD</span>Project Admin</a>
        <a class="nav-item" href="/"><span class="nav-icon">WB</span>Website</a>
      </nav>
      <div style="margin-top:28px;"><button class="nav-item" id="logoutBtn" type="button"><span class="nav-icon">EX</span>Logout</button></div>
    </aside><section class="workspace">
      <header class="topbar"><div><h1>Portfolio Product Gallery</h1><p>Update product pages, screenshots, videos, stack, status, and achievements.</p></div><div class="top-actions"><button class="btn ghost" id="reloadBtn" type="button">Reload</button><button class="btn" id="saveBtn" type="button">Save Content</button><div class="avatar">PA</div></div></header>
      <section class="content">
        <section class="panel" id="statusPanel"><div class="panel-head"><h2>Portfolio Content</h2><span class="status-pill blue" id="collectionLabel">Loading</span></div><p class="row-meta" id="statusText">Checking portfolio admin access...</p><p class="error" id="errorBox"></p></section>
        <section class="records" id="productsEditor"></section>
      </section>
    </section></main>
<script>
var token = localStorage.getItem('portfolioAdminToken') || localStorage.getItem('softOTechPortalToken') || '';
if (!token) window.location.href = '/portfolio-admin/login';
var content = null;
var products = [];
var teamMembers = [];
var editor = document.getElementById('productsEditor');
var errorBox = document.getElementById('errorBox');
var statusText = document.getElementById('statusText');
var collectionLabel = document.getElementById('collectionLabel');
function headers(extra) { return Object.assign({ Authorization:'Bearer ' + token }, extra || {}); }
function esc(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function listText(value) { return Array.isArray(value) ? value.join('\\n') : ''; }
function splitList(value) { return String(value || '').split(/[\\n,]+/).map(function(item) { return item.trim(); }).filter(Boolean); }
function productById(id) { return products.find(function(product) { return product.id === id; }); }
function teamById(id) { return teamMembers.find(function(member) { return member.id === id; }); }
function mediaList(product, type) {
  var items = product[type] || [];
  if (!items.length) return '<div class="empty">No ' + esc(type) + ' uploaded yet.</div>';
  return '<div class="records">' + items.map(function(item, index) {
    var src = item.src || item.url || '';
    var preview = type === 'videos'
      ? '<video controls muted src="' + esc(src) + '" style="width:100%;max-height:220px;border-radius:8px;background:#020b18;"></video>'
      : '<img src="' + esc(src) + '" alt="' + esc(item.title || product.name) + '" style="width:100%;height:220px;object-fit:contain;object-position:center;background:#f8fafc;border-radius:8px;border:1px solid var(--line);">';
    return '<article class="record">' + preview + '<div class="record-head"><div class="record-title">' + esc(item.title || src) + '</div><button class="btn danger" type="button" data-remove-media="' + esc(product.id) + '" data-type="' + esc(type) + '" data-index="' + index + '">Remove</button></div><div class="record-meta">' + esc(src) + '</div></article>';
  }).join('') + '</div>';
}
function productCard(product) {
  return '<article class="panel product-card" data-product-id="' + esc(product.id) + '"><div class="panel-head"><div><h2>' + esc(product.name || product.id) + '</h2><p class="row-meta">' + esc(product.id) + '</p></div><span class="status-pill green">' + esc(product.status || 'Product') + '</span></div><div class="grid"><div class="field"><label>Name</label><input data-field="name" value="' + esc(product.name) + '"></div><div class="field"><label>Status</label><input data-field="status" value="' + esc(product.status) + '"></div><div class="field full"><label>Description</label><textarea data-field="description">' + esc(product.description) + '</textarea></div><div class="field"><label>Stack, one per line</label><textarea data-field="stack">' + esc(listText(product.stack)) + '</textarea></div><div class="field"><label>Achievements, one per line</label><textarea data-field="achievements">' + esc(listText(product.achievements)) + '</textarea></div></div><div style="height:16px"></div><form class="form-panel upload-form" data-upload-product="' + esc(product.id) + '" enctype="multipart/form-data"><div class="grid"><div class="field"><label>Media Type</label><select name="type"><option value="screenshots">Screenshot/Image</option><option value="videos">Video</option></select></div><div class="field"><label>Title</label><input name="title" placeholder="Homepage screenshot"></div><div class="field full"><label>File</label><input name="file" type="file" accept="image/*,video/*" required></div></div><button class="btn secondary" type="submit">Upload Media</button></form><div style="height:18px"></div><div class="dashboard-grid"><section><div class="panel-head"><h2>Screenshots</h2></div>' + mediaList(product, 'screenshots') + '</section><section><div class="panel-head"><h2>Videos</h2></div>' + mediaList(product, 'videos') + '</section></div></article>';
}
function teamCard(member) {
  var photo = member.photo || '/images/default.png';
  return '<article class="panel team-card" data-team-id="' + esc(member.id) + '"><div class="panel-head"><div><h2>' + esc(member.name || member.id) + '</h2><p class="row-meta">' + esc(member.role || 'Team Member') + '</p></div><img src="' + esc(photo) + '" alt="' + esc(member.name || '') + '" style="width:76px;height:76px;border-radius:999px;object-fit:contain;object-position:center top;background:#f8fafc;border:1px solid var(--line);"></div><div class="grid"><div class="field"><label>Name</label><input data-field="name" value="' + esc(member.name) + '"></div><div class="field"><label>Role</label><input data-field="role" value="' + esc(member.role) + '"></div><div class="field full"><label>Photo URL</label><input data-field="photo" value="' + esc(photo) + '"></div><div class="field full"><label>Background</label><textarea data-field="background">' + esc(member.background) + '</textarea></div><div class="field"><label>Field of Study</label><input data-field="fieldOfStudy" value="' + esc(member.fieldOfStudy) + '"></div><div class="field"><label>Major / Focus</label><input data-field="major" value="' + esc(member.major) + '"></div></div><div style="height:16px"></div><form class="form-panel team-upload-form" data-team-upload="' + esc(member.id) + '" enctype="multipart/form-data"><div class="grid"><div class="field full"><label>Upload Team Photo</label><input name="file" type="file" accept="image/*" required></div></div><button class="btn secondary" type="submit">Upload Photo</button></form></article>';
}
function render() {
  editor.innerHTML = '<section class="panel"><div class="panel-head"><h2>Products Gallery</h2></div><div class="records">' + products.map(productCard).join('') + '</div></section><section class="panel"><div class="panel-head"><h2>Team Members</h2><button class="btn ghost" type="button" id="addTeamBtn">Add Member</button></div><div class="records">' + teamMembers.map(teamCard).join('') + '</div></section>';
  bindUploads();
  bindTeamUploads();
  var addBtn = document.getElementById('addTeamBtn');
  if (addBtn) addBtn.onclick = function() {
    var id = 'team-member-' + Date.now();
    teamMembers.push({ id:id, name:'New Team Member', role:'Team Member', photo:'/images/default.png', background:'', fieldOfStudy:'', major:'' });
    render();
  };
}
function collectProducts() {
  document.querySelectorAll('.product-card').forEach(function(card) {
    var product = productById(card.dataset.productId);
    if (!product) return;
    product.name = card.querySelector('[data-field="name"]').value.trim();
    product.status = card.querySelector('[data-field="status"]').value.trim();
    product.description = card.querySelector('[data-field="description"]').value.trim();
    product.stack = splitList(card.querySelector('[data-field="stack"]').value);
    product.achievements = splitList(card.querySelector('[data-field="achievements"]').value);
  });
  return products;
}
function collectTeamMembers() {
  document.querySelectorAll('.team-card').forEach(function(card) {
    var member = teamById(card.dataset.teamId);
    if (!member) return;
    member.name = card.querySelector('[data-field="name"]').value.trim();
    member.role = card.querySelector('[data-field="role"]').value.trim();
    member.photo = card.querySelector('[data-field="photo"]').value.trim();
    member.background = card.querySelector('[data-field="background"]').value.trim();
    member.fieldOfStudy = card.querySelector('[data-field="fieldOfStudy"]').value.trim();
    member.major = card.querySelector('[data-field="major"]').value.trim();
  });
  return teamMembers;
}
async function verifyAdmin() {
  var response = await fetch('/api/portfolio/admin/verify', { headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error || payload.message || 'Portfolio admin login is required.');
}
async function loadContent() {
  errorBox.style.display = 'none';
  statusText.textContent = 'Loading portfolio products...';
  await verifyAdmin();
  var response = await fetch('/api/portfolio/content');
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error || payload.message || 'Could not load portfolio content.');
  content = payload.content || {};
  products = (content.products || []).map(function(product) {
    return Object.assign({ screenshots: [], videos: [] }, product);
  });
  teamMembers = (content.teamMembers || []).map(function(member) {
    return Object.assign({ photo: '/images/default.png', background: '', fieldOfStudy: '', major: '' }, member);
  });
  collectionLabel.textContent = payload.collection || 'Firestore';
  statusText.textContent = 'Loaded ' + products.length + ' products from portfolio content.';
  render();
}
async function saveContent() {
  errorBox.style.display = 'none';
  statusText.textContent = 'Saving portfolio content...';
  var updated = Object.assign({}, content || {}, { products: collectProducts(), teamMembers: collectTeamMembers() });
  var response = await fetch('/api/portfolio/content', { method:'PUT', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify({ content: updated }) });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error || payload.message || 'Could not save portfolio content.');
  content = payload.content || updated;
  products = (content.products || products).map(function(product) { return Object.assign({ screenshots: [], videos: [] }, product); });
  teamMembers = (content.teamMembers || teamMembers).map(function(member) { return Object.assign({ photo: '/images/default.png', background: '', fieldOfStudy: '', major: '' }, member); });
  statusText.textContent = 'Portfolio content saved.';
  render();
}
function bindUploads() {
  document.querySelectorAll('.upload-form').forEach(function(form) {
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      errorBox.style.display = 'none';
      try {
        collectProducts();
        var product = productById(form.dataset.uploadProduct);
        var data = new FormData(form);
        data.set('product', product.id);
        statusText.textContent = 'Uploading media for ' + product.name + '...';
        var response = await fetch('/api/portfolio/media', { method:'POST', headers:headers(), body:data });
        var payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || payload.message || 'Upload failed.');
        var type = payload.type === 'videos' ? 'videos' : 'screenshots';
        product[type] = product[type] || [];
        product[type].push({ title: payload.title || data.get('title') || payload.originalName, src: payload.url });
        form.reset();
        await saveContent();
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.style.display = 'block';
        statusText.textContent = 'Upload failed.';
      }
    });
  });
}
function bindTeamUploads() {
  document.querySelectorAll('.team-upload-form').forEach(function(form) {
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      errorBox.style.display = 'none';
      try {
        collectProducts();
        collectTeamMembers();
        var member = teamById(form.dataset.teamUpload);
        var data = new FormData(form);
        data.set('teamMemberId', member.id);
        data.set('title', member.name || 'Team photo');
        statusText.textContent = 'Uploading photo for ' + member.name + '...';
        var response = await fetch('/api/portfolio/media', { method:'POST', headers:headers(), body:data });
        var payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || payload.message || 'Photo upload failed.');
        member.photo = payload.url;
        var card = form.closest('.team-card');
        if (card) {
          var photoInput = card.querySelector('[data-field="photo"]');
          var preview = card.querySelector('img');
          if (photoInput) photoInput.value = payload.url;
          if (preview) preview.src = payload.url;
        }
        form.reset();
        await saveContent();
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.style.display = 'block';
        statusText.textContent = 'Photo upload failed.';
      }
    });
  });
}
document.body.addEventListener('click', function(event) {
  var remove = event.target.closest('[data-remove-media]');
  if (!remove) return;
  event.preventDefault();
  var product = productById(remove.dataset.removeMedia);
  var type = remove.dataset.type;
  var index = Number(remove.dataset.index);
  if (!product || !Array.isArray(product[type])) return;
  product[type].splice(index, 1);
  render();
});
document.getElementById('saveBtn').addEventListener('click', function() { saveContent().catch(function(error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; statusText.textContent = 'Save failed.'; }); });
document.getElementById('reloadBtn').addEventListener('click', function() { loadContent().catch(function(error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; statusText.textContent = 'Load failed.'; }); });
document.getElementById('logoutBtn').addEventListener('click', function() { localStorage.removeItem('portfolioAdminToken'); localStorage.removeItem('softOTechPortalToken'); window.location.href = '/portfolio-admin/login'; });
loadContent().catch(function(error) {
  errorBox.textContent = error.message;
  errorBox.style.display = 'block';
  statusText.textContent = 'Portfolio admin access failed.';
  if (/login|token|expired|invalid/i.test(error.message)) setTimeout(function() { window.location.href = '/portfolio-admin/login'; }, 1200);
});
</script>`,
  }));
});

router.get('/client/dashboard', (req, res) => {
  res.send(shell({
    nonce: res.locals.cspNonce,
    title: 'Client Dashboard | Yenkasa Soft-O-Tech',
    body: `<main class="app-shell">${sidebar('dashboard', 'client')}<section class="workspace">
      <header class="topbar"><div><h1 id="welcomeTitle">Welcome back</h1><p id="welcomeSub">Here is what is happening with your project.</p></div><div class="top-actions"><a class="btn ghost" href="/website-request?from=client-dashboard">New Request</a><div class="avatar" id="avatar">YS</div></div></header>
      <section class="content">
        <section class="metrics" id="metrics"></section>
        <section id="mainPanel"></section>
        <p class="error" id="errorBox"></p>
      </section>
    </section></main>
<script>
var token = localStorage.getItem('softOTechPortalToken') || '';
if (!token) window.location.href = '/client/login?returnTo=/client/dashboard';
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
function quotationActions(item) {
  if (!item || !item.quotationId || !['Draft','Sent'].includes(String(item.status || ''))) return '';
  return '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn secondary" type="button" data-quote-response="' + esc(item.quotationId) + '" data-status="Accepted">Accept Quotation</button><button class="btn danger" type="button" data-quote-response="' + esc(item.quotationId) + '" data-status="Rejected">Reject</button></div>';
}
function renderPanel(name) {
  activePanel = name;
  document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.panel === name); });
  if (name === 'dashboard') return renderOverview();
  if (name === 'requests') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Requests</h2><a class="btn" href="/website-request?from=client-dashboard">New Request</a></div>' + recordList(dashboard.requests, 'No project requests yet.', function(item) { var req = item.requirements || {}; return record(item.requestId, item.status, esc(req.projectType || req.websiteType || 'Project request') + '<br>Submitted ' + fmtDate(item.submittedAt)); }) + '</section>';
  if (name === 'projects') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Details</h2></div>' + renderProjectInfo() + renderTimeline() + '</section>';
  if (name === 'costs') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Cost</h2></div>' + renderCostSummary() + '<div style="height:16px"></div>' + recordList(dashboard.quotations, 'No quotations yet.', function(item) { return record(item.quotationId || item.title || 'Quotation', item.status, money(item.amount) + '<br>' + esc(item.title || item.projectTitle || 'Project quotation') + '<br>' + esc((item.lineItems || []).map(function(line) { return line.serviceName || line.description; }).filter(Boolean).join(', ')), quotationActions(item)); }) + '<div style="height:16px"></div>' + recordList(dashboard.invoices, 'No invoices yet.', function(item) { return record(item.invoiceNumber || 'Invoice', item.status, money(item.amount || item.totalAmount) + '<br>Due ' + fmtDate(item.dueDate)); }) + '</section>';
  if (name === 'duration') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Duration</h2></div>' + renderTimeline() + '<div class="info-table"><div class="info-row"><span>Expected Delivery</span><span>' + fmtDate(expectedDelivery()) + '</span></div><div class="info-row"><span>Current Progress</span><span>' + projectProgress(projectStatus()) + '%</span></div></div></section>';
  if (name === 'requirements') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Requirements</h2><a class="btn" href="/website-request?from=client-dashboard">Submit New Requirement</a></div>' + recordList(dashboard.requirements, 'No generated requirements yet. Submit a project request or wait for admin approval.', function(item) { return record(item.requirementId || item.requirementName || 'Requirement', item.status || 'Submitted', '<strong>' + esc(item.requirementName || item.requirementTitle || '') + '</strong><br>' + esc(item.requirementDescription || item.description || '') + '<br>Category: ' + esc(item.category || '') + ' | Priority: ' + esc(item.priority || '') + '<br>Assigned: ' + esc(item.assignedDeveloper || item.assignedRole || 'Pending assignment') + '<br>Due: ' + fmtDate(item.dueDate) + '<br>Progress: ' + esc(item.progress || 0) + '%<div class="progress-track"><div class="progress-bar" style="width:' + Number(item.progress || 0) + '%"></div></div>'); }) + '</section>';
  if (name === 'proposals') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Proposals</h2></div>' + recordList(dashboard.proposals, 'No proposals yet.', function(item) { return record(item.proposalId || item.title || 'Proposal', item.status || 'Draft', money(item.amount) + '<br>' + esc(item.title || item.projectType || '') + '<br><pre style="white-space:pre-wrap;margin:10px 0 0;font:inherit;color:var(--muted);">' + esc(String(item.content || '').slice(0, 1200)) + '</pre>'); }) + '</section>';
  if (name === 'updates') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project Updates</h2></div>' + renderUpdates() + '<div style="height:16px"></div>' + recordList(dashboard.messages, 'No messages yet.', function(item) { return record(item.subject || 'Message', item.senderRole || 'Message', esc(item.body || '') + '<br>' + fmtDate(item.createdAt)); }) + '<div style="height:16px"></div>' + recordList(dashboard.documents, 'No documents yet.', function(item) { return record(item.originalName || 'Document', item.uploadedBy || 'File', '<a style="color:var(--blue);font-weight:850;" target="_blank" rel="noopener" href="' + esc(item.url) + '">Download file</a><br>' + fmtDate(item.createdAt)); }) + '</section>';
  if (name === 'messages' || name === 'support') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>' + (name === 'support' ? 'Support' : 'Messages') + '</h2></div><form id="messageForm" class="form-panel"><div class="grid"><div class="field"><label>Subject</label><input name="subject"></div><div class="field full"><label>Message</label><textarea name="body"></textarea></div></div><button class="btn" type="submit">Send Message</button></form><div style="height:16px"></div>' + recordList(dashboard.messages, 'No messages yet.', function(item) { return record(item.subject || 'Message', item.senderRole || 'Message', esc(item.body || '') + '<br>' + fmtDate(item.createdAt)); }) + '</section>';
  if (name === 'documents') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Files & Documents</h2></div><form id="docForm" enctype="multipart/form-data" class="form-panel"><div class="grid"><div class="field"><label>Document</label><input type="file" name="document" required></div><div class="field"><label>Request ID</label><input name="requestId"></div></div><button class="btn" type="submit">Upload Document</button></form><div style="height:16px"></div>' + recordList(dashboard.documents, 'No documents yet.', function(item) { return record(item.originalName || 'Document', item.uploadedBy || 'File', '<a style="color:var(--blue);font-weight:850;" target="_blank" rel="noopener" href="' + esc(item.url) + '">Download file</a><br>' + fmtDate(item.createdAt)); }) + '</section>';
  if (name === 'invoices') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Invoices</h2></div>' + recordList(dashboard.invoices, 'No invoices yet.', function(item) { return record(item.invoiceNumber || 'Invoice', item.status, money(item.amount || item.totalAmount) + '<br>Paid: ' + money(item.amountPaid || 0) + '<br>Balance: ' + money(item.balance || 0) + '<br>Due ' + fmtDate(item.dueDate)); }) + '</section>';
  if (name === 'payments') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Payments</h2></div>' + recordList(dashboard.payments, 'No payments recorded yet.', function(item) { return record(item.paymentId || 'Payment', item.status, money(item.amount) + '<br>' + esc(item.milestoneTitle || item.method || 'Payment record')); }) + '</section>';
  if (name === 'support') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Support</h2></div><form id="messageForm" class="form-panel"><div class="grid"><div class="field"><label>Subject</label><input name="subject" value="Support Request"></div><div class="field full"><label>Message</label><textarea name="body" placeholder="Describe what you need help with."></textarea></div></div><button class="btn" type="submit">Send Support Message</button></form></section>';
  if (name === 'profile') { var p = dashboard.profile || {}; mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Account Settings</h2></div><form id="profileForm" class="grid"><div class="field"><label>Full Name</label><input name="fullName" value="' + esc(p.fullName) + '"></div><div class="field"><label>Company</label><input name="companyName" value="' + esc(p.companyName) + '"></div><div class="field"><label>Phone</label><input name="phoneNumber" value="' + esc(p.phoneNumber) + '"></div><div class="field"><label>WhatsApp</label><input name="whatsappNumber" value="' + esc(p.whatsappNumber) + '"></div><div class="field"><label>Location</label><input name="businessLocation" value="' + esc(p.businessLocation) + '"></div><div class="field"><label>Best Time</label><input name="bestTimeToContact" value="' + esc(p.bestTimeToContact) + '"></div><div class="full"><button class="btn">Save Profile</button></div></form></section>'; document.getElementById('profileForm').addEventListener('submit', saveProfile); }
  if (name === 'messages' || name === 'support') document.getElementById('messageForm').addEventListener('submit', sendMessage);
  if (name === 'documents') document.getElementById('docForm').addEventListener('submit', uploadDocument);
}
async function saveProfile(event) { event.preventDefault(); await fetch('/api/project-portal/me', { method:'PATCH', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); await load(); renderPanel('profile'); }
async function sendMessage(event) { event.preventDefault(); await fetch('/api/project-portal/client/messages', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); await load(); renderPanel('messages'); }
async function uploadDocument(event) { event.preventDefault(); await fetch('/api/project-portal/client/documents', { method:'POST', headers:headers(), body:new FormData(event.target) }); await load(); renderPanel('documents'); }
async function respondQuotation(quotationId, status) {
  var response = await fetch('/api/project-portal/client/quotations/' + encodeURIComponent(quotationId) + '/respond', { method:'PATCH', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify({ status:status }) });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not update quotation.');
  await load();
  renderPanel(activePanel);
}
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
document.body.addEventListener('click', function(event) {
  var quote = event.target.closest('[data-quote-response]');
  if (!quote) return;
  event.preventDefault();
  respondQuotation(quote.dataset.quoteResponse, quote.dataset.status).catch(function(error) {
    errorBox.textContent = error.message;
    errorBox.style.display = 'block';
  });
});
document.getElementById('logoutBtn').addEventListener('click', function() { localStorage.removeItem('softOTechPortalToken'); window.location.href = '/client/login'; });
load().then(function() { renderPanel('dashboard'); }).catch(function(error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; });
</script>`,
  }));
});

router.get('/admin', (req, res) => {
  res.send(shell({
    nonce: res.locals.cspNonce,
    title: 'Admin Dashboard | Yenkasa Soft-O-Tech',
    body: `<main class="app-shell">${sidebar('dashboard', 'admin')}<section class="workspace">
      <header class="topbar"><div><h1>Soft-O-Tech Operations</h1><p>Clients, requests, projects, quotations, invoices, messages, and analytics.</p></div><div class="top-actions"><a class="btn ghost" href="/admin/project-requests">Request Admin</a><div class="avatar">AD</div></div></header>
      <section class="content">
        <section class="panel" id="tokenPanel"><div class="grid"><div class="field full"><label>Portal Token</label><input id="token" type="password" placeholder="Login as admin first or paste token"></div></div><p class="error" id="errorBox"></p><div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" id="loadBtn">Load Admin Dashboard</button><a class="btn ghost" href="/admin/login?returnTo=/admin">Admin Login</a></div></section>
        <section class="metrics" id="metrics"></section>
        <section id="mainPanel"></section>
      </section>
    </section></main>
<script>
var tokenInput = document.getElementById('token');
tokenInput.value = localStorage.getItem('softOTechPortalToken') || '';
tokenInput.addEventListener('input', function() { localStorage.setItem('softOTechPortalToken', tokenInput.value.trim()); });
var dashboard = null;
var pricingState = { categories: [], items: [] };
var requirementState = { category:'All Requirements', view:'table', selectedId:'', search:'', status:'', priority:'' };
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
function record(title, status, meta, action) { return '<article class="record"><div class="record-head"><div class="record-title">' + esc(title) + '</div><span class="status-pill ' + statusClass(status) + '">' + esc(status || 'Open') + '</span></div><div class="record-meta">' + meta + '</div>' + (action || '') + '</article>'; }
function option(value, label) { return '<option value="' + esc(value) + '">' + esc(label || value) + '</option>'; }
function clientOptions() { return '<option value="">Select client</option>' + (dashboard.clients || []).map(function(item) { return option(item.email, (item.fullName || item.email) + (item.companyName ? ' - ' + item.companyName : '')); }).join(''); }
function requestOptions() { return '<option value="">Select request</option>' + (dashboard.requests || []).map(function(item) { var req = item.requirements || {}; return option(item.requestId, item.requestId + ' - ' + ((item.contact && item.contact.fullName) || item.contact?.email || 'Client') + ' - ' + (req.projectType || req.websiteType || 'Project')); }).join(''); }
function projectOptions() { return '<option value="">Select project</option>' + (dashboard.projects || []).map(function(item) { return option(item.projectId, item.projectId + ' - ' + (item.title || 'Project')); }).join(''); }
function multiSelectField(label, name, optionsHtml) { return '<div class="field"><label>' + esc(label) + '</label><select name="' + esc(name) + '" multiple size="5">' + optionsHtml + '</select></div>'; }
function teamMemberSelect(label, name, roleHint, allowEmpty) {
  return selectField(label, name, (allowEmpty === false ? '' : '<option value="">Select team member</option>') + teamOptions(roleHint));
}
function teamMemberMulti(label, name, roleHint) {
  return multiSelectField(label, name, teamOptions(roleHint));
}
function teamOptions(roleHint) {
  var members = dashboard.teamMembers || [];
  if (roleHint) {
    var hinted = members.filter(function(member) { return String(member.role || member.teamRole || '').toLowerCase().includes(String(roleHint).toLowerCase()); });
    if (hinted.length) members = hinted;
  }
  return members.map(function(member) {
    return option(member.userId || member.id || member.clientId, (member.fullName || member.email || 'Team Member') + ' - ' + (member.role || member.teamRole || 'Team Member') + ' (' + (member.availability || 'Available') + ')');
  }).join('');
}
function assignmentsForProject(projectId) {
  return (dashboard.assignments || []).filter(function(item) { return item.projectId === projectId; });
}
function assignmentValues(projectId, role) {
  return assignmentsForProject(projectId).filter(function(item) { return item.role === role; }).map(function(item) { return item.userId; });
}
function renderTeamMemberCards() {
  var members = dashboard.teamMembers || [];
  if (!members.length) return '<div class="empty">No team members found. Create team users from Clients or Admin accounts first.</div>';
  return '<div class="assignment-card-grid">' + members.map(function(member) {
    var photo = member.profilePhoto || member.photo || '/images/default.png';
    return '<article class="team-member-card"><div class="team-member-head"><img class="team-member-photo" src="' + esc(photo) + '" alt="' + esc(member.fullName || '') + '"><div><strong>' + esc(member.fullName || member.email || 'Team Member') + '</strong><div class="row-meta">' + esc(member.role || member.teamRole || 'Team Member') + '</div></div></div><span class="availability ' + esc(member.availability || 'Available') + '">' + esc(member.availability || 'Available') + '</span><div class="progress-track"><div class="progress-bar" style="width:' + Number(member.workloadPercent || 0) + '%"></div></div><div class="row-meta">Workload ' + esc(member.workloadPercent || 0) + '% | Active projects ' + esc(member.activeProjects || 0) + '</div></article>';
  }).join('') + '</div>';
}
function renderAssignmentSummary(projectId) {
  var rows = assignmentsForProject(projectId);
  if (!rows.length) return '<div class="empty">No assignment saved yet. Save assignment before requirements are populated.</div>';
  var roles = ['Project Manager','Frontend Developer','Backend Engineer','Mobile Developer','QA Engineer','DevOps Engineer'];
  return '<div class="assignment-summary">' + roles.map(function(role) {
    var names = rows.filter(function(item) { return item.role === role; }).map(function(item) { return item.fullName || item.email || item.userId; });
    return '<article class="assignment-role-card"><strong>' + esc(role) + '</strong><div class="row-meta">' + esc(names.join(', ') || 'Not assigned') + '</div></article>';
  }).join('') + '</div>';
}
function selectedAssignmentProject() {
  var projects = (dashboard.projects || []).filter(function(project) { return !['Completed','Suspended'].includes(project.status); });
  var selectedId = window.assignmentProjectId || (projects[0] && projects[0].projectId) || '';
  return projects.find(function(project) { return project.projectId === selectedId; }) || projects[0] || null;
}
function renderAssignmentPage() {
  var projects = (dashboard.projects || []).filter(function(project) { return !['Completed','Suspended'].includes(project.status); });
  var selected = selectedAssignmentProject();
  if (!selected) {
    mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Assignment</h2></div><div class="empty">No active projects available for assignment.</div></section>';
    return;
  }
  window.assignmentProjectId = selected.projectId;
  var projectButtons = projects.map(function(project) {
    return '<button class="assignment-project ' + (project.projectId === selected.projectId ? 'active' : '') + '" type="button" data-assignment-project="' + esc(project.projectId) + '"><strong>' + esc(project.title || project.projectName || 'Project') + '</strong><div class="row-meta">' + esc(project.projectId) + ' | ' + esc(project.clientName || project.clientEmail || 'Client') + '</div><div class="row-meta">Status: ' + esc(project.status || 'Planning') + ' | Deadline: ' + fmtDate(project.deadline || project.endDate) + '</div></button>';
  }).join('');
  mainPanel.innerHTML = '<div class="assignment-layout"><aside class="panel"><div class="panel-head"><h2>Active Projects</h2></div><div class="assignment-projects">' + projectButtons + '</div></aside><div style="display:grid;gap:20px;"><section class="panel"><div class="panel-head"><div><h2>' + esc(selected.title || selected.projectName || 'Project Assignment') + '</h2><p class="row-meta">' + esc(selected.projectId) + ' | ' + esc(selected.clientName || selected.clientEmail || 'Client') + ' | ' + esc(selected.status || 'Planning') + '</p></div><span class="status-pill ' + statusClass(selected.assignmentStatus || '') + '">' + esc(selected.assignmentStatus || 'Pending Assignment') + '</span></div><div class="info-table"><div class="info-row"><span>Project Type</span><span>' + esc(selected.projectType || 'Project') + '</span></div><div class="info-row"><span>Deadline</span><span>' + fmtDate(selected.deadline || selected.endDate) + '</span></div><div class="info-row"><span>Requirement Population</span><span>Runs after assignment is saved.</span></div></div></section><section class="panel"><div class="panel-head"><h2>Team Members</h2></div>' + renderTeamMemberCards() + '</section><section class="panel"><div class="panel-head"><h2>Assign Team</h2><button class="btn" form="assignmentForm" type="submit">Save Assignment</button></div><form id="assignmentForm" class="form-panel"><div class="grid">' + selectField('Project Manager', 'projectManager', '<option value="">Select manager</option>' + teamOptions('Project Manager')) + multiSelectField('Frontend Team', 'frontendTeam', teamOptions('Frontend')) + multiSelectField('Backend Team', 'backendTeam', teamOptions('Backend')) + multiSelectField('Mobile Team', 'mobileTeam', teamOptions('Mobile')) + multiSelectField('QA Team', 'qaTeam', teamOptions('QA')) + multiSelectField('DevOps Team', 'devopsTeam', teamOptions('DevOps')) + '</div></form></section><section class="panel"><div class="panel-head"><h2>Current Assignment</h2></div>' + renderAssignmentSummary(selected.projectId) + '</section></div></div>';
  setAssignmentFormValues(selected.projectId);
  bindAssignmentPage();
}
function setSelectValues(select, values) {
  var wanted = new Set(values || []);
  Array.from(select.options || []).forEach(function(optionEl) {
    optionEl.selected = wanted.has(optionEl.value);
  });
}
function setAssignmentFormValues(projectId) {
  var form = document.getElementById('assignmentForm');
  if (!form) return;
  var map = {
    projectManager: assignmentValues(projectId, 'Project Manager').slice(0, 1),
    frontendTeam: assignmentValues(projectId, 'Frontend Developer'),
    backendTeam: assignmentValues(projectId, 'Backend Engineer'),
    mobileTeam: assignmentValues(projectId, 'Mobile Developer'),
    qaTeam: assignmentValues(projectId, 'QA Engineer'),
    devopsTeam: assignmentValues(projectId, 'DevOps Engineer')
  };
  Object.keys(map).forEach(function(name) {
    var select = form.elements[name];
    if (select) setSelectValues(select, map[name]);
  });
}
function bindAssignmentPage() {
  document.querySelectorAll('[data-assignment-project]').forEach(function(button) {
    button.addEventListener('click', function() {
      window.assignmentProjectId = button.dataset.assignmentProject;
      renderAssignmentPage();
    });
  });
  var form = document.getElementById('assignmentForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    var projectId = window.assignmentProjectId;
    var data = formToObject(form);
    try {
      await postJson('/api/project-portal/admin/projects/' + encodeURIComponent(projectId) + '/assignments', data);
      window.assignmentProjectId = projectId;
      renderAssignmentPage();
    } catch (error) {
      alert(error.message);
    }
  });
}
function activePricingItems() { return ((pricingState.items && pricingState.items.length ? pricingState.items : dashboard.pricingItems) || []).filter(function(item) { return item.isActive !== false && item.active !== false; }); }
function pricingSelectionFields() {
  var optionsHtml = activePricingItems().map(function(item) {
    return option(item.itemId || item.key || item.id, (item.serviceName || item.label || item.itemId) + ' - ' + money(item.unitPrice || item.sellingPrice || 0));
  }).join('');
  return '<div class="field full"><label>Services From Pricing Catalog</label><select name="serviceIds" multiple size="8">' + optionsHtml + '</select></div>' + field('Service Quantity', 'serviceQuantity', '1', 'number') + field('Manual Discount', 'discount', '0', 'number') + field('Manual Tax', 'tax', '0', 'number');
}
function withServiceSelections(data) {
  var ids = Array.isArray(data.serviceIds) ? data.serviceIds : (data.serviceIds ? [data.serviceIds] : []);
  var quantity = Math.max(1, Number(data.serviceQuantity || 1));
  delete data.serviceIds;
  delete data.serviceQuantity;
  if (ids.length) data.serviceSelections = ids.map(function(itemId) { return { itemId:itemId, quantity:quantity }; });
  return data;
}
function formToObject(form) {
  var data = {};
  new FormData(form).forEach(function(value, key) {
    if (data[key] !== undefined) {
      if (!Array.isArray(data[key])) data[key] = [data[key]];
      data[key].push(value);
    } else {
      data[key] = value;
    }
  });
  return data;
}
function csvList(value) {
  return String(value || '').split(',').map(function(item) { return item.trim(); }).filter(Boolean);
}
function formShell(id, title, fields, button) { return '<section class="panel"><div class="panel-head"><h2>' + esc(title) + '</h2></div><form id="' + id + '" class="form-panel"><div class="grid">' + fields + '</div><button class="btn" type="submit">' + esc(button) + '</button></form></section>'; }
function field(label, name, value, type) { return '<div class="field"><label>' + esc(label) + '</label><input name="' + esc(name) + '" type="' + esc(type || 'text') + '" value="' + esc(value || '') + '"></div>'; }
function area(label, name, placeholder) { return '<div class="field full"><label>' + esc(label) + '</label><textarea name="' + esc(name) + '" placeholder="' + esc(placeholder || '') + '"></textarea></div>'; }
function selectField(label, name, optionsHtml) { return '<div class="field"><label>' + esc(label) + '</label><select name="' + esc(name) + '">' + optionsHtml + '</select></div>'; }
async function postJson(path, data) {
  var response = await fetch(path, { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(data) });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Request failed.');
  await loadAdmin();
  return payload;
}
async function postMultipart(path, form) {
  var response = await fetch(path, { method:'POST', headers:headers(), body:new FormData(form) });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Upload failed.');
  await loadAdmin();
  return payload;
}
function bindForm(id, handler) {
  var form = document.getElementById(id);
  if (!form) return;
  if (form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    try { await handler(form); alert('Saved successfully.'); } catch (error) { alert(error.message); }
  });
}
function renderOverview() {
  var analytics = dashboard.analytics || {};
  var monthly = analytics.monthly || [];
  mainPanel.innerHTML = '<div class="dashboard-grid"><div style="display:grid;gap:20px;"><section class="panel"><div class="panel-head"><h2>Recent Project Requests</h2><button class="btn ghost" data-open="requests">View all</button></div>' + recordList((dashboard.requests || []).slice(0,5), 'No requests yet.', function(item) { var req = item.requirements || {}; return record(item.requestId || 'Request', item.status, esc((item.contact && item.contact.fullName) || 'Client') + ' - ' + esc(req.projectType || req.websiteType || 'Project')); }) + '</section><section class="panel"><div class="panel-head"><h2>Recent Clients</h2><button class="btn ghost" data-open="clients">View clients</button></div>' + recordList((dashboard.clients || []).slice(0,5), 'No clients yet.', function(item) { return record(item.fullName || item.email, item.userType || 'Client', esc(item.companyName || '') + '<br>' + esc(item.email || '')); }) + '</section></div><div style="display:grid;gap:20px;"><section class="panel"><h2 style="margin-bottom:18px;">Monthly Leads</h2>' + recordList(monthly, 'No analytics yet.', function(item) { return record(item.month, item.count + ' leads', 'Captured project inquiries'); }) + '</section><section class="panel"><h2 style="margin-bottom:18px;">Operations Summary</h2><div class="info-table"><div class="info-row"><span>Completed Projects</span><span>' + esc((dashboard.metrics || {}).completedProjects || 0) + '</span></div><div class="info-row"><span>Monthly Leads</span><span>' + esc((dashboard.metrics || {}).monthlyLeads || 0) + '</span></div><div class="info-row"><span>Revenue</span><span>' + money((dashboard.metrics || {}).revenueGenerated || 0) + '</span></div></div></section></div></div>';
}
function requirementCategories() { return ['All Requirements','Functional','Frontend / UI','Backend / API','Database','Infrastructure','Security','Integrations']; }
function requirementStatuses() { return ['Submitted','Approved','Assigned','In Development','Testing','Client Review','Completed','Rejected']; }
function requirementPriorityClass(priority) {
  priority = String(priority || '').toLowerCase();
  if (priority === 'critical') return 'orange';
  if (priority === 'high') return 'blue';
  if (priority === 'low') return 'green';
  return '';
}
function requirementOwners(item) {
  var team = Array.isArray(item.assignedTeamMembers) ? item.assignedTeamMembers : [];
  if (team.length) return team.map(function(member) { return (member.role ? member.role + ': ' : '') + (member.fullName || member.email || member.userId); }).join(' | ');
  return item.assignedDeveloper || item.assignedRole || 'Pending assignment';
}
function requirementStatusIndicator(status) {
  status = String(status || '').toLowerCase();
  var color = '#facc15';
  if (status.includes('complete')) color = '#16a34a';
  else if (status.includes('progress') || status.includes('assigned') || status.includes('testing') || status.includes('review')) color = '#2563eb';
  else if (status.includes('blocked') || status.includes('rejected')) color = '#dc2626';
  return '<span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:' + color + ';margin-right:7px;"></span>';
}
function requirementItems() {
  var items = (dashboard.requirements || []).slice();
  if (requirementState.category && requirementState.category !== 'All Requirements') items = items.filter(function(item) { return item.category === requirementState.category; });
  if (requirementState.status) items = items.filter(function(item) { return item.status === requirementState.status; });
  if (requirementState.priority) items = items.filter(function(item) { return item.priority === requirementState.priority; });
  var needle = String(requirementState.search || '').trim().toLowerCase();
  if (needle) items = items.filter(function(item) {
    return [item.requirementId, item.requirementName, item.requirementTitle, item.requirementDescription, item.category, item.assignedDeveloper, item.assignedRole].join(' ').toLowerCase().includes(needle);
  });
  return items.sort(function(a, b) { return String(a.requirementId || '').localeCompare(String(b.requirementId || '')); });
}
function selectedRequirement() {
  var items = requirementItems();
  var selected = (dashboard.requirements || []).find(function(item) { return (item.requirementId || item.id) === requirementState.selectedId; });
  return selected || items[0] || null;
}
function requirementProject() {
  var selected = selectedRequirement();
  return (dashboard.projects || []).find(function(project) { return project.projectId === (selected && selected.projectId); }) || (dashboard.projects || [])[0] || {};
}
function requirementStats(items) {
  var all = dashboard.requirements || [];
  return {
    total: all.length,
    completed: all.filter(function(item) { return item.status === 'Completed' || item.completed; }).length,
    inProgress: all.filter(function(item) { return ['Assigned','In Development','Testing','Client Review'].includes(item.status); }).length,
    pendingReview: all.filter(function(item) { return ['Submitted','Approved'].includes(item.status); }).length,
    changeRequests: all.reduce(function(sum, item) { return sum + ((item.changeRequests || []).filter(function(cr) { return cr.approvalStatus === 'Pending'; }).length); }, 0),
    estimatedHours: all.reduce(function(sum, item) { return sum + Number(item.estimatedHours || 0); }, 0),
    actualHours: all.reduce(function(sum, item) { return sum + Number(item.actualHours || 0); }, 0),
    budget: all.reduce(function(sum, item) { return sum + Number(item.estimatedCost || 0); }, 0)
  };
}
function projectHeader(project, stats) {
  var progress = stats.total ? Math.round((stats.completed / stats.total) * 100) : Number(project.progress || project.progressPercentage || 0);
  return '<section class="panel"><div class="record-head"><div><div class="record-title" style="font-size:1.15rem;">' + esc(project.title || project.projectName || 'Project Requirements') + ' <span class="status-pill ' + statusClass(project.status) + '">' + esc(project.status || 'Planning') + '</span></div><div class="record-meta">Client: ' + esc(project.clientName || project.clientEmail || 'Not assigned') + ' &nbsp; | &nbsp; Project ID: ' + esc(project.projectId || 'Not created') + ' &nbsp; | &nbsp; Type: ' + esc(project.projectType || 'Project') + '</div></div><div class="avatar">' + esc(String(progress)) + '%</div></div><div class="info-table" style="margin-top:16px;"><div class="info-row"><span>Start Date</span><span>' + fmtDate(project.startDate || project.createdAt) + '</span></div><div class="info-row"><span>Deadline</span><span>' + fmtDate(project.deadline || project.endDate) + '</span></div><div class="info-row"><span>Overall Progress</span><span><div class="progress-track"><div class="progress-bar" style="width:' + progress + '%"></div></div></span></div></div></section>';
}
function requirementMetricCards(stats) {
  var cards = [['RQ','Total Requirements',stats.total,'All generated and manual requirements','#7c3aed'],['OK','Completed',stats.completed,stats.total ? Math.round((stats.completed / stats.total) * 100) + '% of total' : '0% of total','#14b85a'],['IP','In Progress',stats.inProgress,'Assigned, development, testing, review','#1265ff'],['RV','Pending Review',stats.pendingReview,'Submitted or approved requirements','#f97316'],['CR','Change Requests',stats.changeRequests,'Pending approval','#ef4444']];
  return '<section class="metrics" style="grid-template-columns:repeat(5,minmax(0,1fr));">' + cards.map(function(card) { return '<article class="metric-card" style="min-height:116px;"><div class="metric-icon" style="background:' + card[4] + '">' + card[0] + '</div><div><small>' + esc(card[1]) + '</small><strong>' + esc(card[2]) + '</strong><span class="row-meta">' + esc(card[3]) + '</span></div></article>'; }).join('') + '</section>';
}
function requirementTabs() {
  return '<div style="display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:10px;">' + requirementCategories().map(function(category) {
    var active = category === requirementState.category;
    return '<button class="btn ' + (active ? '' : 'ghost') + '" type="button" data-req-category="' + esc(category) + '">' + esc(category) + '</button>';
  }).join('') + '</div>';
}
function requirementFilters() {
  return '<div class="grid" style="align-items:end;margin:16px 0;">' + field('Search Requirements', 'requirementSearch', requirementState.search) + '<div class="field"><label>Status</label><select id="requirementStatusFilter"><option value="">All Status</option>' + requirementStatuses().map(function(status) { return '<option value="' + esc(status) + '" ' + (status === requirementState.status ? 'selected' : '') + '>' + esc(status) + '</option>'; }).join('') + '</select></div><div class="field"><label>Priority</label><select id="requirementPriorityFilter"><option value="">All Priorities</option>' + ['Critical','High','Medium','Low'].map(function(priority) { return '<option value="' + esc(priority) + '" ' + (priority === requirementState.priority ? 'selected' : '') + '>' + esc(priority) + '</option>'; }).join('') + '</select></div><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn ghost" type="button" data-req-view="table">Table View</button><button class="btn ghost" type="button" data-req-view="kanban">Kanban Board</button></div></div>';
}
function requirementTable(items) {
  if (!items.length) return '<div class="empty">No requirements match the current filters.</div>';
  return '<div style="overflow:auto;"><table style="width:100%;border-collapse:collapse;min-width:1080px;"><thead><tr style="text-align:left;color:var(--muted);font-size:.86rem;"><th style="padding:12px;border-bottom:1px solid var(--line);">ID</th><th style="padding:12px;border-bottom:1px solid var(--line);">Requirement</th><th style="padding:12px;border-bottom:1px solid var(--line);">Category</th><th style="padding:12px;border-bottom:1px solid var(--line);">Priority</th><th style="padding:12px;border-bottom:1px solid var(--line);">Assigned Team</th><th style="padding:12px;border-bottom:1px solid var(--line);">Status</th><th style="padding:12px;border-bottom:1px solid var(--line);">Due Date</th><th style="padding:12px;border-bottom:1px solid var(--line);">Progress</th></tr></thead><tbody>' + items.map(function(item) {
    var id = item.requirementId || item.id || '';
    return '<tr data-req-select="' + esc(id) + '" style="cursor:pointer;"><td style="padding:13px;border-bottom:1px solid var(--line);font-weight:850;">' + esc(id) + '</td><td style="padding:13px;border-bottom:1px solid var(--line);"><strong>' + esc(item.requirementName || item.requirementTitle || 'Requirement') + '</strong><div class="row-meta">' + esc(item.requirementDescription || item.description || '') + '</div></td><td style="padding:13px;border-bottom:1px solid var(--line);"><span class="status-pill green">' + esc(item.category || 'Functional') + '</span></td><td style="padding:13px;border-bottom:1px solid var(--line);"><span class="status-pill ' + requirementPriorityClass(item.priority) + '">' + esc(item.priority || 'Medium') + '</span></td><td style="padding:13px;border-bottom:1px solid var(--line);max-width:260px;">' + esc(requirementOwners(item)) + '</td><td style="padding:13px;border-bottom:1px solid var(--line);"><span class="status-pill ' + statusClass(item.status) + '">' + requirementStatusIndicator(item.status) + esc(item.status || 'Submitted') + '</span></td><td style="padding:13px;border-bottom:1px solid var(--line);">' + fmtDate(item.dueDate) + '</td><td style="padding:13px;border-bottom:1px solid var(--line);min-width:140px;">' + esc(item.progress || 0) + '%<div class="progress-track"><div class="progress-bar" style="width:' + Number(item.progress || 0) + '%"></div></div></td></tr>';
  }).join('') + '</tbody></table></div>';
}
function requirementKanban(items) {
  var columns = ['Submitted','Assigned','In Development','Testing','Client Review','Completed'];
  return '<div style="display:grid;grid-template-columns:repeat(6,minmax(190px,1fr));gap:12px;overflow:auto;">' + columns.map(function(status) {
    var rows = items.filter(function(item) { return item.status === status || (status === 'Submitted' && !item.status); });
    return '<section class="record" data-req-drop-status="' + esc(status) + '" style="min-height:360px;background:#f8fafc;"><div class="record-head"><div class="record-title">' + esc(status) + '</div><span class="status-pill">' + rows.length + '</span></div>' + (rows.length ? rows.map(function(item) { var id = item.requirementId || item.id || ''; return '<article class="record" draggable="true" data-req-card="' + esc(id) + '" data-req-select="' + esc(id) + '" style="box-shadow:none;"><strong>' + requirementStatusIndicator(item.status) + esc(item.requirementName || item.requirementTitle || id) + '</strong><span class="status-pill ' + requirementPriorityClass(item.priority) + '">' + esc(item.priority || 'Medium') + '</span><div class="row-meta">' + esc(item.category || '') + ' | ' + esc(requirementOwners(item)) + '</div><div class="row-meta">Due ' + fmtDate(item.dueDate) + ' | Progress ' + esc(item.progress || 0) + '%</div></article>'; }).join('') : '<div class="empty">No items.</div>') + '</section>';
  }).join('') + '</div>';
}
function requirementDetail(item) {
  if (!item) return '<aside class="panel"><div class="empty">Select a requirement to view details.</div></aside>';
  var id = item.requirementId || item.id || '';
  return '<aside class="panel" style="position:sticky;top:104px;"><div class="panel-head"><div><h2>' + esc(item.requirementName || item.requirementTitle || id) + '</h2><p class="row-meta">' + esc(id) + ' | ' + esc(item.sourceType || 'Manual') + '</p></div><span class="status-pill ' + requirementPriorityClass(item.priority) + '">' + esc(item.priority || 'Medium') + '</span></div><p class="record-meta">' + esc(item.requirementDescription || item.description || '') + '</p><div class="info-table"><div class="info-row"><span>Category</span><span>' + esc(item.category || '') + '</span></div><div class="info-row"><span>Assigned To</span><span>' + esc(item.assignedDeveloper || item.assignedRole || 'Unassigned') + '</span></div><div class="info-row"><span>Assigned Team</span><span>' + esc(requirementOwners(item)) + '</span></div><div class="info-row"><span>Tasks</span><span>' + esc((item.tasks || []).map(function(task) { return (task.taskName || 'Task') + ' - ' + (task.assignedTo || task.role || 'Unassigned'); }).join(' | ') || 'No tasks generated') + '</span></div><div class="info-row"><span>Reporter</span><span>' + esc(item.reporter || item.reporterEmail || item.createdBy || '') + '</span></div><div class="info-row"><span>Estimated Hours</span><span>' + esc(item.estimatedHours || 0) + '</span></div><div class="info-row"><span>Actual Hours</span><span>' + esc(item.actualHours || 0) + '</span></div><div class="info-row"><span>Remaining Hours</span><span>' + esc(item.remainingHours || 0) + '</span></div><div class="info-row"><span>Due Date</span><span>' + fmtDate(item.dueDate) + '</span></div><div class="info-row"><span>Estimated Cost</span><span>' + money(item.estimatedCost || 0) + '</span></div><div class="info-row"><span>Actual Cost</span><span>' + money(item.actualCost || 0) + '</span></div><div class="info-row"><span>Dependencies</span><span>' + esc((item.dependencies || []).join(', ') || 'None') + '</span></div><div class="info-row"><span>Original Request</span><span>' + esc(item.originalRequestText || 'Not captured') + '</span></div></div><div style="margin:16px 0;"><span class="row-meta">Progress</span><div class="progress-track"><div class="progress-bar" style="width:' + Number(item.progress || 0) + '%"></div></div></div><form id="requirementQuickUpdateForm" class="form-panel"><input type="hidden" name="requirementId" value="' + esc(id) + '"><div class="grid">' + selectField('Status', 'status', requirementStatuses().map(function(s){return option(s,s);}).join('')) + field('Progress %', 'progress', item.progress || 0, 'number') + field('Actual Hours', 'actualHours', item.actualHours || 0, 'number') + field('Assigned Developer', 'assignedDeveloper', item.assignedDeveloper || '') + field('Assigned Role', 'assignedRole', item.assignedRole || '') + field('Due Date', 'dueDate', '', 'date') + '</div><button class="btn" type="submit">Save Requirement</button></form><div style="height:14px"></div><form id="requirementCommentForm" class="form-panel"><input type="hidden" name="requirementId" value="' + esc(id) + '">' + area('Comment', 'body', 'Add admin, developer, or client note') + '<button class="btn ghost" type="submit">Add Comment</button></form><div style="height:14px"></div><form id="requirementAttachmentForm" class="form-panel" enctype="multipart/form-data"><input type="hidden" name="requirementId" value="' + esc(id) + '"><div class="field"><label>Attachment</label><input name="attachment" type="file"></div><button class="btn ghost" type="submit">Upload Attachment</button></form><div style="height:14px"></div><form id="requirementChangeForm" class="form-panel"><input type="hidden" name="requirementId" value="' + esc(id) + '">' + area('Change Request', 'description', 'Describe requested scope change') + field('Cost Impact', 'costImpact', '', 'number') + field('Additional Days', 'additionalDaysRequired', '', 'number') + '<button class="btn ghost" type="submit">Create Change Request</button></form><div style="height:16px"></div><h2>Attachments</h2>' + recordList(item.attachments || [], 'No attachments yet.', function(file) { return record(file.originalName || 'Attachment', file.uploadedByRole || 'File', '<a style="color:var(--blue);font-weight:850;" href="' + esc(file.url) + '" target="_blank" rel="noopener">Open file</a><br>' + esc(file.mimeType || '')); }) + '<div style="height:16px"></div><h2>Comments</h2>' + recordList(item.comments || [], 'No comments yet.', function(comment) { return record(comment.authorName || comment.authorEmail || 'Comment', comment.role || 'Comment', esc(comment.body || '') + '<br>' + fmtDate(comment.createdAt)); }) + '<div style="height:16px"></div><h2>Change Requests</h2>' + recordList(item.changeRequests || [], 'No change requests yet.', function(cr) { return record(cr.changeRequestId || 'Change Request', cr.approvalStatus || 'Pending', esc(cr.description || '') + '<br>Cost Impact: ' + money(cr.costImpact || 0) + '<br>Additional Days: ' + esc(cr.additionalDaysRequired || 0)); }) + '</aside>';
}
function renderRequirementsModule() {
  var items = requirementItems();
  var selected = selectedRequirement();
  var project = requirementProject();
  var stats = requirementStats(items);
  mainPanel.innerHTML = '<div style="display:grid;gap:16px;">' + projectHeader(project, stats) + requirementMetricCards(stats) + '<div style="display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:20px;align-items:start;"><section class="panel"><div class="panel-head"><h2>Requirements Management</h2><button class="btn" data-open="requirements-create" type="button">Add Requirement</button></div>' + requirementTabs() + requirementFilters() + (requirementState.view === 'kanban' ? requirementKanban(items) : requirementTable(items)) + '</section>' + requirementDetail(selected) + '</div></div>';
  bindRequirementForms();
}
function compactList(items) {
  var values = (items || []).filter(Boolean);
  if (!values.length) return '<span class="row-meta">Not provided</span>';
  return '<div class="request-chip-list">' + values.map(function(value) { return '<span class="request-chip">' + esc(value) + '</span>'; }).join('') + '</div>';
}
function requestInfoRows(rows) {
  return '<div class="request-detail-list">' + rows.map(function(row) {
    return '<div class="request-detail"><span>' + esc(row[0]) + '</span><span>' + esc(row[1] || 'Not provided') + '</span></div>';
  }).join('') + '</div>';
}
function requestBlock(title, body, tone) {
  return '<section class="request-block ' + esc(tone || '') + '"><h3>' + esc(title) + '</h3>' + body + '</section>';
}
function requestCardBody(item) {
  var req = item.requirements || {};
  var contact = item.contact || {};
  var overview = item.overview || {};
  var objectives = item.objectives || {};
  var review = item.review || {};
  var infra = item.infrastructure || {};
  var timeline = item.timeline || {};
  var project = item.project || {};
  var business = item.business || {};
  var costRange = review.estimatedCostRange || {};
  var title = overview.projectName || req.projectType || req.websiteType || 'Project';
  var currency = project.budgetCurrency || (costRange.currency || 'GHS');
  return '<div class="request-review">' +
    '<div class="request-hero"><strong>' + esc(title) + '</strong><div class="row-meta">' + esc(contact.fullName || 'Client') + ' - ' + esc(contact.email || '') + '</div><div class="request-tags"><span class="request-tag">' + esc(item.requestCategory || 'Project') + '</span><span class="request-tag">' + esc(req.projectType || req.websiteType || 'Type pending') + '</span><span class="request-tag">' + esc(project.budgetCurrency || costRange.currency || 'GHS') + '</span></div></div>' +
    requestBlock('Client', requestInfoRows([
      ['Company', contact.companyName],
      ['Phone', contact.phoneNumber],
      ['WhatsApp', contact.whatsappNumber],
      ['Location', [contact.city, contact.country].filter(Boolean).join(', ') || contact.businessLocation],
      ['Preferred contact', contact.preferredContactMethod],
    ]), 'client') +
    requestBlock('Project Description', '<p>' + esc(overview.projectDescription || business.description || 'No description provided.') + '</p>', 'description') +
    requestBlock('Objectives', requestInfoRows([
      ['Problem', objectives.problemToSolve],
      ['Goals', objectives.businessGoals],
      ['Target users', objectives.targetUsers],
      ['Expected users', objectives.expectedUsers],
      ['Monthly traffic', objectives.expectedMonthlyTraffic],
    ]), 'objectives') +
    '<div class="request-grid">' +
      requestBlock('Platforms', compactList(req.platformsRequired), 'platforms') +
      requestBlock('Features', compactList(req.featuresRequired), 'features') +
      requestBlock('Integrations', compactList(item.integrations), 'integrations') +
      requestBlock('Infrastructure', requestInfoRows([
        ['Cloud / hosting options', (infra.hostingOptions || []).join(', ')],
        ['Needs hosting', infra.needsHosting],
        ['Needs domain registration', infra.needsDomainRegistration],
        ['Needs email setup', infra.needsEmailSetup],
        ['Needs cloud deployment', infra.needsCloudDeployment],
      ]), 'infrastructure') +
    '</div>' +
    requestBlock('Timeline & Budget', requestInfoRows([
      ['Start date', fmtDate(timeline.desiredStartDate)],
      ['Completion date', fmtDate(timeline.desiredCompletionDate || project.desiredCompletionDate)],
      ['Priority', timeline.priority],
      ['Budget range', project.budgetRange],
      ['Budget currency', currency],
      ['Min / Max', currency + ' ' + (project.minimumBudget || 0) + ' - ' + (project.maximumBudget || 0)],
    ]), 'budget') +
    requestBlock('Admin Review', requestInfoRows([
      ['Complexity', (review.complexity || 'Pending') + ' ' + (review.complexityScore || 0) + '/100'],
      ['Estimated duration', review.estimatedDevelopmentDuration],
      ['Recommended team', review.recommendedTeamSize],
      ['Estimated cost', (costRange.currency || currency) + ' ' + Number(costRange.minimum || 0).toLocaleString() + ' - ' + Number(costRange.maximum || 0).toLocaleString()],
      ['Suggested stack', (review.suggestedTechnologyStack || []).join(', ')],
    ]), 'review') +
    (req.customFeatures ? requestBlock('Custom Features', '<p>' + esc(req.customFeatures) + '</p>', 'features') : '') +
  '</div>';
}
function renderPanel(name) {
  document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.panel === name); });
  if (!dashboard) return;
  if (name === 'dashboard') return renderOverview();
  if (name === 'clients') mainPanel.innerHTML = formShell('clientForm', 'Create or Update Client Login', field('Full Name', 'fullName') + field('Company', 'companyName') + field('Email', 'email', '', 'email') + field('Temporary Password', 'password', '', 'password') + field('Phone', 'phoneNumber') + field('Assigned Project Manager', 'assignedProjectManager') + selectField('Status', 'status', ['Active','Suspended','Closed'].map(function(s){return option(s,s);}).join('')) + area('Notes', 'notes', 'Client notes'), 'Save Client') + '<section class="panel"><div class="panel-head"><h2>Clients</h2><button class="btn ghost" data-open="clients">Refresh</button></div>' + recordList(dashboard.clients, 'No clients yet.', function(item) { return record(item.fullName || item.email, item.status || item.userType || 'Client', esc(item.companyName || '') + '<br>' + esc(item.email || '') + ' - ' + esc(item.phoneNumber || '') + '<br>Login: ' + (item.hasLogin ? 'Enabled' : 'No password set'), '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn ghost" type="button" data-client-status="' + esc(item.id || item.clientId || '') + '" data-status="Active">Activate</button><button class="btn warn" type="button" data-client-status="' + esc(item.id || item.clientId || '') + '" data-status="Suspended">Suspend</button><button class="btn danger" type="button" data-client-status="' + esc(item.id || item.clientId || '') + '" data-status="Closed">Close</button></div>'); }) + '</section>';
  if (name === 'leads') mainPanel.innerHTML = formShell('leadForm', 'Create Lead', field('Full Name', 'fullName') + field('Company', 'companyName') + field('Email', 'email', '', 'email') + field('Phone', 'phone') + field('Requested Service', 'requestedService') + field('Estimated Budget', 'estimatedBudget') + field('Expected Timeline', 'expectedTimeline') + field('Lead Source', 'leadSource', 'Website') + selectField('Status', 'status', ['New','Contacted','Negotiation','Quotation Sent','Won','Lost'].map(function(s){return option(s,s);}).join('')) + area('Notes', 'notes', 'Lead notes'), 'Create Lead') + '<section class="panel"><div class="panel-head"><h2>Leads</h2><button class="btn ghost" data-open="leads">Refresh</button></div>' + recordList(dashboard.leads, 'No leads yet.', function(item) { return record(item.leadId || item.email || 'Lead', item.status, esc(item.fullName || '') + '<br>' + esc(item.companyName || '') + '<br>' + esc(item.email || '') + ' - ' + esc(item.requestedService || ''), '<div style="margin-top:12px;"><button class="btn ghost" type="button" data-lead-convert="' + esc(item.leadId || item.id || '') + '">Convert To Client</button></div>'); }) + '</section>';
  if (name === 'requests') mainPanel.innerHTML = formShell('approveRequestForm', 'Approve Request Into Project', selectField('Request', 'requestId', requestOptions()) + selectField('Client', 'clientEmail', clientOptions()) + field('Project Title', 'title') + teamMemberSelect('Project Manager', 'projectManagerId', 'Project Manager') + teamMemberMulti('Initial Developers', 'assignedDeveloperIds', '') + field('Deadline', 'deadline', '', 'date') + field('Amount', 'amount', '', 'number') + area('Description', 'description', 'Project scope and approval notes'), 'Approve & Create Project') + '<section class="panel"><div class="panel-head"><h2>Project Requests</h2><a class="btn ghost" href="/admin/project-requests">Detailed Request Admin</a></div>' + recordList(dashboard.requests, 'No project requests yet.', function(item) { return record(item.requestId || 'Request', item.status, requestCardBody(item)); }) + '</section>';
  if (name === 'projects') mainPanel.innerHTML = formShell('createProjectForm', 'Create Project', selectField('Client', 'clientEmail', clientOptions()) + field('Client Name', 'clientName') + selectField('From Request', 'requestId', requestOptions()) + field('Project Title', 'title') + teamMemberSelect('Project Manager', 'projectManagerId', 'Project Manager') + teamMemberMulti('Initial Developers', 'assignedDeveloperIds', '') + field('Deadline', 'deadline', '', 'date') + field('Estimated Amount', 'amount', '', 'number') + field('Progress %', 'progress', '0', 'number') + selectField('Status', 'status', ['Planning','In Progress','Client Review','Testing','Deployment','Completed','Suspended'].map(function(s){return option(s,s);}).join('')) + area('Description', 'description', 'Project details'), 'Create Project') + formShell('projectUpdateForm', 'Update Project Status', selectField('Project', 'projectId', projectOptions()) + selectField('Status', 'status', ['Planning','In Progress','Client Review','Testing','Deployment','Completed','Suspended'].map(function(s){return option(s,s);}).join('')) + field('Progress %', 'progress', '', 'number') + field('Deadline', 'deadline', '', 'date') + area('Update Notes / Description', 'description', 'Latest delivery update'), 'Update Project') + '<section class="panel"><div class="panel-head"><h2>Projects</h2></div>' + recordList(dashboard.projects, 'No projects yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Manager: ' + esc(item.projectManager || 'Not assigned') + '<br>Progress: ' + esc(item.progress || item.progressPercentage || 0) + '%<br>Deadline: ' + fmtDate(item.deadline) + '<br>Team: ' + esc((item.assignedDevelopers || []).join(', ') || 'Not assigned')); }) + '</section>';
  if (name === 'assignments') return renderAssignmentPage();
  if (name === 'requirements') return renderRequirementsModule();
  if (name === 'requirements-create') mainPanel.innerHTML = formShell('requirementForm', 'Add Requirement', selectField('Project', 'projectId', projectOptions()) + field('Requirement Name', 'requirementName') + selectField('Category', 'category', ['Functional','Frontend / UI','Backend / API','Database','Infrastructure','Security','Integrations'].map(function(s){return option(s,s);}).join('')) + selectField('Priority', 'priority', ['Critical','High','Medium','Low'].map(function(s){return option(s,s);}).join('')) + selectField('Status', 'status', ['Submitted','Approved','Assigned','In Development','Testing','Client Review','Completed','Rejected'].map(function(s){return option(s,s);}).join('')) + field('Assigned Developer', 'assignedDeveloper') + field('Assigned Role', 'assignedRole') + field('Estimated Hours', 'estimatedHours', '', 'number') + field('Estimated Cost', 'estimatedCost', '', 'number') + field('Due Date', 'dueDate', '', 'date') + area('Requirement Description', 'requirementDescription', 'Requirement details') + area('Original Request Text', 'originalRequestText', 'Source text from client request or admin note'), 'Add Requirement') + '<section class="panel"><button class="btn ghost" data-open="requirements" type="button">Back to Requirements</button></section>';
  if (name === 'team') mainPanel.innerHTML = formShell('teamUpdateForm', 'Update Team Assignment', selectField('Project', 'projectId', projectOptions()) + teamMemberSelect('Project Manager', 'projectManagerId', 'Project Manager') + teamMemberMulti('Assigned Developers', 'assignedDeveloperIds', ''), 'Save Team Assignment') + '<section class="panel"><div class="panel-head"><h2>Team Assignments</h2></div>' + recordList(dashboard.projects, 'No team assignments yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Manager: ' + esc(item.projectManager || 'Not assigned') + '<br>Developers: ' + esc((item.assignedDevelopers || []).join(', ') || 'Not assigned') + '<br>Team: ' + esc((item.assignedTeam || []).join(', ') || 'Not assigned')); }) + '</section>';
  if (name === 'payments') mainPanel.innerHTML = formShell('paymentForm', 'Record Payment', selectField('Client', 'clientEmail', clientOptions()) + selectField('Project', 'projectId', projectOptions()) + field('Invoice Number', 'invoiceNumber') + field('Milestone Title', 'milestoneTitle') + field('Amount', 'amount', '', 'number') + selectField('Method', 'method', ['Paystack','MTN MoMo','Telecel Cash','AirtelTigo Money','Bank Transfer'].map(function(s){return option(s,s);}).join('')) + field('Transaction Reference', 'transactionReference') + field('Receipt URL', 'receiptUrl') + selectField('Status', 'status', ['Pending','Successful','Failed','Refunded'].map(function(s){return option(s,s);}).join('')), 'Record Payment') + '<section class="panel"><div class="panel-head"><h2>Payments</h2></div>' + recordList(dashboard.payments, 'No payments recorded yet.', function(item) { return record(item.paymentId || 'Payment', item.status, money(item.amount) + '<br>' + esc(item.clientEmail || '') + '<br>' + esc(item.milestoneTitle || item.invoiceNumber || 'Payment')); }) + '</section>';
  if (name === 'pricing') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Pricing Catalog</h2><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn ghost" id="pricingExportBtn" type="button">Export CSV</button><button class="btn ghost" id="pricingReportsBtn" type="button">Reports</button><button class="btn" id="savePricingBtn" type="button">Save Prices</button></div></div><p class="row-meta" style="margin-bottom:14px;">Edit service prices, billing, triggers, and category mapping used by project estimates and invoice generation.</p><p class="error" id="pricingError"></p><div class="form-panel" style="margin-bottom:18px;"><div class="grid">' + field('Search Services', 'pricingSearch') + '<div class="field"><label>Filter Category</label><select id="pricingCategoryFilter"><option value="">All categories</option></select></div></div><button class="btn ghost" id="pricingFilterBtn" type="button">Apply Filter</button></div><form id="newPricingCategoryForm" class="form-panel" style="margin-bottom:18px;"><div class="grid">' + field('Category Name', 'categoryName') + area('Description', 'description', 'Category description') + '</div><button class="btn secondary" type="submit">Create Category</button></form><form id="newPricingForm" class="form-panel" style="margin-bottom:18px;"><div class="grid">' + field('Service Name', 'serviceName') + field('Unit Price', 'unitPrice', '', 'number') + selectField('Billing Type', 'billingType', billingOptions('One-Time')) + '<div class="field"><label>Category</label><select name="categoryId" id="newPricingCategory"><option value="">Loading categories</option></select></div>' + area('Description', 'description', 'What this price covers') + '<div class="field full"><label>Triggers, comma-separated</label><input name="triggers" placeholder="Website Development, Business Website"></div></div><button class="btn secondary" type="submit">Add Pricing Item</button></form><form id="pricingImportForm" class="form-panel" enctype="multipart/form-data" style="margin-bottom:18px;"><div class="grid"><div class="field full"><label>Import CSV</label><input type="file" name="csv" accept=".csv,text/csv"></div></div><button class="btn ghost" type="submit">Import Pricing CSV</button></form><div id="pricingReport" class="records" style="margin-bottom:18px;"></div><div id="pricingEditor" class="records"><div class="empty">Loading pricing catalog...</div></div></section>';
  if (name === 'quotations') mainPanel.innerHTML = formShell('quotationForm', 'Create Quotation', selectField('Client', 'clientEmail', clientOptions()) + selectField('Request', 'requestId', requestOptions()) + selectField('Project', 'projectId', projectOptions()) + field('Title', 'title', 'Project Quotation') + pricingSelectionFields() + field('Fallback Amount', 'amount', '', 'number') + area('Notes', 'notes', 'Quotation notes'), 'Send Quotation') + '<section class="panel"><div class="panel-head"><h2>Quotations</h2></div>' + recordList(dashboard.quotations, 'No quotations yet.', function(item) { return record(item.quotationId || item.title, item.status, money(item.amount) + '<br>' + esc(item.clientEmail || '') + '<br>' + esc((item.lineItems || []).map(function(line) { return line.serviceName; }).filter(Boolean).join(', '))); }) + '</section>';
  if (name === 'proposals') mainPanel.innerHTML = formShell('proposalForm', 'Generate Proposal', selectField('Client', 'clientEmail', clientOptions()) + selectField('Request', 'requestId', requestOptions()) + selectField('Project', 'projectId', projectOptions()) + field('Title', 'title', 'Project Proposal') + field('Project Type', 'projectType') + field('Timeline', 'timeline') + field('Estimated Amount', 'amount', '', 'number') + area('Requirements', 'requirements', 'Scope, deliverables, assumptions, and client goals'), 'Generate Proposal') + '<section class="panel"><div class="panel-head"><h2>Proposals</h2></div>' + recordList(dashboard.proposals, 'No proposals yet.', function(item) { return record(item.proposalId || item.title, item.status || 'Draft', money(item.amount) + '<br>' + esc(item.clientEmail || '') + '<br>' + esc(item.title || item.projectType || '') + '<br><pre style="white-space:pre-wrap;margin:10px 0 0;font:inherit;color:var(--muted);">' + esc(String(item.content || '').slice(0, 900)) + '</pre>'); }) + '</section>';
  if (name === 'invoices') mainPanel.innerHTML = formShell('invoiceForm', 'Create Invoice', selectField('Client', 'clientEmail', clientOptions()) + selectField('Project', 'projectId', projectOptions()) + pricingSelectionFields() + field('Fallback Amount', 'amount', '', 'number') + field('Due Date', 'dueDate', '', 'date') + selectField('Status', 'status', ['Unpaid','Paid','Overdue','Partially Paid'].map(function(s){return option(s,s);}).join('')) + area('Notes', 'notes', 'Invoice notes'), 'Create Invoice') + '<section class="panel"><div class="panel-head"><h2>Invoices</h2></div>' + recordList(dashboard.invoices, 'No invoices yet.', function(item) { return record(item.invoiceNumber || 'Invoice', item.status, money(item.amount) + '<br>Due ' + fmtDate(item.dueDate) + '<br>' + esc((item.lineItems || []).map(function(line) { return line.serviceName; }).filter(Boolean).join(', '))); }) + '</section>';
  if (name === 'documents') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Upload File or Deliverable</h2></div><form id="adminDocForm" enctype="multipart/form-data" class="form-panel"><div class="grid">' + selectField('Client', 'clientEmail', clientOptions()) + selectField('Project', 'projectId', projectOptions()) + selectField('Request', 'requestId', requestOptions()) + '<div class="field full"><label>Document</label><input type="file" name="document" required></div></div><button class="btn" type="submit">Upload Document</button></form></section><section class="panel"><div class="panel-head"><h2>Files & Assets</h2></div>' + recordList(dashboard.documents, 'No documents yet.', function(item) { return record(item.originalName || 'Document', item.uploadedBy || 'File', esc(item.clientEmail || '') + '<br><a style="color:var(--blue);font-weight:850;" target="_blank" rel="noopener" href="' + esc(item.url) + '">Download file</a>'); }) + '</section>';
  if (name === 'messages') mainPanel.innerHTML = formShell('adminMessageForm', 'Send Client Message', selectField('Client', 'clientEmail', clientOptions()) + field('Subject', 'subject') + area('Message', 'body', 'Write a project update or request follow-up'), 'Send Message') + '<section class="panel"><div class="panel-head"><h2>Messages</h2></div>' + recordList(dashboard.messages, 'No messages yet.', function(item) { return record(item.subject || 'Message', item.senderRole || 'Message', esc(item.clientEmail || '') + '<br>' + esc(item.body || '')); }) + '</section>';
  if (name === 'timeline') mainPanel.innerHTML = formShell('timelineUpdateForm', 'Update Timeline', selectField('Project', 'projectId', projectOptions()) + field('Start Date', 'startDate', '', 'date') + field('End Date', 'endDate', '', 'date') + field('Deadline', 'deadline', '', 'date') + field('Progress %', 'progress', '', 'number') + selectField('Status', 'status', ['Planning','In Progress','Client Review','Testing','Deployment','Completed','Suspended'].map(function(s){return option(s,s);}).join('')), 'Save Timeline') + '<section class="panel"><div class="panel-head"><h2>Project Timeline</h2></div>' + recordList(dashboard.projects, 'No timeline data yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Progress: ' + esc(item.progress || 0) + '%<br>Start: ' + fmtDate(item.startDate) + '<br>End: ' + fmtDate(item.endDate) + '<br>Deadline: ' + fmtDate(item.deadline)); }) + '</section>';
  if (name === 'risks') mainPanel.innerHTML = formShell('riskUpdateForm', 'Update Project Risk', selectField('Project', 'projectId', projectOptions()) + selectField('Risk Level', 'riskLevel', ['Low','Medium','High','Critical'].map(function(s){return option(s,s);}).join('')) + selectField('Status', 'status', ['Planning','In Progress','Client Review','Testing','Deployment','Completed','Suspended'].map(function(s){return option(s,s);}).join('')) + field('Progress %', 'progress', '', 'number') + area('Risk Notes', 'description', 'Risk, blocker, mitigation, or escalation notes'), 'Save Risk Update') + '<section class="panel"><div class="panel-head"><h2>Risk Tracking</h2></div>' + recordList(dashboard.projects, 'No project risks recorded yet.', function(item) { return record(item.projectId || item.title, item.riskLevel || 'Low', esc(item.title || '') + '<br>Status: ' + esc(item.status || 'Pending') + '<br>Progress: ' + esc(item.progress || 0) + '%<br>' + esc(item.description || '')); }) + '</section>';
  if (name === 'deliverables') mainPanel.innerHTML = formShell('deliverableUpdateForm', 'Update Deliverables', selectField('Project', 'projectId', projectOptions()) + field('Deliverables, comma-separated', 'deliverables') + selectField('Status', 'status', ['Planning','In Progress','Client Review','Testing','Deployment','Completed','Suspended'].map(function(s){return option(s,s);}).join('')) + field('Progress %', 'progress', '', 'number'), 'Save Deliverables') + '<section class="panel"><div class="panel-head"><h2>Deliverables</h2></div>' + recordList(dashboard.projects, 'No deliverables recorded yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>' + esc((item.deliverables || []).join(', ') || 'No deliverables listed yet.')); }) + '</section>';
  if (name === 'assistant') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Project AI Assistant</h2></div><form id="assistantForm" class="form-panel"><div class="grid"><div class="field"><label>Client Email</label><input name="clientEmail"></div><div class="field"><label>Project ID</label><input name="projectId"></div><div class="field full"><label>Question</label><textarea name="question" placeholder="Ask for a proposal outline, risk summary, next milestone, or project status explanation."></textarea></div></div><button class="btn" type="submit">Ask YenkasaAI</button></form><div id="assistantAnswer" class="empty" style="margin-top:16px;">Assistant response will appear here.</div></section>';
  if (name === 'analytics') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Analytics</h2></div><div class="dashboard-grid"><div>' + recordList((dashboard.analytics && dashboard.analytics.byType) || [], 'No type analytics yet.', function(item) { return record(item.type, item.count + ' requests', 'Project category performance'); }) + '</div><div>' + recordList((dashboard.analytics && dashboard.analytics.byStatus) || [], 'No status analytics yet.', function(item) { return record(item.status, item.count + ' requests', 'Pipeline status'); }) + '</div></div></section>';
  if (name === 'settings') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>Settings</h2></div><div class="info-table"><div class="info-row"><span>Admin Emails</span><span>SOFTOTECH_ADMIN_EMAILS or ADMIN_EMAILS</span></div><div class="info-row"><span>Storage</span><span>Google Firestore under the current GCloud project</span></div><div class="info-row"><span>Media</span><span>Google Cloud Storage through mediaStorage</span></div></div></section>';
  if (name === 'assistant') document.getElementById('assistantForm').addEventListener('submit', askAssistant);
  if (name === 'pricing') loadPricing();
  bindForm('approveRequestForm', function(form) { return postJson('/api/project-portal/admin/projects/approve-request', formToObject(form)); });
  bindForm('createProjectForm', function(form) { return postJson('/api/project-portal/admin/projects', formToObject(form)); });
  bindForm('quotationForm', function(form) { return postJson('/api/project-portal/admin/quotations', withServiceSelections(formToObject(form))); });
  bindForm('proposalForm', function(form) { return postJson('/api/project-portal/admin/proposals/generate', formToObject(form)); });
  bindForm('invoiceForm', function(form) { return postJson('/api/project-portal/admin/invoices', withServiceSelections(formToObject(form))); });
  bindForm('paymentForm', function(form) { return postJson('/api/project-portal/admin/payments', formToObject(form)); });
  bindForm('adminMessageForm', function(form) { return postJson('/api/project-portal/admin/messages', formToObject(form)); });
  bindForm('adminDocForm', function(form) { return postMultipart('/api/project-portal/admin/documents', form); });
  bindForm('clientForm', function(form) { return postJson('/api/project-portal/admin/clients', formToObject(form)); });
  bindForm('leadForm', function(form) { return postJson('/api/project-portal/admin/leads', formToObject(form)); });
  bindForm('requirementForm', function(form) { return postJson('/api/project-portal/admin/requirements', formToObject(form)); });
  bindForm('projectUpdateForm', function(form) { return patchProjectFromForm(form, 'projects'); });
  bindForm('teamUpdateForm', function(form) { return patchProjectFromForm(form, 'team'); });
  bindForm('timelineUpdateForm', function(form) { return patchProjectFromForm(form, 'timeline'); });
  bindForm('riskUpdateForm', function(form) { return patchProjectFromForm(form, 'risks'); });
  bindForm('deliverableUpdateForm', function(form) { return patchProjectFromForm(form, 'deliverables'); });
}
function bindRequirementForms() {
  var search = document.querySelector('[name="requirementSearch"]');
  var status = document.getElementById('requirementStatusFilter');
  var priority = document.getElementById('requirementPriorityFilter');
  if (search) search.addEventListener('input', function() { requirementState.search = search.value; renderRequirementsModule(); });
  if (status) status.addEventListener('change', function() { requirementState.status = status.value; renderRequirementsModule(); });
  if (priority) priority.addEventListener('change', function() { requirementState.priority = priority.value; renderRequirementsModule(); });
  bindForm('requirementQuickUpdateForm', function(form) {
    var data = formToObject(form);
    var requirementId = data.requirementId;
    delete data.requirementId;
    Object.keys(data).forEach(function(key) { if (data[key] === '') delete data[key]; });
    return patchRequirement(requirementId, data);
  });
  bindForm('requirementCommentForm', function(form) {
    var data = formToObject(form);
    var requirementId = data.requirementId;
    delete data.requirementId;
    return postRequirementSubresource(requirementId, 'comments', data, 'requirements');
  });
  bindForm('requirementChangeForm', function(form) {
    var data = formToObject(form);
    var requirementId = data.requirementId;
    delete data.requirementId;
    return postRequirementSubresource(requirementId, 'change-requests', data, 'requirements');
  });
  bindForm('requirementAttachmentForm', function(form) {
    var requirementId = form.querySelector('[name="requirementId"]').value;
    return postRequirementAttachment(requirementId, form);
  });
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
  var error = document.getElementById('pricingError');
  if (error) error.style.display = 'none';
  var params = new URLSearchParams();
  var searchInput = document.querySelector('[name="pricingSearch"]');
  var categoryFilter = document.getElementById('pricingCategoryFilter');
  if (searchInput && searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (categoryFilter && categoryFilter.value) params.set('categoryId', categoryFilter.value);
  var url = '/api/project-portal/admin/pricing' + (params.toString() ? '?' + params.toString() : '');
  var response = await fetch(url, { headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) { host.innerHTML = '<div class="empty">' + esc(payload.message || 'Pricing unavailable.') + '</div>'; return; }
  pricingState.categories = payload.categories || [];
  pricingState.items = payload.items || [];
  var newCategory = document.getElementById('newPricingCategory');
  if (newCategory) newCategory.innerHTML = categoryOptions('');
  if (categoryFilter) {
    var selectedCategory = categoryFilter.value || '';
    categoryFilter.innerHTML = '<option value="">All categories</option>' + categoryOptions(selectedCategory).replace('<option value="">Select category</option>', '');
    categoryFilter.value = selectedCategory;
  }
  host.innerHTML = pricingState.items.length ? pricingState.items.map(pricingRow).join('') : '<div class="empty">No pricing items yet.</div>';
  var saveBtn = document.getElementById('savePricingBtn');
  var filterBtn = document.getElementById('pricingFilterBtn');
  var exportBtn = document.getElementById('pricingExportBtn');
  var reportsBtn = document.getElementById('pricingReportsBtn');
  if (saveBtn) saveBtn.onclick = savePricing;
  if (filterBtn) filterBtn.onclick = loadPricing;
  if (exportBtn) exportBtn.onclick = exportPricingCsv;
  if (reportsBtn) reportsBtn.onclick = loadPricingReports;
  bindForm('newPricingCategoryForm', createPricingCategory);
  bindForm('newPricingForm', createPricingItem);
  bindForm('pricingImportForm', importPricingCsv);
}
function showPricingError(message) {
  var error = document.getElementById('pricingError');
  if (!error) return alert(message);
  error.textContent = message;
  error.style.display = 'block';
}
function billingOptions(selected) {
  return ['Fixed Price','Hourly','Daily','Weekly','Monthly','One-Time'].map(function(type) {
    return '<option value="' + esc(type) + '" ' + (type === selected ? 'selected' : '') + '>' + esc(type) + '</option>';
  }).join('');
}
function categoryOptions(selected) {
  return '<option value="">Select category</option>' + (pricingState.categories || []).map(function(category) {
    var id = category.categoryId || category.id || '';
    var label = category.categoryName || id;
    return '<option value="' + esc(id) + '" ' + (id === selected ? 'selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
}
function pricingRow(item) {
  var id = item.itemId || item.key || item.id || '';
  return '<article class="record pricing-row" data-key="' + esc(id) + '"><div class="record-head"><div class="record-title">' + esc(item.serviceName || item.label || id) + '</div><span class="status-pill ' + (item.isActive === false ? 'orange' : 'green') + '">' + (item.isActive === false ? 'Archived' : 'Active') + '</span></div><div class="grid"><div class="field"><label>Service Name</label><input data-field="serviceName" value="' + esc(item.serviceName || item.label || '') + '"></div><div class="field"><label>Label</label><input data-field="label" value="' + esc(item.label || item.serviceName || '') + '"></div><div class="field"><label>Billing Type</label><select data-field="billingType">' + billingOptions(item.billingType || 'One-Time') + '</select></div><div class="field"><label>Unit Price</label><input data-field="unitPrice" type="number" min="0" step="0.01" value="' + esc(item.unitPrice || item.sellingPrice || 0) + '"></div><div class="field"><label>Internal Cost</label><input data-field="internalCost" type="number" min="0" step="0.01" value="' + esc(item.internalCost || 0) + '"></div><div class="field"><label>Category</label><select data-field="categoryId">' + categoryOptions(item.categoryId || item.category || '') + '</select></div><div class="field full"><label>Description</label><input data-field="description" value="' + esc(item.description || '') + '"></div><div class="field full"><label>Triggers, comma-separated</label><input data-field="triggers" value="' + esc((item.triggers || []).join(', ')) + '"></div><label style="display:flex;gap:8px;align-items:center;"><input data-field="active" type="checkbox" ' + (item.isActive === false || item.active === false ? '' : 'checked') + '> Active</label><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;"><button class="btn ghost" type="button" data-pricing-duplicate="' + esc(id) + '">Duplicate</button><button class="btn danger" type="button" data-pricing-archive="' + esc(id) + '">Archive</button></div></div></article>';
}
async function savePricing() {
  var rows = Array.from(document.querySelectorAll('.pricing-row')).map(function(row) {
    var value = function(field) { return row.querySelector('[data-field="' + field + '"]'); };
    return {
      itemId: row.dataset.key,
      key: row.dataset.key,
      serviceName: value('serviceName').value,
      label: value('label').value,
      billingType: value('billingType').value,
      unitPrice: Number(value('unitPrice').value || 0),
      internalCost: Number(value('internalCost').value || 0),
      categoryId: value('categoryId').value,
      description: value('description').value,
      triggers: value('triggers').value.split(',').map(function(item) { return item.trim(); }).filter(Boolean),
      isActive: value('active').checked,
      active: value('active').checked
    };
  });
  var response = await fetch('/api/project-portal/admin/pricing', { method:'PUT', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify({ items: rows }) });
  var payload = await response.json();
  if (!response.ok || !payload.success) return showPricingError(payload.message || 'Could not save pricing.');
  await loadPricing();
  alert('Pricing saved. New project requests will use the updated prices.');
}
async function createPricingItem(form) {
  var data = formToObject(form);
  data.triggers = String(data.triggers || '').split(',').map(function(item) { return item.trim(); }).filter(Boolean);
  var response = await fetch('/api/project-portal/admin/pricing/items', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(data) });
  var payload = await response.json();
  if (!response.ok || !payload.success) return showPricingError(payload.message || 'Could not create pricing item.');
  form.reset();
  await loadPricing();
}
async function createPricingCategory(form) {
  var data = formToObject(form);
  var response = await fetch('/api/project-portal/admin/pricing/categories', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(data) });
  var payload = await response.json();
  if (!response.ok || !payload.success) return showPricingError(payload.message || 'Could not create pricing category.');
  form.reset();
  await loadPricing();
}
async function importPricingCsv(form) {
  var response = await fetch('/api/project-portal/admin/pricing/import-csv', { method:'POST', headers:headers(), body:new FormData(form) });
  var payload = await response.json();
  if (!response.ok || !payload.success) return showPricingError(payload.message || 'Could not import pricing CSV.');
  form.reset();
  await loadPricing();
}
async function exportPricingCsv() {
  var response = await fetch('/api/project-portal/admin/pricing/export-csv', { headers:headers() });
  if (!response.ok) return showPricingError('Could not export pricing CSV.');
  var blob = await response.blob();
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'softotech-pricing.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
async function loadPricingReports() {
  var host = document.getElementById('pricingReport');
  if (!host) return;
  host.innerHTML = '<div class="empty">Loading reports...</div>';
  var response = await fetch('/api/project-portal/admin/pricing/reports', { headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) { host.innerHTML = '<div class="empty">' + esc(payload.message || 'Could not load pricing reports.') + '</div>'; return; }
  var report = payload.report || {};
  host.innerHTML = '<section class="panel" style="box-shadow:none;"><div class="panel-head"><h2>Pricing Reports</h2></div><div class="dashboard-grid"><div>' + recordList(report.mostRequestedServices || [], 'No requested-service data yet.', function(item) { return record(item.serviceName || item.itemId, item.requests + ' requests', money(item.revenue || 0) + '<br>' + esc(item.categoryName || '')); }) + '</div><div>' + recordList(report.highestRevenueServices || [], 'No revenue data yet.', function(item) { return record(item.serviceName || item.itemId, money(item.revenue || 0), 'Profit: ' + money(item.profit || 0) + '<br>' + esc(item.categoryName || '')); }) + '</div></div></section>';
}
async function archivePricingItem(itemId) {
  var response = await fetch('/api/project-portal/admin/pricing/items/' + encodeURIComponent(itemId), { method:'DELETE', headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) return showPricingError(payload.message || 'Could not archive pricing item.');
  await loadPricing();
}
async function duplicatePricingItem(itemId) {
  var response = await fetch('/api/project-portal/admin/pricing/items/' + encodeURIComponent(itemId) + '/duplicate', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:'{}' });
  var payload = await response.json();
  if (!response.ok || !payload.success) return showPricingError(payload.message || 'Could not duplicate pricing item.');
  await loadPricing();
}
async function updateClientStatus(clientId, status) {
  if (!clientId || !status) return;
  var response = await fetch('/api/project-portal/admin/clients/' + encodeURIComponent(clientId) + '/status', { method:'PATCH', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify({ status:status }) });
  var payload = await response.json();
  if (!response.ok || !payload.success) return alert(payload.message || 'Could not update client status.');
  await loadAdmin();
  renderPanel('clients');
}
async function convertLead(leadId) {
  if (!leadId) return;
  var response = await fetch('/api/project-portal/admin/leads/' + encodeURIComponent(leadId) + '/convert', { method:'POST', headers:headers({'Content-Type':'application/json'}), body:'{}' });
  var payload = await response.json();
  if (!response.ok || !payload.success) return alert(payload.message || 'Could not convert lead.');
  await loadAdmin();
  renderPanel('leads');
}
async function patchRequirement(requirementId, patch) {
  if (!requirementId) return;
  var response = await fetch('/api/project-portal/admin/requirements/' + encodeURIComponent(requirementId), { method:'PATCH', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(patch || {}) });
  var payload = await response.json();
  if (!response.ok || !payload.success) return alert(payload.message || 'Could not update requirement.');
  await loadAdmin();
  renderPanel('requirements');
}
async function postRequirementSubresource(requirementId, resource, data, panelName) {
  if (!requirementId) throw new Error('Select a requirement first.');
  var response = await fetch('/api/project-portal/admin/requirements/' + encodeURIComponent(requirementId) + '/' + resource, { method:'POST', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(data || {}) });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not save requirement update.');
  await loadAdmin();
  renderPanel(panelName || 'requirements');
  return payload;
}
async function postRequirementAttachment(requirementId, form) {
  if (!requirementId) throw new Error('Select a requirement first.');
  var response = await fetch('/api/project-portal/admin/requirements/' + encodeURIComponent(requirementId) + '/attachments', { method:'POST', headers:headers(), body:new FormData(form) });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not upload attachment.');
  await loadAdmin();
  renderPanel('requirements');
  return payload;
}
async function patchProjectFromForm(form, panelName) {
  var data = formToObject(form);
  var projectId = data.projectId;
  delete data.projectId;
  if (!projectId) throw new Error('Select a project first.');
  if (data.assignedDevelopers !== undefined) data.assignedDevelopers = csvList(data.assignedDevelopers);
  if (data.assignedTeam !== undefined) data.assignedTeam = csvList(data.assignedTeam);
  if (data.deliverables !== undefined) data.deliverables = csvList(data.deliverables);
  Object.keys(data).forEach(function(key) {
    if (data[key] === '') delete data[key];
  });
  var response = await fetch('/api/project-portal/admin/projects/' + encodeURIComponent(projectId), { method:'PATCH', headers:headers({'Content-Type':'application/json'}), body:JSON.stringify(data) });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not update project.');
  await loadAdmin();
  renderPanel(panelName || 'projects');
  return payload;
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
document.body.addEventListener('click', function(event) {
  var target = event.target.closest('[data-open]');
  if (target) { event.preventDefault(); renderPanel(target.dataset.open); return; }
  var reqCategory = event.target.closest('[data-req-category]');
  if (reqCategory) { event.preventDefault(); requirementState.category = reqCategory.dataset.reqCategory; renderRequirementsModule(); return; }
  var reqView = event.target.closest('[data-req-view]');
  if (reqView) { event.preventDefault(); requirementState.view = reqView.dataset.reqView; renderRequirementsModule(); return; }
  var reqSelect = event.target.closest('[data-req-select]');
  if (reqSelect) { event.preventDefault(); requirementState.selectedId = reqSelect.dataset.reqSelect; renderRequirementsModule(); return; }
  var convert = event.target.closest('[data-lead-convert]');
  if (convert) { event.preventDefault(); convertLead(convert.dataset.leadConvert); return; }
  var approve = event.target.closest('[data-requirement-approve]');
  if (approve) { event.preventDefault(); patchRequirement(approve.dataset.requirementApprove, { approved:true, status:'Approved' }); return; }
  var complete = event.target.closest('[data-requirement-complete]');
  if (complete) { event.preventDefault(); patchRequirement(complete.dataset.requirementComplete, { completed:true, status:'Completed' }); return; }
  var clientStatus = event.target.closest('[data-client-status]');
  if (clientStatus) { event.preventDefault(); updateClientStatus(clientStatus.dataset.clientStatus, clientStatus.dataset.status); return; }
  var duplicatePricing = event.target.closest('[data-pricing-duplicate]');
  if (duplicatePricing) { event.preventDefault(); duplicatePricingItem(duplicatePricing.dataset.pricingDuplicate); return; }
  var archivePricing = event.target.closest('[data-pricing-archive]');
  if (archivePricing) { event.preventDefault(); archivePricingItem(archivePricing.dataset.pricingArchive); }
});
document.body.addEventListener('dragstart', function(event) {
  var card = event.target.closest('[data-req-card]');
  if (!card || !event.dataTransfer) return;
  event.dataTransfer.setData('text/plain', card.dataset.reqCard);
});
document.body.addEventListener('dragover', function(event) {
  if (event.target.closest('[data-req-drop-status]')) event.preventDefault();
});
document.body.addEventListener('drop', function(event) {
  var column = event.target.closest('[data-req-drop-status]');
  if (!column || !event.dataTransfer) return;
  event.preventDefault();
  var requirementId = event.dataTransfer.getData('text/plain');
  var status = column.dataset.reqDropStatus;
  patchRequirement(requirementId, { status:status }).catch(function(error) { alert(error.message); });
});
document.getElementById('logoutBtn').addEventListener('click', function() { localStorage.removeItem('softOTechPortalToken'); localStorage.removeItem('portfolioAdminToken'); window.location.href = '/admin/login'; });
if (tokenInput.value.trim()) loadAdmin().catch(function() {});
</script>`,
  }));
});

module.exports = router;
