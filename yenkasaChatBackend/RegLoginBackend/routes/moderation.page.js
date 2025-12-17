const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { hasMinimumRole } = require("../utils/authority");

/**
 * Moderation dashboard (WEB)
 * URL: /moderation
 */
router.get("/moderation", authMiddleware, (req, res) => {
  const role = req.user.roleName || req.user.role;

  if (!hasMinimumRole(role, "moderator")) {
    return res.status(403).send("Access denied");
  }

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
async function loadItems() {
  const res = await fetch('/api/moderation/pending');
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
  await fetch('/api/moderation/' + id + '/approve', { method: 'POST' });
  loadItems();
}

async function reject(id) {
  await fetch('/api/moderation/' + id + '/reject', { method: 'POST' });
  loadItems();
}

loadItems();
</script>

</body>
</html>
  `);
});

module.exports = router;
