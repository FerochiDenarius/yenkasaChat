const express = require('express');
const router = express.Router();

// Corrected path for the controller
const {
  verifyResetToken,
  resetPassword
} = require('../Controller/resetPassword'); // <--- 🌟 CORRECTED PATH HERE

// This route will be mounted under /api/reset-password as per your server.js
// So the actual paths will be:
// POST /api/reset-password/verify
// POST /api/reset-password/confirm

// POST /verify (effectively /api/reset-password/verify)
router.post('/verify', verifyResetToken);
console.log("routes/resetPassword.js - Defined POST /verify for verifyResetToken"); // Optional: for debugging

// POST /confirm (effectively /api/reset-password/confirm)
router.post('/confirm/:token', resetPassword);
console.log("routes/resetPassword.js - Defined POST /confirm for resetPassword"); // Optional: for debugging

module.exports = router;
console.log("routes/resetPassword.js - Module exported"); // Optional: for debugging
