const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user.model');

// ✅ OPTION 1: Token-based update (used after login)
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

    res.json({ success: true, message: 'OneSignal ID updated (token-based)', user });
  } catch (err) {
    console.error('❌ Error updating OneSignal ID (token):', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ OPTION 2: Frontend-matching version
// PATCH /api/auth/update-player-id/:userId
router.patch('/update-player-id/:userId', async (req, res) => {
  const { userId } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { oneSignalId: playerId },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, message: '✅ Player ID updated successfully' });
  } catch (err) {
    console.error('❌ Error updating playerId:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
