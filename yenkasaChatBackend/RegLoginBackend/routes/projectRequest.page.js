const express = require('express');

const router = express.Router();

const PROJECT_CATEGORIES = [
  'Website Development',
  'Mobile App Development',
  'Desktop Application',
  'AI Solution',
  'E-Commerce Platform',
  'School Management System',
  'Hospital Management System',
  'Inventory System',
  'ERP System',
  'Social Media Platform',
  'Livestream Platform',
  'Fintech Solution',
  'Custom Software',
  'Other',
];
const PROJECT_TYPES = [
  'Website Development',
  'Mobile App Development',
  'Desktop Application',
  'AI Solution Development',
  'E-Commerce Platform',
  'School Management System',
  'Hospital Management System',
  'Inventory System',
  'ERP System',
  'Social Media Platform',
  'Livestream Platform',
  'Fintech Solution',
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
const PLATFORMS = ['Website', 'Android', 'iPhone (iOS)', 'Windows', 'macOS', 'Linux', 'Web Dashboard', 'Admin Portal', 'Backend API', 'Not Sure'];
const FEATURES = [
  'Login', 'Registration', 'Password Recovery', 'Social Login',
  'Chat', 'Group Chat', 'Voice Calls', 'Video Calls',
  'Posts', 'Comments', 'Likes', 'Shares', 'Notifications',
  'Payments', 'Wallet', 'Subscription Plans', 'Invoicing',
  'Product Listings', 'Shopping Cart', 'Order Tracking',
  'Image Upload', 'Video Upload', 'Livestreaming',
  'AI Chatbot', 'OCR', 'Recommendation System', 'AI Agent',
  'Dashboard', 'Analytics', 'User Management', 'Role Management',
  'Custom Feature',
];
const INTEGRATIONS = ['Paystack', 'Stripe', 'Flutterwave', 'MTN MoMo', 'Google Maps', 'Google Analytics', 'Firebase', 'OneSignal', 'Agora', 'Zoom', 'Microsoft 365', 'Google Workspace', 'WhatsApp API', 'SMS Gateway'];
const HOSTING_OPTIONS = ['Shared Hosting', 'VPS', 'Dedicated Server', 'Google Cloud', 'AWS', 'DigitalOcean'];
const SUPPORT_OPTIONS = ['Security Monitoring', 'Server Monitoring', 'Content Updates', 'Technical Support'];
const BUDGET_CURRENCIES = [
  { value: 'GHS', label: 'GHS - Ghana Cedis' },
  { value: 'USD', label: 'USD - US Dollars' },
];
const BUDGET_RANGES = {
  GHS: ['Under GHS 5,000', 'GHS 5,000 - GHS 10,000', 'GHS 10,000 - GHS 50,000', 'GHS 50,000 - GHS 100,000', 'GHS 100,000+'],
  USD: ['Under $500', '$500 - $1,000', '$1,000 - $5,000', '$5,000 - $10,000', '$10,000+'],
};
const INDUSTRIES = [
  'Information Technology (IT)',
  'Computer Software',
  'E-Commerce',
  'Financial Technology (FinTech)',
  'Education & EdTech',
  'Healthcare & HealthTech',
  'Beauty & Personal Care',
  'Hospitality & Tourism',
  'Transportation & Logistics',
  'Real Estate & Property Tech',
  'Agriculture & AgriTech',
  'Telecommunications',
  'Media & Entertainment',
  'Retail & Consumer Goods',
  'Manufacturing',
  'Construction & Engineering',
  'Professional Services',
  'Energy & Utilities',
  'Social Networking & Communities',
  'Marketplace Platforms',
];
const TARGET_USERS = [
  'General Public',
  'Students',
  'Teachers / Lecturers',
  'Parents / Guardians',
  'Patients',
  'Healthcare Professionals',
  'Customers / Shoppers',
  'Vendors / Sellers',
  'Business Owners',
  'Employees / Internal Staff',
  'Administrators / Managers',
  'Developers / Technical Users',
  'Drivers / Riders',
  'Property Buyers / Renters',
  'Farmers / Agribusinesses',
  'Community Members',
  'Content Creators',
  'Event Attendees',
  'Tourists / Guests',
  'Other',
];
const STATUSES = ['Submitted', 'Under Review', 'Quotation Pending', 'Quotation Sent', 'Approved', 'Rejected', 'Converted To Project', 'In Progress', 'Completed'];
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

function valueOptions(values) {
  return values.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
}

function choices(name, values) {
  return values.map((value) => `<label class="choice"><input type="checkbox" name="${name}" value="${value}"><span>${value}</span></label>`).join('');
}

function pageShell({ title, body, extraHead = '', nonce = '' }) {
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
      <a class="brand" href="/"><img class="mark" src="/images/logoYenkasaSoftOTechEmblem-512.jpeg" alt="Yenkasa Soft-O-Tech"><span>Yenkasa Soft-O-Tech</span></a>
      <div class="nav-actions">
        <a class="btn ghost" href="/">Portfolio</a>
        <a class="btn ghost" href="/software-solutions">Software Solutions</a>
        <a class="btn ghost" href="/services">Services</a>
        <a class="btn ghost" href="/client/login?returnTo=/website-request">Client Login</a>
        <a class="btn ghost" href="/client/dashboard">Client Dashboard</a>
        <a class="btn secondary" href="/admin">Admin</a>
        <a class="btn" href="/website-request">Request a Project</a>
      </div>
    </nav>
  </header>
  ${safeBody}
</body>
</html>`;
}

router.get('/website-request', (req, res) => {
  res.send(pageShell({
    nonce: res.locals.cspNonce,
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
      <a class="btn" id="registerLink" href="/client/register?returnTo=/website-request">Register</a>
      <a class="btn ghost" id="loginLink" href="/client/login?returnTo=/website-request">Login</a>
      <a class="btn secondary" href="/client/dashboard">Client Dashboard</a>
    </div>
  </section>

  <form id="requestForm" class="form hidden" enctype="multipart/form-data" novalidate>
    <section class="section"><h2>1. Client Information</h2><div class="grid">
      <div class="field"><label for="fullName">Full Name</label><input id="fullName" name="fullName" autocomplete="name" required></div>
      <div class="field"><label for="companyName">Company Name</label><input id="companyName" name="companyName" autocomplete="organization"></div>
      <div class="field"><label for="businessRegistrationNumber">Business Registration Number (Optional)</label><input id="businessRegistrationNumber" name="businessRegistrationNumber"></div>
      <div class="field"><label for="emailAddress">Email Address</label><input id="emailAddress" name="emailAddress" type="email" autocomplete="email" required></div>
      <div class="field"><label for="phoneNumber">Phone Number</label><input id="phoneNumber" name="phoneNumber" autocomplete="tel" required></div>
      <div class="field"><label for="whatsappNumber">WhatsApp Number</label><input id="whatsappNumber" name="whatsappNumber" autocomplete="tel"></div>
      <div class="field"><label for="country">Country</label><input id="country" name="country"></div>
      <div class="field"><label for="city">City</label><input id="city" name="city"></div>
      <div class="field full"><label for="businessAddress">Business Address</label><input id="businessAddress" name="businessAddress"></div>
      <div class="field"><label for="website">Website (Optional)</label><input id="website" name="website" placeholder="https://example.com"></div>
      <div class="field"><label for="preferredContactMethod">Preferred Contact Method</label><select id="preferredContactMethod" name="preferredContactMethod"><option value="">Select method</option><option>Email</option><option>Phone Call</option><option>WhatsApp</option><option>SMS</option></select></div>
      <div class="field"><label for="bestTimeToContact">Best Time to Contact</label><input id="bestTimeToContact" name="bestTimeToContact" placeholder="Weekdays 9am-5pm"></div>
    </div></section>

    <section class="section"><h2>2. Project Overview</h2><div class="grid">
      <div class="field"><label for="projectName">Project Name</label><input id="projectName" name="projectName" required></div>
      <div class="field"><label for="requestCategory">Project Category</label><select id="requestCategory" name="requestCategory" required><option value="">Select category</option>${options(PROJECT_CATEGORIES)}</select></div>
      <div class="field"><label for="projectType">Project Type</label><select id="projectType" name="projectType" required><option value="">Select type</option>${options(PROJECT_TYPES)}</select></div>
      <div class="field full"><label for="projectDescription">Project Description</label><textarea id="projectDescription" name="projectDescription" placeholder="Explain the problem you want solved and the kind of system you need." required></textarea></div>
      <div class="field"><label for="industryType">Industry Type</label><select id="industryType" name="industryType"><option value="">Select industry</option>${options(INDUSTRIES)}</select></div>
      <div class="field"><label for="targetAudience">Target Audience</label><select id="targetAudience" name="targetAudience"><option value="">Select target audience</option>${options(TARGET_USERS)}</select></div>
    </div></section>

    <section class="section"><h2>3. Project Objectives</h2><div class="grid">
      <div class="field full"><label for="problemToSolve">What problem are you trying to solve?</label><textarea id="problemToSolve" name="problemToSolve" required></textarea></div>
      <div class="field full"><label for="businessGoals">What business goals should this project achieve?</label><textarea id="businessGoals" name="businessGoals"></textarea></div>
      <div class="field"><label for="targetUsers">Who are the target users?</label><select id="targetUsers" name="targetUsers"><option value="">Select target users</option>${options(TARGET_USERS)}</select></div>
      <div class="field"><label for="expectedUsers">Expected Number of Users</label><input id="expectedUsers" name="expectedUsers" type="number" min="0"></div>
      <div class="field"><label for="expectedMonthlyTraffic">Expected Monthly Traffic</label><input id="expectedMonthlyTraffic" name="expectedMonthlyTraffic" type="number" min="0"></div>
    </div></section>

    <section class="section"><h2>4. Features & Functionality</h2>
      <div class="choices">${choices('featuresRequired', FEATURES)}</div>
      <div class="field full" style="margin-top:14px;"><label for="customFeatures">Custom Features</label><textarea id="customFeatures" name="customFeatures" placeholder="Describe any feature not listed above."></textarea></div>
    </section>

    <section class="section"><h2>5. Platform Requirements</h2><div class="grid">
      <div class="field full"><label>Target Platforms</label><div class="choices">${choices('platformsRequired', PLATFORMS)}</div></div>
      <div class="field full"><label>Pages or Screens Required</label><div class="choices">${choices('pagesRequired', PAGES)}</div></div>
    </div></section>

    <section class="section"><h2>6. Design Requirements</h2><div class="grid">
      <div class="field"><label for="hasLogo">Do you already have a logo?</label><select id="hasLogo" name="hasLogo"><option value="">Select</option><option>Yes</option><option>No</option></select></div>
      <div class="field"><label for="hasBrandColors">Do you already have brand colors?</label><select id="hasBrandColors" name="hasBrandColors"><option value="">Select</option><option>Yes</option><option>No</option></select></div>
      <div class="field"><label for="hasUiDesigns">Do you already have UI designs?</label><select id="hasUiDesigns" name="hasUiDesigns"><option value="">Select</option><option>Yes</option><option>No</option></select></div>
      <div class="field"><label for="needsUiUx">Do you need UI/UX design services?</label><select id="needsUiUx" name="needsUiUx"><option value="">Select</option><option>Yes</option><option>No</option><option>Not Sure</option></select></div>
      <div class="field"><label for="preferredColors">Brand Colors</label><input id="preferredColors" name="preferredColors"></div>
      <div class="field"><label for="referenceWebsites">Reference Websites or Apps</label><input id="referenceWebsites" name="referenceWebsites" placeholder="https://example.com, app name, screenshots"></div>
      <div class="field"><label for="companyLogo">Logo</label><input id="companyLogo" name="companyLogo" type="file" accept="image/*,.svg"></div>
      <div class="field"><label for="designFiles">Wireframes, Mockups, Brand Guidelines</label><input id="designFiles" name="designFiles" type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"></div>
    </div></section>

    <section class="section"><h2>7. Integrations</h2><div class="choices">${choices('integrationsRequired', INTEGRATIONS)}</div></section>

    <section class="section"><h2>8. Hosting & Infrastructure</h2><div class="grid">
      <div class="field"><label for="ownsDomain">Do you already own a domain?</label><select id="ownsDomain" name="ownsDomain"><option value="">Select</option><option>Yes</option><option>No</option></select></div>
      <div class="field"><label for="needsDomainRegistration">Do you need domain registration?</label><select id="needsDomainRegistration" name="needsDomainRegistration"><option value="">Select</option><option>Yes</option><option>No</option><option>Not Sure</option></select></div>
      <div class="field"><label for="needsHosting">Do you need hosting?</label><select id="needsHosting" name="needsHosting"><option value="">Select</option><option>Yes</option><option>No</option><option>Not Sure</option></select></div>
      <div class="field"><label for="needsEmailSetup">Do you need email setup?</label><select id="needsEmailSetup" name="needsEmailSetup"><option value="">Select</option><option>Yes</option><option>No</option><option>Not Sure</option></select></div>
      <div class="field"><label for="needsCloudDeployment">Do you need cloud deployment?</label><select id="needsCloudDeployment" name="needsCloudDeployment"><option value="">Select</option><option>Yes</option><option>No</option><option>Not Sure</option></select></div>
      <div class="field full"><label>Infrastructure Options</label><div class="choices">${choices('hostingOptions', HOSTING_OPTIONS)}</div></div>
    </div></section>

    <section class="section"><h2>9. Project Timeline</h2><div class="grid">
      <div class="field"><label for="desiredStartDate">Desired Start Date</label><input id="desiredStartDate" name="desiredStartDate" type="date"></div>
      <div class="field"><label for="desiredCompletionDate">Desired Completion Date</label><input id="desiredCompletionDate" name="desiredCompletionDate" type="date"></div>
      <div class="field"><label for="timelineFlexible">Is this timeline flexible?</label><select id="timelineFlexible" name="timelineFlexible"><option value="">Select</option><option>Yes</option><option>No</option><option>Somewhat</option></select></div>
      <div class="field"><label for="priority">Priority</label><select id="priority" name="priority"><option value="">Select priority</option><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></div>
    </div></section>

    <section class="section"><h2>10. Project Budget</h2><div class="grid">
      <div class="field"><label for="budgetCurrency">Budget Currency</label><select id="budgetCurrency" name="budgetCurrency">${valueOptions(BUDGET_CURRENCIES)}</select></div>
      <div class="field"><label for="minimumBudget" id="minimumBudgetLabel">Minimum Budget (GHS)</label><input id="minimumBudget" name="minimumBudget" type="number" min="0" step="0.01"></div>
      <div class="field"><label for="maximumBudget" id="maximumBudgetLabel">Maximum Budget (GHS)</label><input id="maximumBudget" name="maximumBudget" type="number" min="0" step="0.01"></div>
      <div class="field"><label for="budgetRange">Budget Range</label><select id="budgetRange" name="budgetRange"><option value="">Select range</option>${options(BUDGET_RANGES.GHS)}</select></div>
    </div></section>

    <section class="section"><h2>11. Maintenance & Support</h2><div class="grid">
      <div class="field"><label for="maintenancePlan">Maintenance Option</label><select id="maintenancePlan" name="maintenancePlan"><option value="">Select</option><option>No Maintenance</option><option>Monthly Maintenance</option><option>Quarterly Maintenance</option><option>Annual Maintenance</option></select></div>
      <div class="field full"><label>Additional Services</label><div class="choices">${choices('supportServices', SUPPORT_OPTIONS)}</div></div>
    </div></section>

    <section class="section"><h2>12. File Uploads</h2><div class="grid">
      <div class="field"><label for="requirementFiles">Requirement Documents, PDFs, Word, Excel</label><input id="requirementFiles" name="requirementFiles" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"></div>
      <div class="field"><label for="additionalFiles">Images, Videos, Existing Source Code, UI Designs</label><input id="additionalFiles" name="additionalFiles" type="file" multiple accept="image/*,video/*,.zip,.rar,.pdf,.doc,.docx,.xls,.xlsx,.fig,.sketch"></div>
    </div></section>

    <section class="section"><h2>13. Additional Notes</h2><div class="grid">
      <div class="field full"><label for="additionalNotes">Anything else we should know?</label><textarea id="additionalNotes" name="additionalNotes"></textarea></div>
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
const countryField = document.getElementById('country');
const budgetCurrencyField = document.getElementById('budgetCurrency');
const budgetRangeField = document.getElementById('budgetRange');
const budgetRangeOptions = ${JSON.stringify(BUDGET_RANGES)};
let portalClient = null;
let budgetCurrencyTouched = false;
function portalToken() {
  return localStorage.getItem('softOTechPortalToken') || '';
}
function requestReturnPath() {
  return '/website-request' + (window.location.search || '');
}
function updateAuthLinks() {
  const returnTo = encodeURIComponent(requestReturnPath());
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');
  if (loginLink) loginLink.href = '/client/login?returnTo=' + returnTo;
  if (registerLink) registerLink.href = '/client/register?returnTo=' + returnTo;
}
function setField(id, value) {
  const field = document.getElementById(id);
  if (field && value && !field.value) field.value = value;
}
function normalizeCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  return currency === 'USD' ? 'USD' : 'GHS';
}
function countryDefaultsToGhs(value) {
  return /\\b(ghana|gh)\\b/i.test(String(value || '').trim());
}
function escapeOption(value) {
  return String(value || '').replace(/[&<>"]/g, function(ch) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]);
  });
}
function updateBudgetCurrencyUi() {
  const currency = normalizeCurrency(budgetCurrencyField && budgetCurrencyField.value);
  const selectedRange = budgetRangeField ? budgetRangeField.value : '';
  const minimumLabel = document.getElementById('minimumBudgetLabel');
  const maximumLabel = document.getElementById('maximumBudgetLabel');
  if (minimumLabel) minimumLabel.textContent = 'Minimum Budget (' + currency + ')';
  if (maximumLabel) maximumLabel.textContent = 'Maximum Budget (' + currency + ')';
  if (budgetRangeField) {
    const ranges = budgetRangeOptions[currency] || budgetRangeOptions.GHS || [];
    budgetRangeField.innerHTML = '<option value="">Select range</option>' + ranges.map(function(range) {
      return '<option>' + escapeOption(range) + '</option>';
    }).join('');
    if (ranges.indexOf(selectedRange) !== -1) budgetRangeField.value = selectedRange;
  }
}
function syncBudgetCurrencyFromCountry() {
  if (!budgetCurrencyField || budgetCurrencyTouched) return;
  if (countryDefaultsToGhs(countryField && countryField.value)) {
    budgetCurrencyField.value = 'GHS';
    updateBudgetCurrencyUi();
  }
}
async function requireClientLogin() {
  updateAuthLinks();
  const token = portalToken();
  if (!token) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'client-dashboard' || params.get('login') === 'required') {
      window.location.href = '/client/login?returnTo=' + encodeURIComponent('/website-request');
    }
    return;
  }
  try {
    const response = await fetch('/api/project-portal/me', {
      headers: {Authorization: 'Bearer ' + token}
    });
    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.client) throw new Error('Client login is required.');
    if (payload.client.is_admin) {
      errorBox.textContent = 'This is an admin account. Please login or register with a client account to submit project requests.';
      errorBox.style.display = 'block';
      return;
    }
    portalClient = payload.client;
    authGate.classList.add('hidden');
    form.classList.remove('hidden');
    setField('fullName', portalClient.fullName);
    setField('companyName', portalClient.companyName);
    setField('phoneNumber', portalClient.phoneNumber);
    setField('whatsappNumber', portalClient.whatsappNumber);
    setField('emailAddress', portalClient.email);
    setField('country', portalClient.country);
    setField('city', portalClient.city);
    setField('businessAddress', portalClient.address || portalClient.businessLocation);
    setField('preferredContactMethod', portalClient.preferredContactMethod);
    setField('bestTimeToContact', portalClient.bestTimeToContact);
    syncBudgetCurrencyFromCountry();
    updateBudgetCurrencyUi();
    updateEstimate();
  } catch (error) {
    localStorage.removeItem('softOTechPortalToken');
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'client-dashboard' || params.get('login') === 'required') {
      window.location.href = '/client/login?returnTo=' + encodeURIComponent('/website-request');
    }
  }
}
function formJson() {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) {
    if (['pagesRequired','featuresRequired','platformsRequired','integrationsRequired','hostingOptions','supportServices'].includes(key)) {
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
if (budgetCurrencyField) {
  budgetCurrencyField.addEventListener('change', function() {
    budgetCurrencyTouched = true;
    updateBudgetCurrencyUi();
    updateEstimate();
  });
}
if (countryField) {
  countryField.addEventListener('change', syncBudgetCurrencyFromCountry);
  countryField.addEventListener('input', syncBudgetCurrencyFromCountry);
}
updateBudgetCurrencyUi();
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
    nonce: res.locals.cspNonce,
    title: 'Request Submitted | Yenkasa Soft-O-Tech',
    body: `<main class="wrap"><section class="section" style="max-width:760px;margin:40px auto;">
      <h1 style="font-size:clamp(2rem,5vw,3.4rem);">Request submitted</h1>
      <p class="lead">Your project request and client contact profile have been received. Keep this Request ID for follow-up.</p>
      <div class="summary" style="margin:22px 0;"><strong>${requestId || 'Request received'}</strong><span>Yenkasa Soft-O-Tech will review the details and contact you. Your invoice PDF has been generated from the selected project details.</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">${invoiceUrl ? `<a class="btn" target="_blank" rel="noopener" href="${invoiceUrl}">Download Invoice PDF</a>` : ''}<a class="btn secondary" href="/client/dashboard">Client Dashboard</a><a class="btn ghost" href="/">Back to Portfolio</a></div>
    </section></main>`,
  }));
});

router.get('/admin/project-requests', (req, res) => {
  res.send(pageShell({
    nonce: res.locals.cspNonce,
    title: 'Project Requests Admin | Yenkasa Soft-O-Tech',
    body: `<main class="wrap">
  <section class="hero"><div><h1>Project Requests</h1><p class="lead">Manage website, app, software, AI, and UI/UX leads captured from www.yenkasa.xyz.</p></div><aside class="summary"><strong id="totalCount">--</strong><span>Total captured inquiries</span></aside></section>
  <section class="section"><div class="grid">
    <div class="field full"><label for="token">Soft-O-Tech Admin Login Token</label><input id="token" type="password" placeholder="Login as admin/senior developer or paste portal token"></div>
    <div class="field"><label for="search">Search</label><input id="search" placeholder="Request ID, client, company, email, phone"></div>
    <div class="field"><label for="status">Status</label><select id="status"><option value="">All statuses</option>${options(STATUSES)}</select></div>
    <div class="field"><label for="from">From</label><input id="from" type="date"></div>
    <div class="field"><label for="to">To</label><input id="to" type="date"></div>
  </div><div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn" id="loadBtn">Load Requests</button><button class="btn secondary" id="clientsBtn">Load Clients</button><button class="btn secondary" id="analyticsBtn">Load Analytics</button><a class="btn ghost" href="/admin/login?returnTo=/admin/project-requests">Admin Login</a></div><p class="error" id="adminError"></p></section>
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
    const overview = item.overview || {};
    const objectives = item.objectives || {};
    const infra = item.infrastructure || {};
    const timeline = item.timeline || {};
    const project = item.project || {};
    const maintenance = item.maintenance || {};
    const review = item.review || {};
    const costRange = review.estimatedCostRange || {};
    return '<article>' +
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><h2 style="margin:0;">' + escapeHtml(item.requestId) + '</h2><select data-id="' + escapeHtml(item.requestId) + '" class="statusSelect">' + ${JSON.stringify(STATUSES)}.map(status => '<option ' + (status === item.status ? 'selected' : '') + '>' + status + '</option>').join('') + '</select></div>' +
      '<p><strong>' + escapeHtml(contact.fullName) + '</strong> - ' + escapeHtml(contact.companyName) + ' - ' + escapeHtml(contact.email) + '</p>' +
      '<p class="meta">Phone: ' + escapeHtml(contact.phoneNumber) + ' | WhatsApp: ' + escapeHtml(contact.whatsappNumber) + ' | Location: ' + escapeHtml([contact.city, contact.country].filter(Boolean).join(", ") || contact.businessLocation) + ' | Preferred: ' + escapeHtml(contact.preferredContactMethod) + '</p>' +
      '<h3>' + escapeHtml(overview.projectName || req.projectType || item.requestCategory) + '</h3>' +
      '<p class="meta">' + escapeHtml(item.requestCategory) + ' | ' + escapeHtml(req.projectType || req.websiteType) + ' | Platforms: ' + escapeHtml((req.platformsRequired || []).join(", ")) + '</p>' +
      '<p>' + escapeHtml(overview.projectDescription || item.business?.description) + '</p>' +
      '<p class="meta"><strong>Problem:</strong> ' + escapeHtml(objectives.problemToSolve) + '</p>' +
      '<p class="meta"><strong>Goals:</strong> ' + escapeHtml(objectives.businessGoals) + '</p>' +
      '<p class="meta"><strong>Users:</strong> ' + escapeHtml(objectives.targetUsers) + ' | Expected users: ' + escapeHtml(objectives.expectedUsers) + ' | Monthly traffic: ' + escapeHtml(objectives.expectedMonthlyTraffic) + '</p>' +
      '<p class="meta">Pages/Screens: ' + escapeHtml((req.pagesRequired || []).join(", ")) + ' | Features: ' + escapeHtml((req.featuresRequired || []).join(", ")) + '</p>' +
      '<p class="meta">Custom Features: ' + escapeHtml(req.customFeatures) + '</p>' +
      '<p class="meta">Integrations: ' + escapeHtml((item.integrations || []).join(", ")) + '</p>' +
      '<p class="meta">Infrastructure: Domain owned=' + escapeHtml(infra.ownsDomain) + ' | Domain registration=' + escapeHtml(infra.needsDomainRegistration) + ' | Hosting=' + escapeHtml(infra.needsHosting) + ' | Email=' + escapeHtml(infra.needsEmailSetup) + ' | Cloud=' + escapeHtml(infra.needsCloudDeployment) + ' | Options: ' + escapeHtml((infra.hostingOptions || []).join(", ")) + '</p>' +
      '<p class="meta">Timeline: Start ' + escapeHtml(timeline.desiredStartDate || '') + ' | Complete ' + escapeHtml(timeline.desiredCompletionDate || project.desiredCompletionDate || '') + ' | Flexible: ' + escapeHtml(timeline.timelineFlexible) + ' | Priority: ' + escapeHtml(timeline.priority) + '</p>' +
      '<p class="meta">Budget: ' + escapeHtml(project.budgetRange) + ' | Currency: ' + escapeHtml(project.budgetCurrency || estimate.currency || 'GHS') + ' | Min: ' + escapeHtml(project.minimumBudget) + ' | Max: ' + escapeHtml(project.maximumBudget) + ' | Maintenance: ' + escapeHtml(maintenance.plan) + ' | Support: ' + escapeHtml((maintenance.supportServices || []).join(", ")) + '</p>' +
      '<p class="meta"><strong>Admin Review:</strong> Complexity ' + escapeHtml(review.complexity) + ' (' + escapeHtml(review.complexityScore) + '/100) | Duration: ' + escapeHtml(review.estimatedDevelopmentDuration) + ' | Team: ' + escapeHtml(review.recommendedTeamSize) + ' | Stack: ' + escapeHtml((review.suggestedTechnologyStack || []).join(", ")) + ' | Cost: ' + escapeHtml(costRange.currency || 'GHS') + ' ' + Number(costRange.minimum || 0).toLocaleString() + ' - ' + Number(costRange.maximum || 0).toLocaleString() + '</p>' +
      '<p class="meta">Estimated Invoice: ' + escapeHtml((estimate.currency || 'GHS') + ' ' + Number(estimate.grandTotal || invoice.amount || 0).toLocaleString()) + (invoice.url ? ' | <a target="_blank" rel="noopener" href="' + escapeHtml(invoice.url) + '">Download invoice PDF</a>' : '') + '</p>' +
      '<p><strong>Additional Notes:</strong> ' + escapeHtml(project.additionalNotes) + '</p>' +
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
    nonce: res.locals.cspNonce,
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
          <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;"><a class="btn" href="/website-request">Request a Project</a><a class="btn ghost" href="/software-solutions">Software Solutions Portal</a><a class="btn ghost" href="/client/login">Client Portal</a></div>
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
