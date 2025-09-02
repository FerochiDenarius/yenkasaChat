const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../Controller/profileController');
const authMiddleware = require('../middleware/auth');  // ✅ your middleware

// GET /api/profile
router.get('/', authMiddleware, getProfile);

// PUT /api/profile
router.put('/', authMiddleware, updateProfile);

module.exports = router;
