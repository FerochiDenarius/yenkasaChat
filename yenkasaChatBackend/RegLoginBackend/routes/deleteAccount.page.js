const express = require("express");
const router = express.Router();

/**
 * Public account deletion request page (Google Play requirement)
 */
function renderDeleteAccountPage(req, res) {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Delete Yenkasa Account</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f8f8f8;
      padding: 24px;
    }
    .card {
      max-width: 480px;
      margin: auto;
      background: #ffffff;
      padding: 24px;
      border-radius: 12px;
    }
    h2 { color: #C62828; }
    button {
      background: #C62828;
      color: white;
      border: none;
      padding: 12px;
      width: 100%;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
    }
    input, textarea {
      width: 100%;
      padding: 10px;
      margin: 8px 0 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Request Account Deletion</h2>
    <p>
      You can request permanent deletion of your Yenkasa account and associated personal data.
    </p>

    <form method="POST" action="/api/account/delete-request">
      <label>Email used for your Yenkasa account</label>
      <input type="email" name="email" required />

      <label>Reason (optional)</label>
      <textarea name="reason"></textarea>

      <button type="submit">Submit Deletion Request</button>
    </form>

    <p style="font-size: 12px; margin-top: 16px;">
      Requests are processed within 30 days.  
      Some data may be retained if required by law.
    </p>
  </div>
</body>
</html>
  `);
}

[
  "/delete-account",
  "/delete-account.html",
  "/account-deletion",
  "/account-deletion.html",
  "/account-delete",
  "/account-delete.html",
].forEach((path) => {
  router.get(path, renderDeleteAccountPage);
});

module.exports = router;
