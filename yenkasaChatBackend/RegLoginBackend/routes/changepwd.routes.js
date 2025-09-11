const express = require('express');
const router = express.Router();

const {
  requestPasswordReset,
  verifyResetToken,
  resetPassword
} = require('../Controller/changepwd.controller'); 

// This router is mounted at /api/reset-password in server.js
// So your full routes will be:
// POST /api/reset-password/request
// POST /api/reset-password/verify
// POST /api/reset-password/confirm/:token

// ✅ Send password reset email
router.post('/request', requestPasswordReset);
console.log("routes/changepwd.routes.js - Defined POST /request for requestPasswordReset");

// ✅ Verify reset token
router.post('/verify', verifyResetToken);
console.log("routes/changepwd.routes.js - Defined POST /verify for verifyResetToken"); 

// ✅ Reset password
router.post('/confirm/:token', resetPassword);
console.log("routes/changepwd.routes.js - Defined POST /confirm/:token for resetPassword"); 

module.exports = router;
console.log("routes/changepwd.routes.js - Module exported");
