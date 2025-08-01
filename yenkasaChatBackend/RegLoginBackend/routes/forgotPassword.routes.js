const express = require('express');
const router = express.Router();
const { sendPasswordResetEmail } = require('../controller/forgotPassword.controller');

router.post('/', sendPasswordResetEmail);


module.exports = router;
