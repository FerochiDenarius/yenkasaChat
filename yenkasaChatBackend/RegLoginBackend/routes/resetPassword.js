const express = require('express');
const router = express.Router();

const {
  verifyResetToken,
  resetPassword
} = require('../../Controller/resetPassword');

// POST /auth/reset-password/verify
router.post('/verify', verifyResetToken);

// POST /auth/reset-password/confirm
router.post('/confirm', resetPassword);

module.exports = router;
