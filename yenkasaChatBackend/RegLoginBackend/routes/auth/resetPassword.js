const express = require('express');
const router = express.Router();

const {
  verifyResetToken,
  resetPassword
} = require('../../Controller/resetPassword');

router.post('/verify', verifyResetToken);
router.post('/confirm', resetPassword);

module.exports = router;
