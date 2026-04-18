const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const User = require("../models/user.model");
const { hasMinimumRole } = require("../utils/authority");

async function moderationPageAuth(req, res, next) {
  const queryToken = req.query.token;

  if (!queryToken) {
    return authMiddleware(req, res, next);
  }

  try {
    const decoded = jwt.verify(String(queryToken), process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).send("Access denied");
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).send("Access denied");
  }
}

/**
 * Moderation dashboard (WEB)
 * URL: /moderation
 */
router.get("/moderation", moderationPageAuth, (req, res) => {
  const role = req.user.roleName || req.user.role;

  if (!hasMinimumRole(role, "moderator")) {
    return res.status(403).send("Access denied");
  }

  const bearerToken = JSON.stringify(String(req.query.token || ""));

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Yenkasa Moderation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: Arial; background: #f4f4f4; padding: 24px; }
    .card { background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
    button { margin-right: 8px; padding: 6px 12px; }
    .danger { background: #D32F2F; color: #fff; border: none; }
    .ok { background: #388E3C; color: #fff; border: none; }
  </style>
</head>
<body>

<h2>Moderation Queue</h2>
<div id="items">Loading…</div>

<script>
const moderationToken = ${bearerToken};
const authHeaders = moderationToken
  ? { 'Authorization': 'Bearer ' + moderationToken }
  : {};

async function loadItems() {
  const res = await fetch('/api/moderation/pending', { headers: authHeaders });
  const data = await res.json();

  if (!data.success) {
    document.getElementById('items').innerText = 'Failed to load items';
    return;
  }

  const container = document.getElementById('items');
  container.innerHTML = '';

  if (data.items.length === 0) {
    container.innerHTML = '<p>No pending moderation items.</p>';
    return;
  }

  data.items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'card';

    div.innerHTML = \`
      <b>Type:</b> \${item.type}<br/>
      <b>Reason:</b> \${item.reason || '—'}<br/>
      <b>Reported:</b> \${new Date(item.createdAt).toLocaleString()}<br/><br/>
      <button class="ok" onclick="approve('\${item._id}')">Approve</button>
      <button class="danger" onclick="reject('\${item._id}')">Reject</button>
    \`;

    container.appendChild(div);
  });
}

async function approve(id) {
  await fetch('/api/moderation/' + id + '/approve', { method: 'POST', headers: authHeaders });
  loadItems();
}

async function reject(id) {
  await fetch('/api/moderation/' + id + '/reject', { method: 'POST', headers: authHeaders });
  loadItems();
}

loadItems();
</script>

</body>
</html>
  `);
});

module.exports = router;
