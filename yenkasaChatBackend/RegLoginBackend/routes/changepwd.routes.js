const express = require('express');
const router = express.Router();

// ✅ Corrected path for the controller
const {
  verifyResetToken,
  resetPassword
} = require('../Controller/changepwd.controller'); 

// This route will be mounted under /api/reset-password as per your server.js
// So the actual paths will be:
// POST /api/reset-password/verify
// POST /api/reset-password/confirm/:token

// POST /verify (effectively /api/reset-password/verify)
router.post('/verify', verifyResetToken);
console.log("routes/changepwd.routes.js - Defined POST /verify for verifyResetToken"); 

// ✅ POST /confirm/:token (effectively /api/reset-password/confirm/:token)
router.post('/confirm/:token', resetPassword);
console.log("routes/changepwd.routes.js - Defined POST /confirm/:token for resetPassword"); 

module.exports = router;
console.log("routes/changepwd.routes.js - Module exported");