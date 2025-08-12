// routes/onesignal.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Ensure this path is correct
const User = require('../models/user.model'); // Ensure this path is correct
const { sendPushNotification } = require('../utils/onesignal'); // Assuming this utility exists


router.patch('/users/:userId/player-id', auth, async (req, res) => {
    const { userId } = req.params;
    const { playerId } = req.body; // 'playerId' is the key sent from the Android app

    // Log incoming request for debugging
    console.log(`[OneSignal Route] PATCH /users/${userId}/player-id received.`);
    console.log(`[OneSignal Route] Request Body:`, req.body);
    console.log(`[OneSignal Route] Authenticated User ID:`, req.user.id || req.user._id);

    if (!playerId) {
        console.warn('[OneSignal Route] playerId is missing in request body.');
        return res.status(400).json({ error: 'playerId is required in the request body' });
    }

    // Security: Ensure the authenticated user is the one whose player ID is being updated,
    // or implement admin override logic if needed.
    // req.user.id (or req.user._id) should be the string representation of the MongoDB ObjectId.
    const authenticatedUserId = (req.user.id || req.user._id).toString();
    if (authenticatedUserId !== userId.toString()) {
        console.warn(`[OneSignal Route] Forbidden attempt: User ${authenticatedUserId} trying to update Player ID for user ${userId}.`);
        return res.status(403).json({ error: 'Forbidden: You can only update your own player ID.' });
    }

    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { oneSignalPlayerId: playerId }, // ✅ Using 'oneSignalPlayerId' field, value comes from 'playerId' in body
            { new: true } // Returns the updated document
        );

        if (!user) {
            console.warn(`[OneSignal Route] User not found with ID: ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`[OneSignal Route] ✅ Player ID updated successfully for user ${userId} to ${playerId}. User data:`, user);
        res.status(200).json({ success: true, message: 'Player ID updated successfully', userId: user._id, oneSignalPlayerId: user.oneSignalPlayerId });
    } catch (err) {
        console.error(`[OneSignal Route] ❌ Error updating player ID for user ${userId}:`, err);
        res.status(500).json({ error: 'Server error while updating player ID' });
    }
});

// --- Route for Manually Triggering a Push Notification ---
// This route now corresponds to POST /api/notify
router.post('/notify', auth, async (req, res) => { // CHANGED: Renamed path to '/notify'
    // Assuming 'playerId' in req.body for this route refers to the target's OneSignal Player ID
    const { playerId, title, body, data } = req.body;

    console.log(`[OneSignal Route] POST /notify received for playerId: ${playerId}`);

    if (!playerId || !title || !body) {
        return res.status(400).json({ error: 'Target playerId, title, and body are required' });
    }

    try {
        // This 'sendPushNotification' utility should use the target 'playerId'
        // and construct the payload for OneSignal correctly, including your OneSignal App ID and REST API Key.
        const result = await sendPushNotification({
            targetPlayerId: playerId, // Pass the target player ID clearly
            title,
            body,
            data
        });
        console.log('[OneSignal Route] Manual notification sent successfully.');
        res.status(200).json({ success: true, message: 'Notification sent', result });
    } catch (err) {
        console.error('[OneSignal Route] ❌ Error sending manual notification:', err.message, err);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

module.exports = router;
