const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization header missing' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded; // so you can access req.user.id in your routes
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
router.patch('/:userId/fcm-token', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { fcmToken } = req.body;

  try {
    await User.findByIdAndUpdate(userId, { fcmToken });
    res.sendStatus(204);
  } catch (err) {
    console.error('❌ Error saving FCM token:', err);
    res.status(500).json({ error: 'Failed to save FCM token' });
  }
});
