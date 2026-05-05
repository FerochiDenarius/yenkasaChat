const express = require('express');
const auth = require('../middleware/auth');
const { getConversationStreak } = require('../utils/conversationStreak');

const router = express.Router();

router.get('/conversation-streak', auth, async (req, res) => {
  try {
    const streak = await getConversationStreak(req.user.id, true);
    res.json({
      current: streak.current,
      longest: streak.longest,
    });
  } catch (err) {
    console.error('[ConversationStreak] Failed to load streak:', err.message);
    res.status(500).json({ message: 'Could not load conversation streak.' });
  }
});

module.exports = router;
