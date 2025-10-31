// routes/roles.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');

// --- Logger ---
const logger = {
    info: (msg, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args),
};

// -----------------------------------
// Helper: Check hierarchy permissions
// -----------------------------------
function canModifyRole(actor, targetRole) {
    const hierarchy = ['user', 'moderator', 'admin', 'developer'];
    return hierarchy.indexOf(actor.role) > hierarchy.indexOf(targetRole);
}

// -----------------------------------
// Grant role
// -----------------------------------
router.post('/grant/:userId', authMiddleware, async (req, res) => {
    const actorId = req.user._id.toString();
    const { userId } = req.params;
    const { role } = req.body; // 'user', 'moderator', 'admin', 'developer'

    try {
        const actor = await User.findById(actorId);
        const target = await User.findById(userId);

        if (!actor || !target) return res.status(404).json({ error: 'Actor or target user not found.' });
        if (!actor.permissions.canAssignRoles && actor.role !== 'developer') return res.status(403).json({ error: 'Not allowed to assign roles.' });
        if (!['user','moderator','admin','developer'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
        if (!canModifyRole(actor, target.role) && actor.role !== 'developer') return res.status(403).json({ error: 'Cannot modify role of higher or equal hierarchy.' });

        target.role = role;
        await target.save();

        logger.info(`User ${actor.username} granted role '${role}' to ${target.username}`);
        res.json({ message: `Role '${role}' granted to ${target.username}` });
    } catch (err) {
        logger.error('Error granting role:', err);
        res.status(500).json({ error: 'Server error granting role.' });
    }
});

// -----------------------------------
// Revoke role (downgrade to 'user')
// -----------------------------------
router.post('/revoke/:userId', authMiddleware, async (req, res) => {
    const actorId = req.user._id.toString();
    const { userId } = req.params;

    try {
        const actor = await User.findById(actorId);
        const target = await User.findById(userId);

        if (!actor || !target) return res.status(404).json({ error: 'Actor or target user not found.' });
        if (!actor.permissions.canAssignRoles && actor.role !== 'developer') return res.status(403).json({ error: 'Not allowed to revoke roles.' });
        if (!canModifyRole(actor, target.role) && actor.role !== 'developer') return res.status(403).json({ error: 'Cannot revoke role of higher or equal hierarchy.' });

        target.role = 'user';
        await target.save();

        logger.info(`User ${actor.username} revoked role of ${target.username}`);
        res.json({ message: `Role revoked for ${target.username}` });
    } catch (err) {
        logger.error('Error revoking role:', err);
        res.status(500).json({ error: 'Server error revoking role.' });
    }
});

// -----------------------------------
// Suspend user
// -----------------------------------
router.post('/suspend/:userId', authMiddleware, async (req, res) => {
    const actorId = req.user._id.toString();
    const { userId } = req.params;
    const { days } = req.body; // number of days to suspend

    try {
        const actor = await User.findById(actorId);
        const target = await User.findById(userId);

        if (!actor || !target) return res.status(404).json({ error: 'Actor or target user not found.' });
        if (!actor.permissions.canSuspendUser && actor.role !== 'developer') return res.status(403).json({ error: 'Not allowed to suspend users.' });
        if (!canModifyRole(actor, target.role) && actor.role !== 'developer') return res.status(403).json({ error: 'Cannot suspend a higher or equal role user.' });
        if (!days || isNaN(days) || days <= 0) return res.status(400).json({ error: 'Invalid suspension duration.' });

        target.suspendedUntil = new Date(Date.now() + days * 24*60*60*1000);
        await target.save();

        logger.info(`User ${actor.username} suspended ${target.username} for ${days} day(s).`);
        res.json({ message: `${target.username} suspended for ${days} day(s).`, suspendedUntil: target.suspendedUntil });
    } catch (err) {
        logger.error('Error suspending user:', err);
        res.status(500).json({ error: 'Server error suspending user.' });
    }
});

// -----------------------------------
// Check if user is currently suspended
// -----------------------------------
router.get('/check-suspension/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const now = new Date();
        const suspended = user.suspendedUntil && user.suspendedUntil > now;

        res.json({ suspended, suspendedUntil: user.suspendedUntil });
    } catch (err) {
        logger.error('Error checking suspension:', err);
        res.status(500).json({ error: 'Server error checking suspension.' });
    }
});

module.exports = router;
