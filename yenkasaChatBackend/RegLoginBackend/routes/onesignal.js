// File: routes/onesignal.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Ensure this path is correct and loads your auth.js
const User = require('../models/user.model'); // Ensure this path is correct and User schema defines 'playerId'
const { sendPushNotification } = require('../utils/onesignal'); // Assuming this utility exists and functions correctly

// --- Simple Logger Function (Consistent with userProfileRoutes.js) ---
const logger = {
    info: (message, ...args) => console.log(`[OneSignalRoute][INFO] ${new Date().toISOString()} - ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[OneSignalRoute][WARN] ${new Date().toISOString()} - ${message}`, ...args),
    error: (message, ...args) => console.error(`[OneSignalRoute][ERROR] ${new Date().toISOString()} - ${message}`, ...args),
    debug: (message, ...args) => console.debug(`[OneSignalRoute][DEBUG] ${new Date().toISOString()} - ${message}`, ...args)
};
// --- End Logger Function ---


// PATCH /api/users/:userId/player-id  
// (Assuming this router is mounted under /api, so the full path becomes /api/users/:userId/player-id)
// This endpoint updates the OneSignal Player ID for a specific user.
router.patch('/users/:userId/player-id', auth, async (req, res) => {
    const { userId: paramUserId } = req.params; // User ID from the URL parameter
    const { playerId: bodyPlayerId } = req.body; // The OneSignal Player ID from the request body

    const requestId = `req_onesignal_patch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString(); // Get user ID from authentication middleware

    logger.info(`[${requestId}] PATCH /users/${paramUserId}/player-id - Received request. Authenticated User ID: ${authenticatedUserId}`);
    logger.debug(`[${requestId}] Request Params: userId=${paramUserId}`);
    logger.debug(`[${requestId}] Request Body: playerId=${bodyPlayerId}`);

    // --- Validation and Authorization ---
    if (!authenticatedUserId) {
        logger.error(`[${requestId}] CRITICAL: Authenticated User ID not found in req.user after authMiddleware.`);
        return res.status(401).json({ error: 'User authentication failed or User ID missing.' });
    }

    if (!bodyPlayerId || typeof bodyPlayerId !== 'string' || bodyPlayerId.trim() === '') {
        logger.warn(`[${requestId}] Validation Failed: 'playerId' (OneSignal Player ID) is missing, not a string, or empty in request body. Provided: '${bodyPlayerId}'. Target User Param: ${paramUserId}`);
        return res.status(400).json({ error: "Valid 'playerId' (OneSignal Player ID) is required in the request body." });
    }

    // Security: Ensure the authenticated user is the one whose player ID is being updated,
    // or an admin (if you have admin roles, that logic would be added here).
    if (authenticatedUserId !== paramUserId.toString()) {
        logger.warn(`[${requestId}] FORBIDDEN attempt: Authenticated User ${authenticatedUserId} trying to update Player ID for User Param ${paramUserId}.`);
        return res.status(403).json({ error: 'Forbidden: You can only update your own player ID.' });
    }
    // --- End Validation and Authorization ---

    // CONSISTENCY: Log intent to update 'playerId' field
    logger.info(`[${requestId}] Attempting to update 'playerId' to '${bodyPlayerId.trim()}' for User ID: ${paramUserId}`);

    try {
        // Find the user by their MongoDB _id and update their 'playerId' field.
        const updatedUser = await User.findByIdAndUpdate(
            paramUserId,
            // MODIFIED: Use 'playerId' to be consistent with User model and other routes.
            // Ensure your User model schema has a field named 'playerId: String'.
            { $set: { playerId: bodyPlayerId.trim(), updatedAt: new Date() } },
            { new: true, runValidators: true } // Returns the updated document and runs schema validators
        );

        if (!updatedUser) {
            logger.warn(`[${requestId}] User not found with ID: ${paramUserId} during Player ID update.`);
            return res.status(404).json({ error: 'User not found' });
        }

        // CONSISTENCY: Log success for 'playerId' field
        logger.info(`[${requestId}] ✅ 'playerId' updated successfully for User ID ${updatedUser._id} to '${updatedUser.playerId}'.`);
        logger.debug(`[${requestId}] Updated User Data:`, { id: updatedUser._id, username: updatedUser.username, playerId: updatedUser.playerId });
        
        res.status(200).json({
            success: true,
            message: 'Player ID updated successfully',
            userId: updatedUser._id,
            // MODIFIED: Send back 'playerId' field from the updated user document
            playerId: updatedUser.playerId 
        });

    } catch (err) {
        // CONSISTENCY: Log error for 'playerId' field
        logger.error(`[${requestId}] ❌ Error updating 'playerId' for User ID ${paramUserId} to '${bodyPlayerId.trim()}'. Error: ${err.message}`, { stack: err.stack });
        
        if (err.name === 'ValidationError') {
            logger.warn(`[${requestId}] Mongoose validation error:`, err.errors);
            return res.status(400).json({ error: 'Validation error updating Player ID.', errors: err.errors });
        }
        if (err.name === 'CastError') {
            logger.warn(`[${requestId}] Mongoose cast error: ${err.path} to ${err.kind} failed for value ${err.value}`);
            return res.status(400).json({ error: `Invalid data format for ${err.path}.` });
        }
        res.status(500).json({ error: 'Server error while updating player ID' });
    } finally {
        logger.info(`[${requestId}] Finished processing PATCH /users/${paramUserId}/player-id. Authenticated User ID: ${authenticatedUserId}`);
    }
});


// POST /api/notify 
// (Assuming this router is mounted under /api, so the full path becomes /api/notify)
// This is a generic endpoint to send a push notification to a specific OneSignal Player ID.
// Could be used for testing or specific admin-initiated notifications.
router.post('/notify', auth, async (req, res) => {
    // 'playerId' in the request body is the TARGET OneSignal Player ID to send the notification to.
    const { playerId: targetPlayerId, title, body, data } = req.body; 
    
    const requestId = `req_onesignal_notify_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString(); // User initiating the request

    logger.info(`[${requestId}] POST /notify - Received request. Target OneSignal PlayerID: ${targetPlayerId}. Triggered by User: ${authenticatedUserId}`);
    logger.debug(`[${requestId}] Request Body:`, JSON.stringify(req.body));

    // --- Validation ---
    if (!authenticatedUserId) {
        logger.error(`[${requestId}] CRITICAL: Authenticated User ID not found in req.user after authMiddleware for notification request.`);
        return res.status(401).json({ error: 'User authentication failed or User ID missing.' });
    }

    if (!targetPlayerId || typeof targetPlayerId !== 'string' || targetPlayerId.trim() === '') {
        logger.warn(`[${requestId}] Validation Failed: 'targetPlayerId' is missing or invalid. Provided: '${targetPlayerId}'`);
        return res.status(400).json({ error: "Valid 'targetPlayerId' (OneSignal Player ID) is required in the request body." });
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
        logger.warn(`[${requestId}] Validation Failed: 'title' is missing or invalid. Provided: '${title}'`);
        return res.status(400).json({ error: "Valid 'title' (string) is required in the request body." });
    }
    if (!body || typeof body !== 'string' || body.trim() === '') {
        logger.warn(`[${requestId}] Validation Failed: 'body' is missing or invalid. Provided: '${body ? 'Present' : 'Missing/Empty'}'`);
        return res.status(400).json({ error: "Valid 'body' (string) is required in the request body." });
    }
    // --- End Validation ---

    logger.info(`[${requestId}] Attempting to send notification. Title: '${title.trim()}', Body: '${body.trim().substring(0,50)+'...'}', Target PlayerID: ${targetPlayerId.trim()}`);

    try {
        // Call your utility function to send the push notification.
        // Ensure this utility is correctly configured with your OneSignal App ID and REST API Key.
        const result = await sendPushNotification({
            targetPlayerIds: [targetPlayerId.trim()], // sendPushNotification might expect an array
            title: title.trim(),
            body: body.trim(),
            data // Optional custom data to include in the notification
        });

        logger.info(`[${requestId}] ✅ Manual notification sent successfully to PlayerID: ${targetPlayerId.trim()}. OneSignal API Result:`, result);
        res.status(200).json({ success: true, message: 'Notification sent successfully', result });

    } catch (err) {
        logger.error(`[${requestId}] ❌ Error sending manual notification to PlayerID: ${targetPlayerId.trim()}. Error: ${err.message}`, { errorDetails: err, stack: err.stack });
        // The 'err' from sendPushNotification might have more specific details from the OneSignal API
        res.status(500).json({ error: 'Failed to send notification', details: err.message || 'Unknown error from OneSignal utility' });
    } finally {
        logger.info(`[${requestId}] Finished processing POST /notify. Triggered by User: ${authenticatedUserId}, Target PlayerID: ${targetPlayerId.trim()}`);
    }
});

module.exports = router;