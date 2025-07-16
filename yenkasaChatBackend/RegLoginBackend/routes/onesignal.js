const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user.model');

// ✅ Update OneSignal Player ID
router.post('/update', auth, async (req, res) => {
  const { oneSignalId } = req.body;

  if (!oneSignalId) {
    return res.status(400).json({ error: 'OneSignal ID is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { oneSignalId },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, message: 'OneSignal ID updated', user });
  } catch (err) {
    console.error('❌ Error updating OneSignal ID:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
