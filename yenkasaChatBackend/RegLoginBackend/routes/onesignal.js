// routes/onesignal.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user.model');
const { sendPushNotification } = require('../utils/onesignal');

// ✅ Route 1: Token-based playerId update (requires valid JWT)
router.post('/update', auth, async (req, res) => {
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id || req.user.id,  // ensure we handle MongoDB _id
      { playerId },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, message: '✅ Player ID updated (token-based)', user });
  } catch (err) {
    console.error('❌ Error updating playerId (token):', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Route 2: PUT method to update playerId with explicit userId param
router.put('/api/users/:userId/player-id', auth, async (req, res) => {
  const { userId } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  // Prevent unauthorized users from updating others' playerId
  if ((req.user._id || req.user.id).toString() !== userId.toString()) {
    return res.status(403).json({ error: 'Unauthorized to update this user' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { playerId },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, message: '✅ Player ID updated successfully', user });
  } catch (err) {
    console.error('❌ Error updating playerId:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Route 3: Manually trigger push notification
router.post('/send-notification', auth, async (req, res) => {
  const { playerId, title, body, data } = req.body;

  if (!playerId || !title || !body) {
    return res.status(400).json({ error: 'playerId, title, and body are required' });
  }

  try {
    const result = await sendPushNotification({
      playerId,
      title,
      body,
      data
    });
    res.status(200).json({ success: true, message: 'Notification sent', result });
  } catch (err) {
    console.error('❌ Error sending manual notification:', err.message);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;
