// routes/roles.routes.js

const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const Permission = require('../models/permission.model'); // ✅ Correct model import

// Simple logger utility
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args),
};

// --------------------------------------------
// 🟢 Grant Role
// --------------------------------------------
router.post('/grant/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const actor = await User.findById(req.user._id);
    const target = await User.findById(userId);

    if (!actor || !target)
      return res.status(404).json({ error: 'Actor or target not found.' });

    if (!Permission.canAssignRoles(actor.role))
      return res.status(403).json({ error: 'Not allowed to assign roles.' });

    if (!Permission.canAffect(target.role, actor.role))
      return res.status(403).json({ error: 'Cannot assign role to equal or higher rank user.' });

    target.role = role;
    await target.save();

    logger.info(`${actor.username} granted role '${role}' to ${target.username}`);
    res.json({ message: `Role '${role}' granted to ${target.username}` });
  } catch (err) {
    logger.error('Grant role failed:', err);
    res.status(500).json({ error: 'Server error during role assignment.' });
  }
});

// --------------------------------------------
// 🟢 Revoke Role
// --------------------------------------------
router.post('/revoke/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const actor = await User.findById(req.user._id);
    const target = await User.findById(userId);

    if (!actor || !target)
      return res.status(404).json({ error: 'Actor or target not found.' });

    if (!Permission.canRevoke(actor.role))
      return res.status(403).json({ error: 'Not allowed to revoke roles.' });

    if (!Permission.canAffect(target.role, actor.role))
      return res.status(403).json({ error: 'Cannot revoke a higher or equal rank user.' });

    target.role = 'user';
    await target.save();

    logger.info(`${actor.username} revoked ${target.username}'s role.`);
    res.json({ message: `Role revoked for ${target.username}` });
  } catch (err) {
    logger.error('Revoke role failed:', err);
    res.status(500).json({ error: 'Server error during role revocation.' });
  }
});

// --------------------------------------------
// 🟢 Suspend User
// --------------------------------------------
router.post('/suspend/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.body;

    const actor = await User.findById(req.user._id);
    const target = await User.findById(userId);

    if (!actor || !target)
      return res.status(404).json({ error: 'Actor or target not found.' });

    if (!Permission.canSuspend(actor.role))
      return res.status(403).json({ error: 'Not allowed to suspend users.' });

    if (!Permission.canAffect(target.role, actor.role))
      return res.status(403).json({ error: 'Cannot suspend a higher or equal rank user.' });

    if (!days || isNaN(days) || days <= 0)
      return res.status(400).json({ error: 'Invalid suspension duration.' });

    target.suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await target.save();

    logger.info(`${actor.username} suspended ${target.username} for ${days} day(s).`);
    res.json({
      message: `${target.username} suspended for ${days} day(s).`,
      suspendedUntil: target.suspendedUntil,
    });
  } catch (err) {
    logger.error('Suspend user failed:', err);
    res.status(500).json({ error: 'Server error during suspension.' });
  }
});

// --------------------------------------------
// 🟢 Check Suspension Status
// --------------------------------------------
router.get('/check-suspension/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const now = new Date();
    const suspended = user.suspendedUntil && user.suspendedUntil > now;

    res.json({ suspended, suspendedUntil: user.suspendedUntil });
  } catch (err) {
    logger.error('Check suspension failed:', err);
    res.status(500).json({ error: 'Server error checking suspension.' });
  }
});

module.exports = router;
