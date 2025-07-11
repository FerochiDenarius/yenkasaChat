const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const { storage } = require('../config/cloudinary');

const upload = multer({ storage });

/**
 * @route   GET /api/users
 * @desc    Get all users (excluding passwords)
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password').lean();
        res.status(200).json(users);
    } catch (err) {
        console.error('❌ Failed to fetch users:', err.message);
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

/**
 * @route   POST /api/users/profile-picture
 * @desc    Upload profile picture to Cloudinary and save URL
 * @access  Private
 */
router.post('/profile-picture', authMiddleware, upload.single('profileImage'), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!req.file || !req.file.path) {
            return res.status(400).json({ error: 'No image uploaded or upload failed' });
        }

        user.profileImage = req.file.path;
        await user.save();

        res.status(200).json({
            message: '✅ Profile image uploaded successfully',
            imageUrl: user.profileImage,
        });
    } catch (err) {
        console.error('❌ Image upload error:', err.stack || err.message);
        res.status(500).json({ error: 'Server error while uploading profile picture' });
    }
});

/**
 * @route   GET /api/users/me
 * @desc    Get logged-in user's profile (no password)
 * @access  Private
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.status(200).json(user);
    } catch (err) {
        console.error('❌ Failed to fetch profile:', err.stack || err.message);
        res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
});

// Fix user emails and phoneNumbers (lowercase, trimmed)
router.post('/fix-contacts', async (req, res) => {
  try {
    const result = await User.updateMany(
      {},
      [
        {
          $set: {
            email: { $toLower: { $trim: { input: "$email" } } },
            phoneNumber: { $trim: { input: "$phoneNumber" } }
          }
        }
      ]
    );

    res.json({
      success: true,
      message: 'Fixed emails and phone numbers formatting',
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('❌ Failed to fix user contacts:', err.message);
    res.status(500).json({ error: 'Server error fixing users' });
  }
});


module.exports = router;
