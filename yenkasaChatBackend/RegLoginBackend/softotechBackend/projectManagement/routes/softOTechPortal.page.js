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
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
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
    .status-pill.red { background:#fee2e2; color:#dc2626; }
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
    .assignment-layout { display:grid; grid-template-columns:minmax(420px,.82fr) minmax(0,1.18fr); gap:16px; align-items:start; }
    .assignment-page-head h1 { margin:0; font-size:1.2rem; }
    .assignment-page-head p { margin:4px 0 0; color:var(--muted); font-size:.84rem; }
    .assignment-heading { display:flex; align-items:center; gap:8px; }
    .assignment-step { width:24px; height:24px; border-radius:999px; display:grid; place-items:center; flex:0 0 24px; color:white; background:linear-gradient(135deg,#6658ff,#7c3aed); font-size:.75rem; font-weight:900; box-shadow:0 4px 10px rgba(124,58,237,.2); }
    .assignment-panel { padding:18px; }
    .assignment-panel .panel-head { margin-bottom:12px; }
    .assignment-projects { display:grid; grid-template-columns:repeat(5,minmax(180px,1fr)); gap:12px; overflow:auto; padding:2px; }
    .assignment-project { border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:#fbfdff; cursor:pointer; text-align:left; }
    .assignment-project.active { border-color:#1265ff; background:#eff6ff; box-shadow:0 0 0 3px #dbeafe; }
    .assignment-card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .assignment-work-rows { display:grid; gap:8px; }
    .assignment-work-row { display:grid; grid-template-columns:minmax(138px,.8fr) minmax(150px,1fr) 96px; gap:8px; align-items:center; border:1px solid var(--line); border-radius:10px; padding:9px 10px; background:#fbfdff; }
    .assignment-work-row.active { border-color:#7c3aed; box-shadow:0 0 0 3px #ede9fe; background:#fbf7ff; }
    .assignment-work-row:nth-child(1) { background:#faf8ff; border-color:#ddd6fe; }
    .assignment-work-row:nth-child(2) { background:#f4f8ff; border-color:#bfdbfe; }
    .assignment-work-row:nth-child(3) { background:#f3fbf6; border-color:#bbf7d0; }
    .assignment-work-row:nth-child(4) { background:#fffaf0; border-color:#fed7aa; }
    .assignment-work-row:nth-child(5) { background:#fff7f8; border-color:#fecdd3; }
    .assignment-work-row:nth-child(6) { background:#f2fbfd; border-color:#bae6fd; }
    .assignment-work-row.active { border-color:#7c3aed; box-shadow:0 0 0 2px #ede9fe; }
    .assignment-work-title { display:grid; gap:2px; min-width:0; }
    .assignment-work-title strong { color:#0f172a; }
    .assignment-work-title .row-meta { font-size:.78rem; line-height:1.3; }
    .assignment-control { margin:0; }
    .assignment-control select, .assignment-filter-row input, .assignment-filter-row select { min-height:42px; height:42px; padding:7px 10px; border-radius:8px; }
    .assignment-action { width:96px; min-height:42px; height:42px; padding:8px 12px; border-radius:8px; }
    .assignment-status { margin-top:10px; min-height:18px; }
    .assignment-status.info { color:#1d4ed8; font-weight:850; }
    .assignment-status.success { color:#15803d; font-weight:850; }
    .assignment-status.error { color:#b91c1c; font-weight:850; }
    .assignment-filter-row { display:grid; grid-template-columns:minmax(118px,.8fr) minmax(155px,1.1fr) auto auto; gap:8px; align-items:end; margin-bottom:10px; }
    .assignment-filter-row .field { gap:4px; }
    .assignment-filter-row label { font-size:.78rem; }
    .assignment-toggle { display:flex; gap:6px; align-items:center; min-height:42px; white-space:nowrap; font-size:.78rem; font-weight:750; }
    .assignment-toggle input { width:15px; height:15px; min-height:0; padding:0; }
    .team-table-wrap { overflow:auto; border:1px solid var(--line); border-radius:12px; background:white; }
    .team-table { width:100%; border-collapse:collapse; min-width:700px; font-size:.84rem; }
    .team-table th, .team-table td { padding:7px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:middle; }
    .team-table th { color:var(--muted); font-size:.75rem; font-weight:850; background:#fbfdff; white-space:nowrap; }
    .team-table tr:last-child td { border-bottom:0; }
    .team-table .progress-track { height:6px; margin-top:4px; }
    .team-table .btn { min-height:34px; height:34px; padding:6px 10px; border-radius:7px; }
    .team-member-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:white; display:grid; gap:10px; }
    .team-member-head { display:flex; gap:10px; align-items:center; }
    .team-member-photo { width:34px; height:34px; border-radius:999px; object-fit:contain; object-position:center top; background:#f8fafc; border:1px solid var(--line); }
    .availability { display:inline-flex; width:max-content; border-radius:999px; padding:3px 7px; font-size:.72rem; font-weight:850; background:#dcfce7; color:#15803d; }
    .availability.Limited { background:#ffedd5; color:#c2410c; }
    .availability.Unavailable { background:#fee2e2; color:#b91c1c; }
    .assignment-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 18px; }
    .assignment-summary-row { display:grid; grid-template-columns:minmax(145px,.9fr) auto minmax(150px,1.1fr); gap:8px; align-items:center; min-height:38px; border-bottom:1px solid var(--line); padding:6px 0; }
    .assignment-summary-row span:last-child { color:var(--muted); }
    .req-page { display:grid; gap:14px; font-size:13px; }
    .req-page .panel { border-radius:10px; padding:0; box-shadow:0 8px 22px rgba(7,18,38,.04); }
    .req-page .panel-head { margin:0; gap:10px; }
    .req-page h2 { font-size:18px; }
    .req-page .btn { min-height:34px; height:34px; padding:7px 12px; border-radius:7px; font-size:13px; }
    .req-page input, .req-page select, .req-page textarea { min-height:34px; height:34px; padding:6px 9px; border-radius:7px; font-size:13px; }
    .req-page textarea { min-height:68px; height:auto; }
    .req-page label { font-size:11px; color:#4b5870; }
    .req-header { min-height:108px; padding:16px 18px; display:grid; grid-template-columns:88px minmax(260px,1fr) auto; gap:18px; align-items:center; }
    .req-project-logo { width:76px; height:76px; border-radius:10px; border:1px solid var(--line); object-fit:contain; background:white; padding:4px; }
    .req-header-title-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .req-header-title { font-size:24px; line-height:1.15; margin:0; font-weight:850; letter-spacing:0; }
    .req-header-grid { display:grid; grid-template-columns:repeat(6,minmax(92px,1fr)); gap:0; margin-top:12px; }
    .req-header-stat { min-height:38px; padding:0 18px; border-left:1px solid var(--line); }
    .req-header-stat:first-child { border-left:0; padding-left:0; }
    .req-header-stat span { display:block; color:#5d6a80; font-size:12px; font-weight:800; }
    .req-header-stat strong { display:block; margin-top:4px; font-size:13px; color:#071226; font-weight:750; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .req-progress-ring { width:54px; height:54px; border-radius:999px; display:grid; place-items:center; background:conic-gradient(#58c84f var(--progress), #e9eef5 0); color:#071226; font-size:13px; font-weight:850; }
    .req-progress-ring span { width:44px; height:44px; border-radius:999px; display:grid; place-items:center; background:white; border:1px solid #edf1f7; }
    .req-metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
    .req-kpi { min-height:98px; padding:14px 16px; border-radius:10px; display:grid; grid-template-columns:40px 1fr; gap:12px; align-items:center; box-shadow:0 8px 20px rgba(7,18,38,.04); }
    .req-kpi .metric-icon { width:38px; height:38px; border-radius:999px; font-size:12px; box-shadow:none; }
    .req-kpi small { font-size:13px; line-height:1.15; color:#263246; font-weight:750; }
    .req-kpi strong { font-size:24px; margin:3px 0 2px; line-height:1; }
    .req-kpi .row-meta { font-size:12px; line-height:1.25; margin:0; }
    .req-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(300px,28%); gap:14px; align-items:start; }
    .req-table-panel { overflow:hidden; }
    .req-tabs { display:flex; gap:0; overflow-x:auto; border-bottom:1px solid var(--line); padding:0 16px; }
    .req-chip { min-height:42px; border:0; border-bottom:2px solid transparent; background:transparent; padding:0 14px; color:#334155; font-size:13px; font-weight:750; cursor:pointer; white-space:nowrap; }
    .req-chip.active { color:#2f46ff; border-bottom-color:#2f46ff; }
    .req-toolbar { display:grid; grid-template-columns:minmax(180px,1.35fr) minmax(116px,.78fr) minmax(108px,.72fr) minmax(108px,.72fr) minmax(140px,.9fr) auto; gap:8px; align-items:end; padding:12px 16px; border-bottom:1px solid var(--line); }
    .req-toolbar .field { gap:4px; }
    .req-toolbar .btn { width:78px; }
    .req-table-wrap { overflow:auto; }
    .req-table { width:100%; border-collapse:collapse; min-width:1040px; font-size:13px; }
    .req-table th { padding:8px 10px; border-bottom:1px solid var(--line); background:#fbfdff; color:#4b5870; text-align:left; font-size:12px; font-weight:850; white-space:nowrap; }
    .req-table td { padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:middle; }
    .req-table tr { height:43px; cursor:pointer; }
    .req-table tbody tr.active, .req-table tr:hover { background:#f8fbff; }
    .req-table strong { font-size:13px; font-weight:800; }
    .req-table .row-meta { font-size:11.5px; line-height:1.2; max-width:360px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .req-table .status-pill, .req-detail .status-pill, .req-kanban .status-pill { min-height:21px; padding:3px 7px; font-size:11px; border-radius:5px; }
    .req-table .progress-track { height:5px; margin-top:4px; }
    .req-owner { display:flex; align-items:center; gap:7px; min-width:0; }
    .req-owner-avatar { width:24px; height:24px; border-radius:999px; display:grid; place-items:center; background:#dbeafe; color:#1d4ed8; font-size:10px; font-weight:900; border:1px solid #bfdbfe; flex:0 0 24px; }
    .req-owner-text { min-width:0; }
    .req-owner-text strong { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .req-owner-text span { display:block; color:var(--muted); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .req-table-footer { min-height:44px; padding:0 16px; display:flex; align-items:center; justify-content:space-between; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
    .req-kanban { display:grid; grid-template-columns:repeat(6,minmax(180px,1fr)); gap:10px; overflow:auto; }
    .req-kanban-col { min-height:320px; background:#f8fafc; padding:10px; border-radius:10px; }
    .req-kanban-card { box-shadow:none; padding:10px; border-radius:10px; gap:6px; }
    .req-detail { position:sticky; top:102px; max-height:calc(100vh - 122px); overflow:auto; padding:16px; }
    .req-detail .panel-head { align-items:flex-start; margin-bottom:12px; }
    .req-detail h2 { font-size:16px; line-height:1.25; margin:4px 0 0; }
    .req-detail .record-meta { font-size:13px; line-height:1.45; }
    .req-detail-tabs { display:flex; gap:16px; border-bottom:1px solid var(--line); margin:12px -16px 12px; padding:0 16px; }
    .req-detail-tab { min-height:32px; display:flex; align-items:center; gap:5px; border-bottom:2px solid transparent; color:#4b5870; font-size:12px; font-weight:750; }
    .req-detail-tab.active { color:#2f46ff; border-bottom-color:#2f46ff; }
    .req-detail .info-row { grid-template-columns:96px minmax(0,1fr); gap:8px; padding:8px 0; font-size:13px; }
    .req-detail .info-row span:first-child { font-size:12px; color:var(--muted); }
    .req-detail .progress-track { height:6px; margin-top:6px; }
    .req-detail .form-panel { gap:8px; max-width:none; }
    .req-detail .grid { gap:8px; }
    .req-detail-section { margin-top:14px; }
    .req-detail-section h3 { margin:0 0 8px; font-size:14px; }
    .req-detail .records { gap:8px; }
    .req-detail .record { padding:10px; border-radius:10px; gap:5px; }
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
    @media (max-width:1180px) { .req-layout { grid-template-columns:1fr; } .req-detail { position:relative; top:auto; max-height:none; } .req-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .req-toolbar { grid-template-columns:repeat(2,minmax(0,1fr)); } .req-toolbar .btn { width:100%; } .req-header { grid-template-columns:76px 1fr; } .req-header-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .req-progress-ring { grid-column:1 / -1; justify-self:start; } }
    @media (max-width:1180px) { .assignment-layout { grid-template-columns:1fr; } .assignment-card-grid, .assignment-summary { grid-template-columns:repeat(2,minmax(0,1fr)); } .assignment-projects { grid-template-columns:repeat(2,minmax(180px,1fr)); } }
    @media (max-width:860px) { .public-shell { grid-template-columns:1fr; background:#f8fbff; } .public-brand { min-height:auto; padding:26px; background:linear-gradient(135deg,#06182f,#0c2444); } .app-shell { grid-template-columns:1fr; } .sidebar { position:relative; height:auto; min-height:auto; max-height:none; overflow:visible; } .side-nav { grid-template-columns:repeat(2,minmax(0,1fr)); } .topbar { height:auto; padding:18px; align-items:flex-start; } .content { padding:18px; } .metrics, .quick-actions, .grid, .request-grid, .assignment-card-grid, .assignment-summary, .assignment-projects { grid-template-columns:1fr; } .assignment-filter-row { grid-template-columns:repeat(2,minmax(0,1fr)); } .request-detail { grid-template-columns:1fr; gap:4px; } .timeline { grid-template-columns:1fr; gap:16px; } .step:before { display:none; } }
    @media (max-width:620px) { .assignment-work-row, .assignment-summary-row { grid-template-columns:1fr; } .assignment-action { width:100%; } }
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
    ['__section_engineering', '', 'Engineering'],
    ['team-performance', 'TP', 'Team Performance', '/admin/engineering'],
    ['developer-profiles', 'DP', 'Developer Profiles'],
    ['code-quality', 'CQ', 'Code Quality'],
    ['test-results', 'TR', 'Test Results'],
    ['github-activity', 'GH', 'GitHub Activity'],
    ['bug-analytics', 'BA', 'Bug Analytics'],
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
    <nav class="side-nav">${items.map(([key, icon, label, href]) => key.indexOf('__section_') === 0
      ? `<div style="padding:14px 16px 4px;color:#93a9c7;font-size:.76rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">${label}</div>`
      : (href
        ? `<a class="nav-item ${key === active ? 'active' : ''}" href="${href}"><span class="nav-icon">${icon}</span>${label}</a>`
        : `<button class="nav-item ${key === active ? 'active' : ''}" data-panel="${key}"><span class="nav-icon">${icon}</span>${label}</button>`)).join('')}</nav>
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
  return '<article class="panel team-card" data-team-id="' + esc(member.id) + '"><div class="panel-head"><div><h2>' + esc(member.name || member.id) + '</h2><p class="row-meta">' + esc(member.role || 'Team Member') + '</p></div><img src="' + esc(photo) + '" alt="' + esc(member.name || '') + '" style="width:76px;height:76px;border-radius:999px;object-fit:contain;object-position:center top;background:#f8fafc;border:1px solid var(--line);"></div><div class="grid"><div class="field"><label>Full Name</label><input data-field="name" value="' + esc(member.name) + '"></div><div class="field"><label>Role</label><input data-field="role" value="' + esc(member.role) + '"></div><div class="field"><label>Department</label><input data-field="department" value="' + esc(member.department) + '"></div><div class="field"><label>Status</label><select data-field="status"><option value="Active Team Member" ' + (member.status !== 'Inactive' ? 'selected' : '') + '>Active Team Member</option><option value="Inactive" ' + (member.status === 'Inactive' ? 'selected' : '') + '>Inactive</option></select></div><div class="field full"><label>Email</label><input data-field="email" type="email" value="' + esc(member.email) + '"></div><div class="field full"><label>LinkedIn</label><input data-field="linkedIn" value="' + esc(member.linkedIn || member.linkedin) + '"></div><div class="field full"><label>Photo URL</label><input data-field="photo" value="' + esc(photo) + '"></div><div class="field full"><label>Bio</label><textarea data-field="bio">' + esc(member.bio || member.background) + '</textarea></div><div class="field full"><label>Skills, one per line</label><textarea data-field="skills">' + esc(listText(member.skills)) + '</textarea></div><div class="field full"><label>Background</label><textarea data-field="background">' + esc(member.background) + '</textarea></div><div class="field"><label>Field of Study</label><input data-field="fieldOfStudy" value="' + esc(member.fieldOfStudy) + '"></div><div class="field"><label>Major / Focus</label><input data-field="major" value="' + esc(member.major) + '"></div></div><div style="height:16px"></div><form class="form-panel team-upload-form" data-team-upload="' + esc(member.id) + '" enctype="multipart/form-data"><div class="grid"><div class="field full"><label>Upload Profile Picture</label><input name="file" type="file" accept="image/*" required></div></div><button class="btn secondary" type="submit">Upload Photo</button></form></article>';
}
function render() {
  editor.innerHTML = '<section class="panel"><div class="panel-head"><h2>Products Gallery</h2></div><div class="records">' + products.map(productCard).join('') + '</div></section><section class="panel"><div class="panel-head"><h2>Team Members</h2><button class="btn ghost" type="button" id="addTeamBtn">Add Member</button></div><div class="records">' + teamMembers.map(teamCard).join('') + '</div></section>';
  bindUploads();
  bindTeamUploads();
  var addBtn = document.getElementById('addTeamBtn');
  if (addBtn) addBtn.onclick = function() {
    var id = 'team-member-' + Date.now();
    teamMembers.push({ id:id, name:'New Team Member', role:'Team Member', department:'', status:'Active Team Member', active:true, photo:'/images/default.png', bio:'', background:'', skills:[], linkedIn:'', email:'', fieldOfStudy:'', major:'' });
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
    member.department = card.querySelector('[data-field="department"]').value.trim();
    member.status = card.querySelector('[data-field="status"]').value.trim();
    member.active = member.status !== 'Inactive';
    member.email = card.querySelector('[data-field="email"]').value.trim();
    member.linkedIn = card.querySelector('[data-field="linkedIn"]').value.trim();
    member.photo = card.querySelector('[data-field="photo"]').value.trim();
    member.bio = card.querySelector('[data-field="bio"]').value.trim();
    member.skills = splitList(card.querySelector('[data-field="skills"]').value);
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
    return Object.assign({ department: '', status: 'Active Team Member', active: true, photo: '/images/default.png', bio: '', background: '', skills: [], linkedIn: '', email: '', fieldOfStudy: '', major: '' }, member);
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
  teamMembers = (content.teamMembers || teamMembers).map(function(member) { return Object.assign({ department: '', status: 'Active Team Member', active: true, photo: '/images/default.png', bio: '', background: '', skills: [], linkedIn: '', email: '', fieldOfStudy: '', major: '' }, member); });
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
function statusClass(status) { status = String(status || '').toLowerCase(); if (status.includes('fail') || status.includes('error')) return 'orange'; if (status.includes('complete') || status.includes('approved') || status.includes('paid') || status.includes('synced') || status.includes('connected')) return 'green'; if (status.includes('progress') || status.includes('sent') || status.includes('sync')) return 'blue'; if (status.includes('pending') || status.includes('review')) return 'orange'; return ''; }
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

router.get(['/admin/engineering', '/admin/team-performance'], (req, res) => {
  res.redirect(302, '/engineering-dashboard');
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
var activePanel = 'dashboard';
var pricingState = { categories: [], items: [] };
var requirementState = { category:'All Requirements', view:'table', selectedId:'', search:'', status:'', priority:'', assignee:'' };
var githubState = { projectId:'', connection:null, repositories:[], branches:[], folders:[], mappings:[], activity:[], selectedRepository:'', selectedBranch:'' };
var mainPanel = document.getElementById('mainPanel');
var errorBox = document.getElementById('errorBox');
function headers(extra) { return Object.assign({ Authorization:'Bearer ' + tokenInput.value.trim() }, extra || {}); }
function esc(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function money(value) { var amount = Number(value || 0); return 'GHS ' + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(value) { if (!value) return 'Not scheduled'; var d = new Date(value); return Number.isNaN(d.getTime()) ? 'Not scheduled' : d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' }); }
function statusClass(status) { status = String(status || '').toLowerCase(); if (status.includes('fail') || status.includes('error')) return 'orange'; if (status.includes('complete') || status.includes('approved') || status.includes('paid') || status.includes('synced') || status.includes('connected')) return 'green'; if (status.includes('progress') || status.includes('sent') || status.includes('sync')) return 'blue'; if (status.includes('pending') || status.includes('review')) return 'orange'; return ''; }
function renderMetrics() {
  var m = dashboard.metrics || {};
  var cards = [['CL','Total Clients',m.totalClients || 0,'Registered client profiles','linear-gradient(135deg,#1265ff,#2447e8)'],['PR','Total Requests',m.totalRequests || 0,'Captured leads','linear-gradient(135deg,#7c3aed,#2563eb)'],['OP','Open Projects',m.openProjects || 0,'Active delivery work','linear-gradient(135deg,#18b45b,#12a150)'],['RV','Revenue Generated',money(m.revenueGenerated || 0),'Paid or completed invoices','linear-gradient(135deg,#f6a313,#f97316)']];
  document.getElementById('metrics').innerHTML = cards.map(function(card) { return '<article class="metric-card"><div class="metric-icon" style="background:' + card[4] + '">' + card[0] + '</div><div><small>' + card[1] + '</small><strong>' + esc(card[2]) + '</strong><span class="row-meta">' + esc(card[3]) + '</span></div></article>'; }).join('');
}
function setAdminMetricsVisibility(panelName) {
  var metrics = document.getElementById('metrics');
  if (metrics) metrics.style.display = panelName === 'dashboard' ? 'grid' : 'none';
}
function recordList(items, empty, formatter) { if (!items || !items.length) return '<div class="empty">' + empty + '</div>'; return '<div class="records">' + items.map(formatter).join('') + '</div>'; }
function record(title, status, meta, action) { return '<article class="record"><div class="record-head"><div class="record-title">' + esc(title) + '</div><span class="status-pill ' + statusClass(status) + '">' + esc(status || 'Open') + '</span></div><div class="record-meta">' + meta + '</div>' + (action || '') + '</article>'; }
function option(value, label) { return '<option value="' + esc(value) + '">' + esc(label || value) + '</option>'; }
function clientOptions() { return '<option value="">Select client</option>' + (dashboard.clients || []).map(function(item) { return option(item.email, (item.fullName || item.email) + (item.companyName ? ' - ' + item.companyName : '')); }).join(''); }
function requestOptions() { return '<option value="">Select request</option>' + (dashboard.requests || []).map(function(item) { var req = item.requirements || {}; var contact = item.contact || {}; return option(item.requestId, item.requestId + ' - ' + (contact.fullName || contact.email || 'Client') + ' - ' + (req.projectType || req.websiteType || 'Project')); }).join(''); }
function projectOptions() { return '<option value="">Select project</option>' + (dashboard.projects || []).map(function(item) { return option(item.projectId, item.projectId + ' - ' + (item.title || 'Project')); }).join(''); }
function multiSelectField(label, name, optionsHtml) { return '<div class="field"><label>' + esc(label) + '</label><select name="' + esc(name) + '" multiple size="5">' + optionsHtml + '</select></div>'; }
function teamMemberSelect(label, name, roleHint, allowEmpty, selected) {
  return selectField(label, name, (allowEmpty === false ? '' : '<option value="">Select team member</option>') + teamOptions(roleHint, selected));
}
function teamMemberMulti(label, name, roleHint) {
  return multiSelectField(label, name, teamOptions(roleHint));
}
function teamOptions(roleHint, selected) {
  var members = activeTeamMembers();
  if (roleHint) {
    var hinted = members.filter(function(member) { return String(member.role || member.teamRole || '').toLowerCase().includes(String(roleHint).toLowerCase()); });
    if (hinted.length) members = hinted;
  }
  return members.map(function(member) {
    var value = member.userId || member.id || member.clientId;
    return '<option value="' + esc(value) + '" ' + (value === selected ? 'selected' : '') + '>' + esc((member.fullName || member.email || 'Team Member') + ' - ' + (member.role || member.teamRole || 'Team Member') + ' (' + (member.availability || 'Available') + ')') + '</option>';
  }).join('');
}
function activeTeamMembers() {
  return (dashboard.teamMembers || []).filter(function(member) {
    var status = String(member.status || '').trim().toLowerCase();
    return member.active !== false && !['inactive','suspended','closed'].includes(status);
  }).slice().sort(function(a, b) {
    var aName = a.fullName || a.name || a.email || '';
    var bName = b.fullName || b.name || b.email || '';
    return aName.localeCompare(bName);
  });
}
function teamMemberById(id) {
  return (dashboard.teamMembers || []).find(function(member) {
    return [member.userId, member.id, member.clientId, member.email, member.fullName].filter(Boolean).includes(id);
  }) || null;
}
function teamRoleOptions(selected) {
  return ['Project Manager','Frontend Developer','Backend Engineer','Mobile Developer','QA Engineer','DevOps Engineer','Team Lead','Developer'].map(function(role) {
    return '<option value="' + esc(role) + '" ' + (role === selected ? 'selected' : '') + '>' + esc(role) + '</option>';
  }).join('');
}
function engineeringStats(projectId) {
  var projects = projectId ? (dashboard.projects || []).filter(function(project) { return project.projectId === projectId; }) : (dashboard.projects || []);
  var requirements = (dashboard.requirements || []).filter(function(item) { return !projectId || item.projectId === projectId; });
  var assignments = (dashboard.assignments || []).filter(function(item) { return !projectId || item.projectId === projectId; });
  var repositories = (dashboard.projectRepositories || []).filter(function(item) { return !projectId || item.projectId === projectId; });
  var activities = (dashboard.githubActivity || []).filter(function(item) { return !projectId || item.projectId === projectId; });
  var activeDevelopers = new Set(assignments.map(function(item) { return item.userId; }).filter(Boolean)).size || (dashboard.teamMembers || []).filter(function(member) { return member.status !== 'Inactive' && member.active !== false; }).length;
  var projectProgress = projects.length ? Math.round(projects.reduce(function(sum, project) { return sum + Number(project.progress || project.progressPercentage || 0); }, 0) / projects.length) : 0;
  var qualityScores = activities.flatMap(function(item) { return item.codeQuality || []; }).map(function(item) { return Number(item.score || item.quality || 0); }).filter(function(score) { return score > 0; });
  var quality = qualityScores.length ? Math.round(qualityScores.reduce(function(sum, score) { return sum + score; }, 0) / qualityScores.length) : 0;
  var openBugs = requirements.filter(function(item) { return /bug|defect|issue/i.test([item.category, item.requirementName, item.requirementTitle, item.requirementDescription, item.description].join(' ')) && item.status !== 'Completed'; }).length;
  var commits = activities.reduce(function(sum, item) { return sum + ((item.commits || []).length || Number(item.metrics && item.metrics.commitsRetrieved || 0)); }, 0);
  var pullRequests = activities.reduce(function(sum, item) { return sum + ((item.pullRequests || []).length || Number(item.metrics && item.metrics.pullRequestsRetrieved || 0)); }, 0);
  var pendingPullRequests = activities.reduce(function(sum, item) { return sum + (item.pullRequests || []).filter(function(pr) { return pr.state === 'open'; }).length; }, 0);
  var failedBuilds = activities.reduce(function(sum, item) { return sum + (item.builds || []).filter(function(build) { return ['failure','failed','cancelled','timed_out'].includes(String(build.conclusion || '').toLowerCase()); }).length; }, 0);
  var contributors = activities.reduce(function(sum, item) { return sum + ((item.contributors || []).length || Number(item.metrics && item.metrics.contributorsRetrieved || 0)); }, 0);
  var unmappedContributors = activities.reduce(function(sum, item) { return sum + Number(item.metrics && item.metrics.unmappedContributors || 0); }, 0);
  return { activeDevelopers:activeDevelopers, projectProgress:projectProgress, codeQuality:quality, openBugs:openBugs, failedBuilds:failedBuilds, pendingPullRequests:pendingPullRequests, commits:commits, pullRequests:pullRequests, contributors:contributors, unmappedContributors:unmappedContributors, configuredRepositories:repositories.length };
}
function engineeringOverviewWidget(projectId) {
  var stats = engineeringStats(projectId);
  var href = projectId ? '#' : '/admin/engineering';
  var attrs = projectId ? ' href="#" data-project-engineering="' + esc(projectId) + '"' : ' href="' + href + '"';
  return '<a class="panel" style="display:block;color:inherit;"' + attrs + '><div class="panel-head"><div><h2>Engineering Overview</h2><p class="row-meta">Team performance, GitHub activity, quality, builds, reviews, and bug health.</p></div><span class="status-pill blue">Open</span></div><div class="metrics" style="grid-template-columns:repeat(3,minmax(0,1fr));">' +
    [['AD','Active Developers',stats.activeDevelopers],['PG','Project Progress %',stats.projectProgress + '%'],['CM','Commits',stats.commits],['PR','Pull Requests',stats.pullRequests],['UC','Unmapped Contributors',stats.unmappedContributors],['FB','Failed Builds',stats.failedBuilds]].map(function(card) {
      return '<article class="metric-card" style="min-height:108px;box-shadow:none;"><div class="metric-icon" style="background:linear-gradient(135deg,#1265ff,#14b85a);">' + card[0] + '</div><div><small>' + esc(card[1]) + '</small><strong>' + esc(card[2]) + '</strong></div></article>';
    }).join('') + '</div></a>';
}
function renderEngineeringDashboard(projectId, mode) {
  var project = (dashboard.projects || []).find(function(item) { return item.projectId === projectId; }) || null;
  var stats = engineeringStats(projectId);
  var title = project ? (project.title || project.projectName || project.projectId) : 'Engineering Performance';
  var requirements = (dashboard.requirements || []).filter(function(item) { return !projectId || item.projectId === projectId; });
  var assignments = (dashboard.assignments || []).filter(function(item) { return !projectId || item.projectId === projectId; });
  var body = '<section class="panel"><div class="panel-head"><div><h2>' + esc(title) + '</h2><p class="row-meta">' + (project ? 'Project-specific engineering metrics' : 'Cross-project engineering metrics') + '</p></div><a class="btn ghost" href="/engineering-dashboard">Full Dashboard</a></div>' + engineeringOverviewWidget(projectId) + '</section>';
  body += '<section class="panel"><div class="panel-head"><h2>Project Progress</h2></div>' + recordList(project ? [project] : (dashboard.projects || []), 'No projects yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || item.projectName || '') + '<br>Progress: ' + esc(item.progress || item.progressPercentage || 0) + '%<div class="progress-track"><div class="progress-bar" style="width:' + Number(item.progress || item.progressPercentage || 0) + '%"></div></div>'); }) + '</section>';
  body += '<section class="panel"><div class="panel-head"><h2>Team Scores</h2></div>' + recordList(assignments, 'No assigned team members yet.', function(item) { return record(item.fullName || item.email || item.userId, item.role, 'Member ID: ' + esc(item.userId || '') + '<br>Project: ' + esc(item.projectId || '')); }) + '</section>';
  body += '<section class="panel"><div class="panel-head"><h2>Quality Analytics</h2></div><div class="info-table"><div class="info-row"><span>Code Quality</span><span>' + esc(stats.codeQuality) + '%</span></div><div class="info-row"><span>Commits</span><span>' + esc(stats.commits) + '</span></div><div class="info-row"><span>Pull Requests</span><span>' + esc(stats.pullRequests) + '</span></div><div class="info-row"><span>Unmapped Contributors</span><span>' + esc(stats.unmappedContributors) + '</span></div><div class="info-row"><span>Open Bugs</span><span>' + esc(stats.openBugs) + '</span></div><div class="info-row"><span>Failed Builds</span><span>' + esc(stats.failedBuilds) + '</span></div><div class="info-row"><span>Pending Pull Requests</span><span>' + esc(stats.pendingPullRequests) + '</span></div></div></section>';
  body += '<section class="panel"><div class="panel-head"><h2>Test Results and Bug Reports</h2></div>' + recordList(requirements.filter(function(item) { return ['Testing','Client Review','Completed'].includes(item.status) || /bug|test|qa/i.test([item.category, item.requirementName, item.requirementDescription].join(' ')); }), 'No test or bug records yet.', function(item) { return record(item.requirementId || item.requirementName, item.status || 'Open', esc(item.requirementName || item.requirementTitle || '') + '<br>' + esc(item.requirementDescription || item.description || '')); }) + '</section>';
  mainPanel.innerHTML = '<div style="display:grid;gap:20px;">' + body + '</div>';
}
function assignmentsForProject(projectId) {
  return (dashboard.assignments || []).filter(function(item) { return item.projectId === projectId; });
}
function assignmentValues(projectId, role) {
  return assignmentsForProject(projectId).filter(function(item) { return item.role === role; }).map(function(item) { return item.userId; });
}
var assignmentWorkAreas = [
  { key:'projectManager', title:'Project Manager', role:'Project Manager', hint:'Project oversight and delivery coordination' },
  { key:'frontendDeveloper', title:'Frontend Development', role:'Frontend Developer', hint:'User interface and client-side implementation' },
  { key:'backendEngineer', title:'Backend Development', role:'Backend Engineer', hint:'APIs, server-side logic, and database work' },
  { key:'mobileDeveloper', title:'Mobile Development', role:'Mobile Developer', hint:'Mobile application implementation' },
  { key:'qaEngineer', title:'QA Testing', role:'QA Engineer', hint:'Testing, validation, and quality control' },
  { key:'devopsEngineer', title:'DevOps', role:'DevOps Engineer', hint:'Deployment, infrastructure, and build pipelines' }
];
function assignmentWorkAreaByKey(key) {
  return assignmentWorkAreas.find(function(area) { return area.key === key; }) || assignmentWorkAreas[0];
}
function assignmentMemberOptions(roleHint, selected) {
  return '<option value="">Select Team Member</option>' + teamOptions('', selected);
}
function renderAssignmentSummary(projectId) {
  var rows = assignmentsForProject(projectId);
  var form = document.getElementById('assignmentForm');
  return '<div class="assignment-summary">' + assignmentWorkAreas.map(function(area) {
    var selectedId = form && form.elements[area.key] ? form.elements[area.key].value : '';
    var member = selectedId ? teamMemberById(selectedId) : null;
    var saved = rows.find(function(item) { return item.role === area.role; });
    var name = member ? (member.fullName || member.email || member.userId || member.id) : (saved && (saved.fullName || saved.email || saved.userId)) || 'Not assigned';
    return '<div class="assignment-summary-row"><strong>' + esc(area.title) + '</strong><span aria-hidden="true">&rarr;</span><span>' + esc(name) + '</span></div>';
  }).join('') + '</div>';
}
function setAssignmentStatus(message, type) {
  var status = document.getElementById('assignmentStatus');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'row-meta assignment-status ' + (type || '');
}
function refreshAssignmentSummary() {
  var summary = document.getElementById('assignmentSummary');
  if (summary) summary.innerHTML = renderAssignmentSummary(window.assignmentProjectId);
}
function selectAssignmentTarget(targetKey) {
  var area = assignmentWorkAreaByKey(targetKey || 'projectManager');
  window.assignmentTargetArea = area.key;
  document.querySelectorAll('[data-work-row]').forEach(function(row) { row.classList.toggle('active', row.dataset.workRow === area.key); });
  document.querySelectorAll('[data-assignment-target]').forEach(function(button) { button.textContent = button.dataset.assignmentTarget === area.key ? 'Active' : 'Assign'; });
  var select = document.querySelector('[data-assignment-select="' + area.key + '"]');
  if (select) select.focus();
  refreshAssignmentSummary();
  setAssignmentStatus('Assigning ' + area.title + '. Choose a member from the table or dropdown, then save.', 'info');
}
function selectAssignmentProject(projectId) {
  window.assignmentProjectId = projectId;
  window.assignmentTargetArea = 'projectManager';
  renderAssignmentPage();
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
  window.assignmentTargetArea = window.assignmentTargetArea || 'projectManager';
  var projectButtons = projects.map(function(project) {
    return '<button class="assignment-project ' + (project.projectId === selected.projectId ? 'active' : '') + '" type="button" data-assignment-project="' + esc(project.projectId) + '"><strong>' + esc(project.title || project.projectName || project.projectId || 'Project') + '</strong><div class="row-meta">' + esc(project.assignmentStatus || 'Ready for assignment') + '</div></button>';
  }).join('');
  var workRows = assignmentWorkAreas.map(function(area) {
    var active = window.assignmentTargetArea === area.key;
    return '<div class="assignment-work-row ' + (active ? 'active' : '') + '" data-work-row="' + esc(area.key) + '"><div class="assignment-work-title"><strong>' + esc(area.title) + '</strong><span class="row-meta">' + esc(area.hint) + '</span></div><div class="field assignment-control"><label class="sr-only" for="assignment-' + esc(area.key) + '">Assigned Team Member</label><select id="assignment-' + esc(area.key) + '" name="' + esc(area.key) + '" data-assignment-select="' + esc(area.key) + '">' + assignmentMemberOptions(area.role) + '</select></div><button class="btn ghost assignment-action" type="button" data-assignment-target="' + esc(area.key) + '">' + (active ? 'Active' : 'Assign') + '</button></div>';
  }).join('');
  mainPanel.innerHTML = '<div style="display:grid;gap:14px;"><header class="assignment-page-head"><h1>Project Assignment</h1><p>Assign the right team to the selected project before requirements are generated.</p></header><section class="panel assignment-panel"><div class="panel-head"><div><div class="assignment-heading"><span class="assignment-step">1</span><h2>Select Project</h2></div><p class="row-meta">Choose the project to assign work areas.</p></div></div><div class="assignment-projects">' + projectButtons + '</div></section><div class="assignment-layout"><section class="panel assignment-panel"><div class="panel-head"><div class="assignment-heading"><span class="assignment-step">2</span><h2>Assign Project Team</h2></div></div><form id="assignmentForm" class="form-panel" style="max-width:none;"><div class="assignment-work-rows">' + workRows + '</div></form><p id="assignmentStatus" class="row-meta assignment-status">Click Assign on a role, select a member, then save.</p></section><section class="panel assignment-panel"><div class="panel-head"><div class="assignment-heading"><span class="assignment-step">3</span><h2>Available Team Members</h2></div><span class="row-meta">' + availableTeamMembers().length + ' active</span></div>' + assignmentFilters() + '<div id="assignmentTeamTable">' + renderAvailableTeamMembers() + '</div></section></div><section class="panel assignment-panel"><div class="panel-head"><div class="assignment-heading"><span class="assignment-step">4</span><h2>Assignment Summary</h2></div><button class="btn assignment-action" type="button" data-assignment-save>Save</button></div><div id="assignmentSummary">' + renderAssignmentSummary(selected.projectId) + '</div></section></div>';
  setAssignmentFormValues(selected.projectId);
  bindAssignmentPage();
}
async function loadAssignmentPage() {
  mainPanel.innerHTML = '<section class="panel assignment-panel"><div class="empty">Loading all active team members...</div></section>';
  try {
    var response = await fetch('/api/project-portal/admin/team-members', { headers:headers() });
    var payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load team members.');
    dashboard.teamMembers = Array.isArray(payload.items) ? payload.items : [];
    if (activePanel === 'assignments') renderAssignmentPage();
  } catch (error) {
    if (activePanel !== 'assignments') return;
    mainPanel.innerHTML = '<section class="panel assignment-panel"><div class="empty">' + esc(error.message) + '</div></section>';
  }
}
function assignmentFilters() {
  return '<div class="assignment-filter-row"><div class="field"><label>Role</label><select id="assignmentRoleFilter"><option value="">All Roles</option>' + assignmentWorkAreas.map(function(area) { return option(area.role, area.role); }).join('') + '</select></div><div class="field"><label>Skill Search</label><input id="assignmentSkillFilter" placeholder="React, testing"></div><label class="assignment-toggle"><input id="assignmentAvailableFilter" type="checkbox"> Available only</label><label class="assignment-toggle"><input id="assignmentWorkloadFilter" type="checkbox"> Workload &lt; 70%</label></div>';
}
function availableTeamMembers() {
  var roleFilter = document.getElementById('assignmentRoleFilter');
  var skillFilter = document.getElementById('assignmentSkillFilter');
  var availableFilter = document.getElementById('assignmentAvailableFilter');
  var workloadFilter = document.getElementById('assignmentWorkloadFilter');
  var role = roleFilter ? roleFilter.value : '';
  var skill = String(skillFilter ? skillFilter.value : '').trim().toLowerCase();
  var availableOnly = Boolean(availableFilter && availableFilter.checked);
  var workloadOnly = Boolean(workloadFilter && workloadFilter.checked);
  return activeTeamMembers().filter(function(member) {
    var memberRole = String(member.role || member.teamRole || '');
    var availability = String(member.availability || 'Available');
    var workload = Number(member.workloadPercent || 0);
    var skills = (Array.isArray(member.skills) ? member.skills : []).join(' ') + ' ' + [member.fieldOfStudy, member.major, member.department].join(' ');
    if (role && !memberRole.toLowerCase().includes(role.toLowerCase())) return false;
    if (skill && !skills.toLowerCase().includes(skill)) return false;
    if (availableOnly && !/available/i.test(availability)) return false;
    if (workloadOnly && workload >= 70) return false;
    return true;
  });
}
function renderAvailableTeamMembers() {
  var members = availableTeamMembers();
  if (!members.length) return '<div class="empty">No team members match the current filters.</div>';
  return '<div class="team-table-wrap"><table class="team-table"><thead><tr><th>Profile Photo</th><th>Name</th><th>Role</th><th>Skills</th><th>Workload</th><th>Status</th><th>Action</th></tr></thead><tbody>' + members.map(function(member) {
    var id = member.userId || member.id || member.clientId;
    var photo = member.profilePhoto || member.photo || '/images/default.png';
    var skills = (Array.isArray(member.skills) && member.skills.length ? member.skills : [member.fieldOfStudy || member.major || '']).filter(Boolean).slice(0, 3).join(', ');
    var workload = Number(member.workloadPercent || 0);
    return '<tr><td><img class="team-member-photo" src="' + esc(photo) + '" alt="' + esc(member.fullName || member.email || '') + '"></td><td><strong>' + esc(member.fullName || member.name || member.email || 'Team Member') + '</strong></td><td>' + esc(member.role || member.teamRole || 'Team Member') + '</td><td>' + esc(skills || 'Not listed') + '</td><td>' + esc(workload) + '%<div class="progress-track"><div class="progress-bar" style="width:' + workload + '%"></div></div></td><td><span class="availability ' + esc(member.availability || 'Available') + '">' + esc(member.availability || 'Available') + '</span></td><td><button class="btn ghost" type="button" data-select-member="' + esc(id) + '">Select</button></td></tr>';
  }).join('') + '</tbody></table></div>';
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
    frontendDeveloper: assignmentValues(projectId, 'Frontend Developer').slice(0, 1),
    backendEngineer: assignmentValues(projectId, 'Backend Engineer').slice(0, 1),
    mobileDeveloper: assignmentValues(projectId, 'Mobile Developer').slice(0, 1),
    qaEngineer: assignmentValues(projectId, 'QA Engineer').slice(0, 1),
    devopsEngineer: assignmentValues(projectId, 'DevOps Engineer').slice(0, 1)
  };
  Object.keys(map).forEach(function(name) {
    var select = form.elements[name];
    if (select) setSelectValues(select, map[name]);
  });
}
async function saveAssignmentForm() {
  var form = document.getElementById('assignmentForm');
  if (!form) throw new Error('Assignment form is not available.');
  var projectId = window.assignmentProjectId;
  if (!projectId) throw new Error('Select a project first.');
  var data = formToObject(form);
  setAssignmentStatus('Saving assignment...', 'info');
  var response = await fetch('/api/project-portal/admin/projects/' + encodeURIComponent(projectId) + '/assignments', {
    method:'POST',
    headers:headers({'Content-Type':'application/json'}),
    body:JSON.stringify(data)
  });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not save assignments.');
  await loadAdminDataOnly();
  window.assignmentProjectId = projectId;
  renderAssignmentPage();
  setAssignmentStatus('Assignment saved and requirements updated.', 'success');
  return payload;
}
function bindAssignmentPage() {
  var teamTable = document.getElementById('assignmentTeamTable');
  if (teamTable) teamTable.addEventListener('click', function(event) {
      var button = event.target.closest('[data-select-member]');
      if (!button) return;
      event.preventDefault();
      var target = assignmentWorkAreaByKey(window.assignmentTargetArea || 'projectManager');
      var select = document.querySelector('[data-assignment-select="' + target.key + '"]');
      if (select) select.value = button.dataset.selectMember;
      var member = teamMemberById(button.dataset.selectMember);
      refreshAssignmentSummary();
      setAssignmentStatus(((member && (member.fullName || member.name || member.email)) || 'Team member') + ' selected for ' + target.title + '. Click Save to persist.', 'info');
  });
  ['assignmentRoleFilter','assignmentAvailableFilter','assignmentWorkloadFilter'].forEach(function(id) {
    var input = document.getElementById(id);
    if (input) input.addEventListener('change', function() {
      document.getElementById('assignmentTeamTable').innerHTML = renderAvailableTeamMembers();
    });
  });
  var skillFilter = document.getElementById('assignmentSkillFilter');
  if (skillFilter) skillFilter.addEventListener('input', function() {
    document.getElementById('assignmentTeamTable').innerHTML = renderAvailableTeamMembers();
  });
  document.querySelectorAll('[data-assignment-select]').forEach(function(select) {
    select.addEventListener('change', function() {
      refreshAssignmentSummary();
      setAssignmentStatus('Selection updated. Click Save to persist.', 'info');
    });
  });
  var form = document.getElementById('assignmentForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    try {
      await saveAssignmentForm();
    } catch (error) {
      setAssignmentStatus(error.message, 'error');
      alert(error.message);
    }
  });
}
function selectedGitHubProject() {
  var projects = dashboard.projects || [];
  githubState.projectId = githubState.projectId || (projects[0] && projects[0].projectId) || '';
  return projects.find(function(project) { return project.projectId === githubState.projectId; }) || projects[0] || null;
}
function renderGitHubActivityPage() {
  var project = selectedGitHubProject();
  if (!project) {
    mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><h2>GitHub Activity</h2></div><div class="empty">Create a project before configuring GitHub repositories.</div></section>';
    return;
  }
  githubState.projectId = project.projectId;
  mainPanel.innerHTML = '<div style="display:grid;gap:20px;"><section class="panel"><div class="panel-head"><div><h2>Project Selection</h2><p class="row-meta">Select Project is required before GitHub can be configured.</p></div></div><div class="field" style="max-width:520px;"><label>Select Project</label><select id="githubProjectSelect">' + (dashboard.projects || []).map(function(item) { return '<option value="' + esc(item.projectId) + '" ' + (item.projectId === githubState.projectId ? 'selected' : '') + '>' + esc(item.title || item.projectName || item.projectId) + '</option>'; }).join('') + '</select></div></section><section class="panel" id="githubConnectionPanel"><div class="empty">Loading GitHub connection...</div></section><section class="panel" id="githubRepositoryConfig"><div class="empty">Connect GitHub before selecting a repository.</div></section><section class="panel" id="githubConnectedRepositories"><div class="empty">No repository selected.</div></section><section class="panel" id="githubActivityPanel"><div class="empty">Repository activity appears after a project repository is configured and synced.</div></section></div>';
  bindGitHubProjectSelect();
  loadGitHubPageData();
}
function bindGitHubProjectSelect() {
  var select = document.getElementById('githubProjectSelect');
  if (!select) return;
  select.addEventListener('change', function() {
    githubState.projectId = select.value;
    githubState.selectedRepository = '';
    githubState.selectedBranch = '';
    renderGitHubActivityPage();
  });
}
async function fetchPortalJson(path, options) {
  var response = await fetch(path, Object.assign({ headers:headers({'Content-Type':'application/json'}) }, options || {}));
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Request failed.');
  return payload;
}
async function loadGitHubPageData() {
  try {
    var connectionPayload = await fetchPortalJson('/api/project-portal/admin/github/connection');
    githubState.connection = connectionPayload.connection || { connected:false };
    var mappingsPayload = await fetchPortalJson('/api/project-portal/admin/projects/' + encodeURIComponent(githubState.projectId) + '/repositories');
    githubState.mappings = mappingsPayload.repositories || [];
    githubState.activity = mappingsPayload.activity || [];
    renderGitHubConnection();
    renderGitHubRepositoryConfig();
    renderConnectedRepositories();
    renderProjectGitHubActivity();
  } catch (error) {
    document.getElementById('githubConnectionPanel').innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
  }
}
function renderGitHubConnection() {
  var connection = githubState.connection || {};
  var status = connection.connected ? 'Connected' : 'Not Connected';
  var body = '<div class="panel-head"><div><h2>GitHub Connection</h2><p class="row-meta">Status: ' + esc(status) + '</p></div><button class="btn" id="connectGithubBtn" type="button">Connect GitHub</button></div>';
  if (connection.connected) {
    body += '<div class="info-table"><div class="info-row"><span>Connected as</span><span>' + esc(connection.githubUsername || 'GitHub user') + '</span></div><div class="info-row"><span>Status</span><span>Connected</span></div><div class="info-row"><span>Connection Date</span><span>' + fmtDate(connection.connectionDate) + '</span></div></div>';
  } else {
    body += '<div class="empty">GitHub Status: Not Connected</div>';
  }
  document.getElementById('githubConnectionPanel').innerHTML = body;
  document.getElementById('connectGithubBtn').onclick = connectGitHub;
}
async function connectGitHub() {
  try {
    var payload = await fetchPortalJson('/api/project-portal/admin/github/connect-url?projectId=' + encodeURIComponent(githubState.projectId));
    window.location.href = payload.url;
  } catch (error) {
    alert(error.message);
  }
}
function renderGitHubRepositoryConfig() {
  var host = document.getElementById('githubRepositoryConfig');
  if (!githubState.connection || !githubState.connection.connected) {
    host.innerHTML = '<div class="panel-head"><h2>Repository Configuration</h2></div><div class="empty">Connect GitHub before selecting repositories.</div>';
    return;
  }
  host.innerHTML = '<div class="panel-head"><div><h2>Repository Configuration</h2><p class="row-meta">Project -> Repository -> Branch -> Folder -> Tracking</p></div></div><form id="githubRepositoryForm" class="form-panel" style="max-width:none;"><input type="hidden" name="mappingId" id="githubMappingId"><div class="grid"><div class="field"><label>Repository</label><select name="repository" id="githubRepositorySelect"><option value="">Select Repository</option></select></div><div class="field"><label>Branch</label><select name="branch" id="githubBranchSelect"><option value="">Select Branch</option></select></div><div class="field"><label>Folder Type</label><select name="folderType" id="githubFolderTypeSelect">' + ['Whole Repository','Backend','Frontend','Mobile App','Android','iOS','Documentation','Other'].map(function(type) { return option(type, type); }).join('') + '</select></div><div class="field"><label>Repository Folder</label><select name="folder" id="githubFolderSelect"><option value="/">/ (whole repository)</option><option value="/web">/web</option><option value="/lib">/lib</option><option value="/backend">/backend</option><option value="/frontend">/frontend</option><option value="/android">/android</option><option value="/ios">/ios</option><option value="/docs">/docs</option></select></div><div class="field"><label>Other Folder</label><input id="githubOtherFolder" placeholder="/packages/api"></div></div><button class="btn" type="submit">Save Repository Mapping</button></form>';
  bindGitHubRepositoryForm();
  loadGitHubRepositories();
}
async function loadGitHubRepositories() {
  var select = document.getElementById('githubRepositorySelect');
  if (!select) return;
  select.innerHTML = '<option value="">Loading repositories...</option>';
  try {
    var payload = await fetchPortalJson('/api/project-portal/admin/github/repositories');
    githubState.repositories = payload.repositories || [];
    select.innerHTML = '<option value="">Select Repository</option>' + githubState.repositories.map(function(repo) { return '<option value="' + esc(repo.fullName) + '">' + esc(repo.fullName) + '</option>'; }).join('');
    if (githubState.selectedRepository) {
      select.value = githubState.selectedRepository;
      loadGitHubBranches();
    }
  } catch (error) {
    select.innerHTML = '<option value="">' + esc(error.message) + '</option>';
  }
}
async function loadGitHubBranches() {
  var repoSelect = document.getElementById('githubRepositorySelect');
  var repo = repoSelect ? repoSelect.value : '';
  var select = document.getElementById('githubBranchSelect');
  if (!select || !repo) return;
  githubState.selectedRepository = repo;
  select.innerHTML = '<option value="">Loading branches...</option>';
  try {
    var payload = await fetchPortalJson('/api/project-portal/admin/github/branches?repository=' + encodeURIComponent(repo));
    githubState.branches = payload.branches || [];
    select.innerHTML = '<option value="">Select Branch</option>' + githubState.branches.map(function(branch) { return option(branch.name, branch.name); }).join('');
    if (githubState.selectedBranch) {
      select.value = githubState.selectedBranch;
      loadGitHubFolders();
    }
  } catch (error) {
    select.innerHTML = '<option value="">' + esc(error.message) + '</option>';
  }
}
async function loadGitHubFolders() {
  var repoSelect = document.getElementById('githubRepositorySelect');
  var branchSelect = document.getElementById('githubBranchSelect');
  var repo = repoSelect ? repoSelect.value : '';
  var branch = branchSelect ? branchSelect.value : '';
  var select = document.getElementById('githubFolderSelect');
  if (!select || !repo || !branch) return;
  githubState.selectedBranch = branch;
  var defaults = ['/','/web','/lib','/backend','/frontend','/android','/ios','/docs'];
  select.innerHTML = '<option value="">Loading folders...</option>';
  try {
    var payload = await fetchPortalJson('/api/project-portal/admin/github/folders?repository=' + encodeURIComponent(repo) + '&branch=' + encodeURIComponent(branch));
    githubState.folders = payload.folders || [];
    var values = Array.from(new Set(defaults.concat(githubState.folders.map(function(folder) { return folder.path; }))));
    select.innerHTML = '<option value="">Select Folder</option>' + values.map(function(path) { return option(path, path); }).join('');
  } catch (error) {
    select.innerHTML = '<option value="">Select Folder</option>' + defaults.map(function(path) { return option(path, path); }).join('');
  }
}
function bindGitHubRepositoryForm() {
  document.getElementById('githubRepositorySelect').addEventListener('change', function() {
    githubState.selectedRepository = this.value;
    githubState.selectedBranch = '';
    loadGitHubBranches();
  });
  document.getElementById('githubBranchSelect').addEventListener('change', loadGitHubFolders);
  document.getElementById('githubRepositoryForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    var data = formToObject(event.target);
    var otherFolder = document.getElementById('githubOtherFolder').value.trim();
    if (otherFolder) data.folder = otherFolder;
    try {
      await fetchPortalJson('/api/project-portal/admin/projects/' + encodeURIComponent(githubState.projectId) + '/repositories', {
        method:'POST',
        body:JSON.stringify(data)
      });
      githubState.selectedRepository = '';
      githubState.selectedBranch = '';
      event.target.reset();
      await loadGitHubPageData();
    } catch (error) {
      alert(error.message);
    }
  });
}
function renderConnectedRepositories() {
  var host = document.getElementById('githubConnectedRepositories');
  var rows = githubState.mappings || [];
  var body = '<div class="panel-head"><h2>Connected Repositories</h2></div>';
  if (!rows.length) {
    host.innerHTML = body + '<div class="empty">No repositories connected to this project yet.</div>';
    return;
  }
  host.innerHTML = body + '<div class="team-table-wrap"><table class="team-table"><thead><tr><th>Repository</th><th>Branch</th><th>Folder</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows.map(function(row) {
    var id = row.mappingId || row.id;
    var status = row.lastSyncStatus || row.status || 'Connected';
    return '<tr><td><strong>' + esc(row.repository) + '</strong><div class="row-meta">' + esc(row.folderType || '') + '</div></td><td>' + esc(row.branch) + '</td><td>' + esc(row.folder) + '</td><td><span class="status-pill ' + statusClass(status) + '">' + esc(status) + '</span><div class="row-meta">' + esc(row.lastSyncError || (row.lastCommitRetrievedAt ? 'Last commit: ' + fmtDate(row.lastCommitRetrievedAt) : '')) + '</div></td><td style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn ghost" type="button" data-github-sync="' + esc(id) + '">Sync</button><button class="btn ghost" type="button" data-github-edit="' + esc(id) + '">Edit</button><button class="btn danger" type="button" data-github-remove="' + esc(id) + '">Remove</button></td></tr>';
  }).join('') + '</tbody></table></div>';
  bindConnectedRepositoryActions();
}
function bindConnectedRepositoryActions() {
  document.querySelectorAll('[data-github-sync]').forEach(function(button) {
    button.onclick = async function() {
      try {
        button.textContent = 'Syncing...';
        await fetchPortalJson('/api/project-portal/admin/repositories/' + encodeURIComponent(button.dataset.githubSync) + '/sync', { method:'POST', body:'{}' });
        await loadGitHubPageData();
      } catch (error) {
        alert(error.message);
      }
    };
  });
  document.querySelectorAll('[data-github-edit]').forEach(function(button) {
    button.onclick = function() {
      var mapping = githubState.mappings.find(function(item) { return (item.mappingId || item.id) === button.dataset.githubEdit; });
      if (!mapping) return;
      document.getElementById('githubMappingId').value = mapping.mappingId || mapping.id || '';
      githubState.selectedRepository = mapping.repository;
      githubState.selectedBranch = mapping.branch;
      document.getElementById('githubFolderTypeSelect').value = mapping.folderType || 'Backend';
      document.getElementById('githubOtherFolder').value = mapping.folder || '';
      loadGitHubRepositories();
    };
  });
  document.querySelectorAll('[data-github-remove]').forEach(function(button) {
    button.onclick = async function() {
      if (!confirm('Remove this repository mapping?')) return;
      try {
        await fetchPortalJson('/api/project-portal/admin/repositories/' + encodeURIComponent(button.dataset.githubRemove), { method:'DELETE' });
        await loadGitHubPageData();
      } catch (error) {
        alert(error.message);
      }
    };
  });
}
function renderProjectGitHubActivity() {
  var host = document.getElementById('githubActivityPanel');
  if (!githubState.mappings.length) {
    host.innerHTML = '<div class="panel-head"><h2>GitHub Activity</h2></div><div class="empty">Configure a project repository before activity is shown.</div>';
    return;
  }
  if (!githubState.activity.length) {
    host.innerHTML = '<div class="panel-head"><h2>GitHub Activity</h2></div><div class="empty">Repositories are connected. Click Sync to fetch commits, pull requests, contributors, builds, tests, and code quality records for this project.</div>';
    return;
  }
  host.innerHTML = '<div class="panel-head"><h2>GitHub Activity</h2></div><div class="records">' + githubState.activity.map(function(activity) {
    var metrics = activity.metrics || {};
    return '<article class="record"><div class="record-head"><div class="record-title">' + esc(activity.repository) + '</div><span class="status-pill ' + statusClass(activity.status || 'Synced') + '">' + esc(activity.status || activity.branch || 'Branch') + '</span></div><div class="record-meta">Branch: ' + esc(activity.branch || '') + ' | Folder: ' + esc(activity.folder || '/') + ' | Last synced: ' + fmtDate(activity.syncedAt) + '</div>' + githubDiagnosticsPanel(activity) + '<div class="metrics" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:12px;">' + [['CM','Commits',metrics.commitsRetrieved || (activity.commits || []).length],['PR','Pull Requests',metrics.pullRequestsRetrieved || (activity.pullRequests || []).length],['CN','Contributors',metrics.contributorsRetrieved || (activity.contributors || []).length],['UM','Unmapped',metrics.unmappedContributors || 0]].map(function(card) { return '<article class="metric-card" style="min-height:92px;box-shadow:none;"><div class="metric-icon">' + card[0] + '</div><div><small>' + esc(card[1]) + '</small><strong>' + esc(card[2]) + '</strong></div></article>'; }).join('') + '</div><div class="dashboard-grid" style="margin-top:12px;"><section><h3>Recent Commits</h3>' + simpleGithubList(activity.commits, 'No commits synced.', function(item) { return esc((item.message || '').split('\\n')[0]) + '<div class="row-meta">' + esc(item.mappedDeveloper || item.author || item.authorUsername || '') + ' | ' + fmtDate(item.date) + '<br>Files: ' + esc(item.filesChanged || 0) + ' | +' + esc(item.linesAdded || 0) + ' / -' + esc(item.linesRemoved || 0) + '</div>'; }) + '</section><section><h3>Recent Pull Requests</h3>' + simpleGithubList(activity.pullRequests, 'No pull requests synced.', function(item) { return esc('#' + item.number + ' ' + item.title) + '<div class="row-meta">' + esc(item.state || '') + ' | ' + esc(item.author || '') + '</div>'; }) + '</section><section><h3>Developer Activity</h3>' + simpleGithubList(activity.developerActivity, 'No developer activity mapped.', function(item) { return esc(item.developer || item.githubUsername || 'Contributor') + '<div class="row-meta">Commits: ' + esc(item.commits || 0) + ' | PRs: ' + esc(item.pullRequests || 0) + ' | ' + (item.mapped ? 'Mapped' : 'Unmapped') + '</div>'; }) + '</section><section><h3>Recent Contributors</h3>' + simpleGithubList(activity.contributors, 'No contributors synced.', function(item) { return esc(item.mappedDeveloper || item.username || '') + '<div class="row-meta">' + esc(item.contributions || 0) + ' contributions' + (item.mappedUserId ? '' : ' | unmapped') + '</div>'; }) + '</section></div></article>';
  }).join('') + '</div>';
}
function githubDiagnosticsPanel(activity) {
  var diagnostics = activity.diagnostics || {};
  var checks = diagnostics.apiChecks || [];
  var errors = diagnostics.errors || [];
  return '<div class="info-table" style="margin-top:12px;"><div class="info-row"><span>Repository Status</span><span>' + esc(diagnostics.repositoryStatus || activity.status || 'Unknown') + '</span></div><div class="info-row"><span>GitHub API Status</span><span>' + esc(diagnostics.githubApiStatus || (errors.length ? 'Error' : 'OK')) + '</span></div><div class="info-row"><span>Repository Being Tracked</span><span>' + esc(diagnostics.repository || activity.repository || '') + '</span></div><div class="info-row"><span>Branch Being Tracked</span><span>' + esc(diagnostics.branchBeingTracked || activity.branch || '') + '</span></div><div class="info-row"><span>Last Commit Retrieved</span><span>' + fmtDate(diagnostics.lastCommitRetrieved || '') + '</span></div><div class="info-row"><span>API Checks</span><span>' + esc(checks.map(function(check) { return check.label + ': ' + check.status + (check.message ? ' (' + check.message + ')' : ''); }).join(' | ') || 'No checks recorded') + '</span></div><div class="info-row"><span>Unmapped Contributors</span><span>' + esc((diagnostics.unmappedContributors || []).join(', ') || 'None') + '</span></div></div>';
}
function simpleGithubList(items, empty, formatter) {
  items = items || [];
  if (!items.length) return '<div class="empty">' + esc(empty) + '</div>';
  return '<div class="records">' + items.slice(0, 5).map(function(item) { return '<article class="record" style="box-shadow:none;"><div class="record-meta">' + formatter(item) + '</div></article>'; }).join('') + '</div>';
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
  mainPanel.innerHTML = '<div style="display:grid;gap:20px;">' + engineeringOverviewWidget('') + '<div class="dashboard-grid"><div style="display:grid;gap:20px;"><section class="panel"><div class="panel-head"><h2>Recent Project Requests</h2><button class="btn ghost" data-open="requests">View all</button></div>' + recordList((dashboard.requests || []).slice(0,5), 'No requests yet.', function(item) { var req = item.requirements || {}; return record(item.requestId || 'Request', item.status, esc((item.contact && item.contact.fullName) || 'Client') + ' - ' + esc(req.projectType || req.websiteType || 'Project')); }) + '</section><section class="panel"><div class="panel-head"><h2>Recent Clients</h2><button class="btn ghost" data-open="clients">View clients</button></div>' + recordList((dashboard.clients || []).slice(0,5), 'No clients yet.', function(item) { return record(item.fullName || item.email, item.userType || 'Client', esc(item.companyName || '') + '<br>' + esc(item.email || '')); }) + '</section></div><div style="display:grid;gap:20px;"><section class="panel"><h2 style="margin-bottom:18px;">Monthly Leads</h2>' + recordList(monthly, 'No analytics yet.', function(item) { return record(item.month, item.count + ' leads', 'Captured project inquiries'); }) + '</section><section class="panel"><h2 style="margin-bottom:18px;">Operations Summary</h2><div class="info-table"><div class="info-row"><span>Completed Projects</span><span>' + esc((dashboard.metrics || {}).completedProjects || 0) + '</span></div><div class="info-row"><span>Monthly Leads</span><span>' + esc((dashboard.metrics || {}).monthlyLeads || 0) + '</span></div><div class="info-row"><span>Revenue</span><span>' + money((dashboard.metrics || {}).revenueGenerated || 0) + '</span></div></div></section></div></div></div>';
}
function requirementCategories() { return ['All Requirements','Functional','Frontend/UI','Backend/API','Database','Infrastructure','Security','Integrations']; }
function requirementCategoryKey(value) { return String(value || '').split('/').map(function(part) { return part.trim(); }).join('/').toLowerCase(); }
function requirementStatuses() { return ['Submitted','Approved','Assigned','In Development','Testing','Client Review','Completed','Rejected']; }
function requirementPriorityClass(priority) {
  priority = String(priority || '').toLowerCase();
  if (priority === 'critical') return 'red';
  if (priority === 'high') return 'orange';
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
  if (requirementState.category && requirementState.category !== 'All Requirements') items = items.filter(function(item) { return requirementCategoryKey(item.category) === requirementCategoryKey(requirementState.category); });
  if (requirementState.status) items = items.filter(function(item) { return item.status === requirementState.status; });
  if (requirementState.priority) items = items.filter(function(item) { return item.priority === requirementState.priority; });
  if (requirementState.assignee) items = items.filter(function(item) {
    return [item.assignedUserId, item.memberId, item.assignedDeveloper, item.assignedRole, requirementOwners(item)].join(' ').toLowerCase().includes(String(requirementState.assignee).toLowerCase());
  });
  var needle = String(requirementState.search || '').trim().toLowerCase();
  if (needle) items = items.filter(function(item) {
    return [item.requirementId, item.requirementName, item.requirementTitle, item.requirementDescription, item.category, item.assignedDeveloper, item.assignedRole].join(' ').toLowerCase().includes(needle);
  });
  return items.sort(function(a, b) { return String(a.requirementId || '').localeCompare(String(b.requirementId || '')); });
}
function selectedRequirement() {
  var items = requirementItems();
  var selected = items.find(function(item) { return (item.requirementId || item.id) === requirementState.selectedId; });
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
  var logo = project.logoUrl || project.clientLogoUrl || project.projectLogoUrl || '/images/logoYenkasaSoftOTechEmblem-512.jpeg';
  var client = project.clientName || project.companyName || project.clientEmail || 'Not assigned';
  var title = project.title || project.projectName || 'Project Requirements';
  var projectId = project.projectId || 'Not created';
  var type = project.projectType || project.type || project.category || 'Project';
  return '<section class="panel req-header"><img class="req-project-logo" src="' + esc(logo) + '" alt="' + esc(title) + ' logo"><div><div class="req-header-title-row"><h1 class="req-header-title">' + esc(title) + '</h1><span class="status-pill ' + statusClass(project.status) + '">' + esc(project.status || 'Planning') + '</span></div><div class="req-header-grid"><div class="req-header-stat"><span>Client</span><strong>' + esc(client) + '</strong></div><div class="req-header-stat"><span>Project ID</span><strong>' + esc(projectId) + '</strong></div><div class="req-header-stat"><span>Project Type</span><strong>' + esc(type) + '</strong></div><div class="req-header-stat"><span>Start Date</span><strong>' + fmtDate(project.startDate || project.createdAt) + '</strong></div><div class="req-header-stat"><span>Deadline</span><strong>' + fmtDate(project.deadline || project.endDate) + '</strong></div><div class="req-header-stat"><span>Progress</span><strong>' + esc(progress) + '%</strong></div></div></div><div class="req-progress-ring" style="--progress:' + Number(progress || 0) + '%"><span>' + esc(progress) + '%</span></div></section>';
}
function requirementMetricCards(stats) {
  var cards = [['RQ','Total Requirements',stats.total,'All generated and manual requirements','#7c3aed'],['OK','Completed',stats.completed,stats.total ? Math.round((stats.completed / stats.total) * 100) + '% of total' : '0% of total','#14b85a'],['IP','In Progress',stats.inProgress,'Assigned, development, testing, review','#1265ff'],['RV','Pending Review',stats.pendingReview,'Submitted or approved requirements','#f97316'],['CR','Change Requests',stats.changeRequests,'Pending approval','#ef4444']];
  return '<section class="req-metrics">' + cards.map(function(card) { return '<article class="metric-card req-kpi"><div class="metric-icon" style="background:' + card[4] + '">' + card[0] + '</div><div><small>' + esc(card[1]) + '</small><strong>' + esc(card[2]) + '</strong><span class="row-meta">' + esc(card[3]) + '</span></div></article>'; }).join('') + '</section>';
}
function requirementTabs() {
  return '<div class="req-tabs">' + requirementCategories().map(function(category) {
    var active = category === requirementState.category;
    return '<button class="req-chip ' + (active ? 'active' : '') + '" type="button" data-req-category="' + esc(category) + '">' + esc(category) + '</button>';
  }).join('') + '</div>';
}
function requirementAssigneeOptions() {
  var owners = new Map();
  (dashboard.requirements || []).forEach(function(item) {
    var owner = requirementOwners(item);
    if (owner && owner !== 'Pending assignment') owners.set(owner, owner);
  });
  (dashboard.teamMembers || []).forEach(function(member) {
    var name = member.fullName || member.name || member.email || member.userId || member.id;
    if (name) owners.set(name, name);
  });
  return '<option value="">All Assignees</option>' + Array.from(owners.keys()).sort().map(function(owner) {
    return '<option value="' + esc(owner) + '" ' + (owner === requirementState.assignee ? 'selected' : '') + '>' + esc(owner) + '</option>';
  }).join('');
}
function requirementFilters() {
  return '<div class="req-toolbar"><div class="field"><label>Search</label><input id="requirementSearch" name="requirementSearch" value="' + esc(requirementState.search) + '" placeholder="Search requirements..."></div><div class="field"><label>Category</label><select id="requirementCategoryFilter">' + requirementCategories().map(function(category) { return '<option value="' + esc(category) + '" ' + (category === requirementState.category ? 'selected' : '') + '>' + esc(category) + '</option>'; }).join('') + '</select></div><div class="field"><label>Status</label><select id="requirementStatusFilter"><option value="">All Status</option>' + requirementStatuses().map(function(status) { return '<option value="' + esc(status) + '" ' + (status === requirementState.status ? 'selected' : '') + '>' + esc(status) + '</option>'; }).join('') + '</select></div><div class="field"><label>Priority</label><select id="requirementPriorityFilter"><option value="">All Priorities</option>' + ['Critical','High','Medium','Low'].map(function(priority) { return '<option value="' + esc(priority) + '" ' + (priority === requirementState.priority ? 'selected' : '') + '>' + esc(priority) + '</option>'; }).join('') + '</select></div><div class="field"><label>Assignee</label><select id="requirementAssigneeFilter">' + requirementAssigneeOptions() + '</select></div><button class="btn ghost" type="button" data-req-filter>Filter</button></div>';
}
function requirementOwnerName(item) {
  return item.assignedDeveloper || item.memberName || item.assignedRole || requirementOwners(item) || 'Unassigned';
}
function requirementOwnerRole(item) {
  return item.assignedRole || item.role || item.assignedTeamRole || '';
}
function initials(value) {
  return String(value || 'NA').split(/\s+/).filter(Boolean).slice(0,2).map(function(part) { return part.charAt(0).toUpperCase(); }).join('') || 'NA';
}
function requirementOwnerCell(item) {
  var name = requirementOwnerName(item);
  var role = requirementOwnerRole(item);
  return '<div class="req-owner"><span class="req-owner-avatar">' + esc(initials(name)) + '</span><span class="req-owner-text"><strong>' + esc(name) + '</strong><span>' + esc(role || 'Team Member') + '</span></span></div>';
}
function requirementTable(items) {
  if (!items.length) return '<div class="empty">No requirements match the current filters.</div>';
  return '<div class="req-table-wrap"><table class="req-table"><thead><tr><th>ID</th><th>Requirement</th><th>Category</th><th>Priority</th><th>Assigned Team</th><th>Status</th><th>Due Date</th><th>Progress</th></tr></thead><tbody>' + items.map(function(item) {
    var id = item.requirementId || item.id || '';
    return '<tr class="' + (id === requirementState.selectedId ? 'active' : '') + '" data-req-select="' + esc(id) + '"><td><strong>' + esc(id) + '</strong></td><td><strong>' + esc(item.requirementName || item.requirementTitle || 'Requirement') + '</strong><div class="row-meta">' + esc(item.requirementDescription || item.description || '') + '</div></td><td><span class="status-pill green">' + esc(String(item.category || 'Functional').replace(' / ', '/')) + '</span></td><td><span class="status-pill ' + requirementPriorityClass(item.priority) + '">' + esc(item.priority || 'Medium') + '</span></td><td style="max-width:210px;">' + requirementOwnerCell(item) + '</td><td><span class="status-pill ' + statusClass(item.status) + '">' + requirementStatusIndicator(item.status) + esc(item.status || 'Submitted') + '</span></td><td>' + fmtDate(item.dueDate) + '</td><td style="min-width:108px;">' + esc(item.progress || 0) + '%<div class="progress-track"><div class="progress-bar" style="width:' + Number(item.progress || 0) + '%"></div></div></td></tr>';
  }).join('') + '</tbody></table></div><div class="req-table-footer"><span>Showing ' + esc(items.length) + ' requirements</span><span>Table view</span></div>';
}
function requirementKanban(items) {
  var columns = ['Submitted','Assigned','In Development','Testing','Client Review','Completed'];
  return '<div class="req-kanban">' + columns.map(function(status) {
    var rows = items.filter(function(item) { return item.status === status || (status === 'Submitted' && !item.status); });
    return '<section class="record req-kanban-col" data-req-drop-status="' + esc(status) + '"><div class="record-head"><div class="record-title">' + esc(status) + '</div><span class="status-pill">' + rows.length + '</span></div>' + (rows.length ? rows.map(function(item) { var id = item.requirementId || item.id || ''; return '<article class="record req-kanban-card" draggable="true" data-req-card="' + esc(id) + '" data-req-select="' + esc(id) + '"><strong>' + requirementStatusIndicator(item.status) + esc(item.requirementName || item.requirementTitle || id) + '</strong><span class="status-pill ' + requirementPriorityClass(item.priority) + '">' + esc(item.priority || 'Medium') + '</span><div class="row-meta">' + esc(item.category || '') + ' | ' + esc(requirementOwners(item)) + '</div><div class="row-meta">Due ' + fmtDate(item.dueDate) + ' | Progress ' + esc(item.progress || 0) + '%</div></article>'; }).join('') : '<div class="empty">No items.</div>') + '</section>';
  }).join('') + '</div>';
}
function requirementDetail(item) {
  if (!item) return '<aside class="panel"><div class="empty">Select a requirement to view details.</div></aside>';
  var id = item.requirementId || item.id || '';
  var comments = (item.comments || []).length;
  var attachments = (item.attachments || []).length;
  var statusOptions = requirementStatuses().map(function(status) {
    return '<option value="' + esc(status) + '" ' + (status === item.status ? 'selected' : '') + '>' + esc(status) + '</option>';
  }).join('');
  return '<aside class="panel req-detail"><div class="panel-head"><div><p class="row-meta" style="margin:0;">' + esc(id) + '</p><h2>' + esc(item.requirementName || item.requirementTitle || id) + '</h2></div><span class="status-pill ' + requirementPriorityClass(item.priority) + '">' + esc(item.priority || 'Medium') + '</span></div><div class="row-meta">' + requirementStatusIndicator(item.status) + esc(item.status || 'Submitted') + '</div><div class="req-detail-tabs"><span class="req-detail-tab active">Details</span><span class="req-detail-tab">Comments ' + esc(comments) + '</span><span class="req-detail-tab">Attachments ' + esc(attachments) + '</span><span class="req-detail-tab">History</span></div><div class="req-detail-section"><h3>Description</h3><p class="record-meta">' + esc(item.requirementDescription || item.description || 'No description provided.') + '</p></div><div class="info-table"><div class="info-row"><span>Category</span><span>' + esc(String(item.category || '').replace(' / ', '/')) + '</span></div><div class="info-row"><span>Priority</span><span><span class="status-pill ' + requirementPriorityClass(item.priority) + '">' + esc(item.priority || 'Medium') + '</span></span></div><div class="info-row"><span>Assigned To</span><span>' + esc(requirementOwnerName(item)) + '</span></div><div class="info-row"><span>Reporter</span><span>' + esc(item.reporter || item.reporterEmail || item.createdBy || 'Not recorded') + '</span></div><div class="info-row"><span>Est. Hours</span><span>' + esc(item.estimatedHours || 0) + ' Hours</span></div><div class="info-row"><span>Actual</span><span>' + esc(item.actualHours || 0) + ' Hours</span></div><div class="info-row"><span>Due Date</span><span>' + fmtDate(item.dueDate) + '</span></div><div class="info-row"><span>Dependencies</span><span>' + esc((item.dependencies || []).join(', ') || 'None') + '</span></div></div><div class="req-detail-section"><div class="record-head"><span class="row-meta">Progress</span><strong>' + esc(item.progress || 0) + '%</strong></div><div class="progress-track"><div class="progress-bar" style="width:' + Number(item.progress || 0) + '%"></div></div></div><form id="requirementQuickUpdateForm" class="form-panel req-detail-section"><input type="hidden" name="requirementId" value="' + esc(id) + '"><div class="field"><label>Status</label><select name="status">' + statusOptions + '</select></div><button class="btn ghost" type="submit">Save Status</button></form><div class="req-detail-section"><h3>Attachments</h3>' + recordList(item.attachments || [], 'No attachments yet.', function(file) { return record(file.originalName || 'Attachment', file.uploadedByRole || 'File', '<a style="color:var(--blue);font-weight:850;" href="' + esc(file.url) + '" target="_blank" rel="noopener">Open</a><br>' + esc(file.mimeType || '')); }) + '</div></aside>';
}
function renderRequirementsModule() {
  var items = requirementItems();
  var selected = selectedRequirement();
  if (selected) requirementState.selectedId = selected.requirementId || selected.id || '';
  var project = requirementProject();
  var stats = requirementStats(items);
  mainPanel.innerHTML = '<div class="req-page">' + projectHeader(project, stats) + requirementMetricCards(stats) + '<div class="req-layout"><section class="panel req-table-panel"><div class="panel-head" style="padding:14px 16px;"><h2>Requirements</h2><button class="btn" data-open="requirements-create" type="button">+ Add Requirement</button></div>' + requirementTabs() + requirementFilters() + requirementTable(items) + '</section>' + requirementDetail(selected) + '</div></div>';
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
  activePanel = name || 'dashboard';
  setAdminMetricsVisibility(activePanel);
  document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.panel === name); });
  if (!dashboard) return;
  if (name === 'dashboard') return renderOverview();
  if (name === 'clients') mainPanel.innerHTML = formShell('clientForm', 'Create or Update Client Login', field('Full Name', 'fullName') + field('Company', 'companyName') + field('Email', 'email', '', 'email') + field('Temporary Password', 'password', '', 'password') + field('Phone', 'phoneNumber') + selectField('Role', 'teamRole', (dashboard.roles || []).map(function(s){return option(s,s);}).join('')) + teamMemberSelect('Assigned Project Manager', 'assignedProjectManager', 'Project Manager') + selectField('Status', 'status', ['Active','Suspended','Closed'].map(function(s){return option(s,s);}).join('')) + area('Notes', 'notes', 'Client notes'), 'Save Client') + '<section class="panel"><div class="panel-head"><h2>Clients</h2><button class="btn ghost" data-open="clients">Refresh</button></div>' + recordList(dashboard.clients, 'No clients yet.', function(item) { return record(item.fullName || item.email, item.status || item.userType || 'Client', esc(item.companyName || '') + '<br>' + esc(item.email || '') + ' - ' + esc(item.phoneNumber || '') + '<br>Role: ' + esc(item.teamRole || item.userType || item.role || 'Client') + '<br>Login: ' + (item.hasLogin ? 'Enabled' : 'No password set'), '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn ghost" type="button" data-client-status="' + esc(item.id || item.clientId || '') + '" data-status="Active">Activate</button><button class="btn warn" type="button" data-client-status="' + esc(item.id || item.clientId || '') + '" data-status="Suspended">Suspend</button><button class="btn danger" type="button" data-client-status="' + esc(item.id || item.clientId || '') + '" data-status="Closed">Close</button></div>'); }) + '</section>';
  if (name === 'leads') mainPanel.innerHTML = formShell('leadForm', 'Create Lead', field('Full Name', 'fullName') + field('Company', 'companyName') + field('Email', 'email', '', 'email') + field('Phone', 'phone') + field('Requested Service', 'requestedService') + field('Estimated Budget', 'estimatedBudget') + field('Expected Timeline', 'expectedTimeline') + field('Lead Source', 'leadSource', 'Website') + selectField('Status', 'status', ['New','Contacted','Negotiation','Quotation Sent','Won','Lost'].map(function(s){return option(s,s);}).join('')) + area('Notes', 'notes', 'Lead notes'), 'Create Lead') + '<section class="panel"><div class="panel-head"><h2>Leads</h2><button class="btn ghost" data-open="leads">Refresh</button></div>' + recordList(dashboard.leads, 'No leads yet.', function(item) { return record(item.leadId || item.email || 'Lead', item.status, esc(item.fullName || '') + '<br>' + esc(item.companyName || '') + '<br>' + esc(item.email || '') + ' - ' + esc(item.requestedService || ''), '<div style="margin-top:12px;"><button class="btn ghost" type="button" data-lead-convert="' + esc(item.leadId || item.id || '') + '">Convert To Client</button></div>'); }) + '</section>';
  if (name === 'requests') mainPanel.innerHTML = formShell('approveRequestForm', 'Approve Request Into Project', selectField('Request', 'requestId', requestOptions()) + selectField('Client', 'clientEmail', clientOptions()) + field('Project Title', 'title') + teamMemberSelect('Project Manager', 'projectManagerId', 'Project Manager') + teamMemberMulti('Initial Developers', 'assignedDeveloperIds', '') + field('Deadline', 'deadline', '', 'date') + field('Amount', 'amount', '', 'number') + area('Description', 'description', 'Project scope and approval notes'), 'Approve & Create Project') + '<section class="panel"><div class="panel-head"><h2>Project Requests</h2><a class="btn ghost" href="/admin/project-requests">Detailed Request Admin</a></div>' + recordList(dashboard.requests, 'No project requests yet.', function(item) { return record(item.requestId || 'Request', item.status, requestCardBody(item)); }) + '</section>';
  if (name === 'projects') mainPanel.innerHTML = formShell('createProjectForm', 'Create Project', selectField('Client', 'clientEmail', clientOptions()) + field('Client Name', 'clientName') + selectField('From Request', 'requestId', requestOptions()) + field('Project Title', 'title') + teamMemberSelect('Project Manager', 'projectManagerId', 'Project Manager') + teamMemberMulti('Initial Developers', 'assignedDeveloperIds', '') + field('Deadline', 'deadline', '', 'date') + field('Estimated Amount', 'amount', '', 'number') + field('Progress %', 'progress', '0', 'number') + selectField('Status', 'status', ['Planning','In Progress','Client Review','Testing','Deployment','Completed','Suspended'].map(function(s){return option(s,s);}).join('')) + area('Description', 'description', 'Project details'), 'Create Project') + formShell('projectUpdateForm', 'Update Project Status', selectField('Project', 'projectId', projectOptions()) + selectField('Status', 'status', ['Planning','In Progress','Client Review','Testing','Deployment','Completed','Suspended'].map(function(s){return option(s,s);}).join('')) + field('Progress %', 'progress', '', 'number') + field('Deadline', 'deadline', '', 'date') + area('Update Notes / Description', 'description', 'Latest delivery update'), 'Update Project') + '<section class="panel"><div class="panel-head"><h2>Projects</h2></div>' + recordList(dashboard.projects, 'No projects yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Tabs: Overview | Requirements | Assignments | Tasks | Progress | Engineering | Files | Team<br>Manager: ' + esc(item.projectManager || 'Not assigned') + '<br>Progress: ' + esc(item.progress || item.progressPercentage || 0) + '%<br>Deadline: ' + fmtDate(item.deadline) + '<br>Team: ' + esc((item.assignedDevelopers || []).join(', ') || 'Not assigned'), '<div style="margin-top:12px;"><button class="btn ghost" type="button" data-project-engineering="' + esc(item.projectId || '') + '">Engineering</button></div>'); }) + '</section>';
  if (name === 'assignments') return loadAssignmentPage();
  if (name === 'requirements') return renderRequirementsModule();
  if (name === 'developer-profiles') mainPanel.innerHTML = '<section class="panel"><div class="panel-head"><div><h2>Developer Profiles</h2><p class="row-meta">Profiles are loaded from the Team Members table and portfolio team records.</p></div><a class="btn ghost" href="/portfolio-admin">Manage Profiles</a></div>' + renderTeamMemberCards() + '</section>';
  if (name === 'code-quality') return renderEngineeringDashboard('', 'code-quality');
  if (name === 'test-results') return renderEngineeringDashboard('', 'test-results');
  if (name === 'github-activity') return renderGitHubActivityPage();
  if (name === 'bug-analytics') return renderEngineeringDashboard('', 'bug-analytics');
  if (name === 'requirements-create') mainPanel.innerHTML = formShell('requirementForm', 'Add Requirement', selectField('Project', 'projectId', projectOptions()) + field('Requirement Name', 'requirementName') + selectField('Category', 'category', ['Functional','Frontend / UI','Backend / API','Database','Infrastructure','Security','Integrations'].map(function(s){return option(s,s);}).join('')) + selectField('Priority', 'priority', ['Critical','High','Medium','Low'].map(function(s){return option(s,s);}).join('')) + selectField('Status', 'status', ['Submitted','Approved','Assigned','In Development','Testing','Client Review','Completed','Rejected'].map(function(s){return option(s,s);}).join('')) + teamMemberSelect('Assigned To', 'assignedUserId', '') + selectField('Assigned Role', 'assignedRole', teamRoleOptions('Developer')) + field('Estimated Hours', 'estimatedHours', '', 'number') + field('Estimated Cost', 'estimatedCost', '', 'number') + field('Due Date', 'dueDate', '', 'date') + area('Requirement Description', 'requirementDescription', 'Requirement details') + area('Original Request Text', 'originalRequestText', 'Source text from client request or admin note'), 'Add Requirement') + '<section class="panel"><button class="btn ghost" data-open="requirements" type="button">Back to Requirements</button></section>';
  if (name === 'team') mainPanel.innerHTML = formShell('teamUpdateForm', 'Update Team Assignment', selectField('Project', 'projectId', projectOptions()) + teamMemberSelect('Project Manager', 'projectManagerId', 'Project Manager') + teamMemberMulti('Assigned Developers', 'assignedDeveloperIds', ''), 'Save Team Assignment') + '<section class="panel"><div class="panel-head"><h2>Team Assignments</h2></div>' + recordList(dashboard.projects, 'No team assignments yet.', function(item) { return record(item.projectId || item.title, item.status, esc(item.title || '') + '<br>Manager: ' + esc(item.projectManager || 'Not assigned') + '<br>Developers: ' + esc((item.assignedDevelopers || []).join(', ') || 'Not assigned') + '<br>Team: ' + esc((item.assignedTeam || []).join(', ') || 'Not assigned')); }) + '</section>';
  if (name === 'payments') mainPanel.innerHTML = formShell('paymentForm', 'Record Payment', selectField('Client', 'clientEmail', clientOptions()) + selectField('Project', 'projectId', projectOptions()) + field('Invoice Number', 'invoiceNumber') + field('Milestone Title', 'milestoneTitle') + field('Amount', 'amount', '', 'number') + selectField('Method', 'method', ['Paystack','MTN MoMo','Telecel Cash','AirtelTigo Money','Bank Transfer'].map(function(s){return option(s,s);}).join('')) + field('Transaction Reference', 'transactionReference') + '<div class="field"><label>Receipt File</label><input name="receipt" type="file" accept="image/*,application/pdf"></div>' + selectField('Status', 'status', ['Pending','Successful','Failed','Refunded'].map(function(s){return option(s,s);}).join('')), 'Record Payment') + '<section class="panel"><div class="panel-head"><h2>Payments</h2></div>' + recordList(dashboard.payments, 'No payments recorded yet.', function(item) { var receipt = item.receiptUrl ? '<br><a style="color:var(--blue);font-weight:850;" target="_blank" rel="noopener" href="' + esc(item.receiptUrl) + '">Open receipt</a>' : ''; return record(item.paymentId || 'Payment', item.status, money(item.amount) + '<br>' + esc(item.clientEmail || '') + '<br>' + esc(item.milestoneTitle || item.invoiceNumber || 'Payment') + receipt); }) + '</section>';
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
  bindForm('paymentForm', function(form) { return postMultipart('/api/project-portal/admin/payments', form); });
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
  var category = document.getElementById('requirementCategoryFilter');
  var status = document.getElementById('requirementStatusFilter');
  var priority = document.getElementById('requirementPriorityFilter');
  var assignee = document.getElementById('requirementAssigneeFilter');
  if (search) search.addEventListener('input', function() { requirementState.search = search.value; renderRequirementsModule(); });
  if (category) category.addEventListener('change', function() { requirementState.category = category.value; renderRequirementsModule(); });
  if (status) status.addEventListener('change', function() { requirementState.status = status.value; renderRequirementsModule(); });
  if (priority) priority.addEventListener('change', function() { requirementState.priority = priority.value; renderRequirementsModule(); });
  if (assignee) assignee.addEventListener('change', function() { requirementState.assignee = assignee.value; renderRequirementsModule(); });
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
  await loadAdminDataOnly();
  var params = new URLSearchParams(window.location.search);
  if (params.get('panel') === 'engineering') { setAdminMetricsVisibility('engineering'); return renderEngineeringDashboard(params.get('projectId') || '', 'project'); }
  renderPanel(params.get('panel') || 'dashboard');
}
async function loadAdminDataOnly() {
  errorBox.style.display = 'none';
  var response = await fetch('/api/project-portal/admin/dashboard', { headers:headers() });
  var payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load admin dashboard.');
  dashboard = payload.dashboard;
  document.getElementById('tokenPanel').style.display = 'none';
  renderMetrics();
  setAdminMetricsVisibility(activePanel);
  return dashboard;
}
document.getElementById('loadBtn').addEventListener('click', function() { loadAdmin().catch(function(error) { errorBox.textContent = error.message; errorBox.style.display = 'block'; }); });
document.querySelectorAll('.nav-item[data-panel]').forEach(function(btn) { btn.addEventListener('click', function() { renderPanel(btn.dataset.panel); }); });
document.body.addEventListener('click', function(event) {
  var assignmentProject = event.target.closest('[data-assignment-project]');
  if (assignmentProject) { event.preventDefault(); selectAssignmentProject(assignmentProject.dataset.assignmentProject); return; }
  var assignmentTarget = event.target.closest('[data-assignment-target]');
  if (assignmentTarget) { event.preventDefault(); selectAssignmentTarget(assignmentTarget.dataset.assignmentTarget); return; }
  var assignmentSave = event.target.closest('[data-assignment-save]');
  if (assignmentSave) {
    event.preventDefault();
    saveAssignmentForm().catch(function(error) {
      setAssignmentStatus(error.message, 'error');
      alert(error.message);
    });
    return;
  }
  var target = event.target.closest('[data-open]');
  if (target) { event.preventDefault(); renderPanel(target.dataset.open); return; }
  var projectEngineering = event.target.closest('[data-project-engineering]');
  if (projectEngineering) { event.preventDefault(); renderEngineeringDashboard(projectEngineering.dataset.projectEngineering || '', 'project'); return; }
  var reqCategory = event.target.closest('[data-req-category]');
  if (reqCategory) { event.preventDefault(); requirementState.category = reqCategory.dataset.reqCategory; renderRequirementsModule(); return; }
  var reqView = event.target.closest('[data-req-view]');
  if (reqView) { event.preventDefault(); requirementState.view = reqView.dataset.reqView; renderRequirementsModule(); return; }
  var reqFilter = event.target.closest('[data-req-filter]');
  if (reqFilter) { event.preventDefault(); renderRequirementsModule(); return; }
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
