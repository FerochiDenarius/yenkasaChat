// routes/onesignal.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Ensure this path is correct
const User = require('../models/user.model'); // Ensure this path is correct
const { sendPushNotification } = require('../utils/onesignal'); // Assuming this utility exists

// --- Simple Logger Function (Consistent with userProfileRoutes.js) ---
const logger = {
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args),
    debug: (message, ...args) => console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args)
};
// --- End Logger Function ---


// PATCH /api/users/:userId/player-id  (Assuming this is mounted under /api, so full path is /api/users/:userId/player-id)
router.patch('/users/:userId/player-id', auth, async (req, res) => {
    const { userId: paramUserId } = req.params; // Renamed to avoid confusion with authenticatedUserId
    const { playerId: bodyPlayerId } = req.body; // Renamed to be specific, this is the OneSignal Player ID from client

    const requestId = `req_onesignal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString(); // From auth middleware

    logger.info(`[${requestId}] [OneSignal Route] PATCH /users/${paramUserId}/player-id received. Authenticated User ID: ${authenticatedUserId}`);
    logger.debug(`[${requestId}] [OneSignal Route] Request Params:`, req.params);
    logger.debug(`[${requestId}] [OneSignal Route] Request Body:`, JSON.stringify(req.body));


    if (!authenticatedUserId) {
        logger.error(`[${requestId}] [OneSignal Route] CRITICAL: Authenticated User ID not found in req.user after authMiddleware.`);
        return res.status(401).json({ error: 'User authentication failed or User ID missing.' });
    }

    if (!bodyPlayerId || typeof bodyPlayerId !== 'string' || bodyPlayerId.trim() === '') {
        logger.warn(`[${requestId}] [OneSignal Route] Validation Failed: 'playerId' (OneSignal Player ID) is missing, not a string, or empty in request body. Provided: '${bodyPlayerId}'. Target User Param: ${paramUserId}`);
        return res.status(400).json({ error: "Valid 'playerId' (OneSignal Player ID) is required in the request body." });
    }

    // Security: Ensure the authenticated user is the one whose player ID is being updated.
    if (authenticatedUserId !== paramUserId.toString()) {
        logger.warn(`[${requestId}] [OneSignal Route] FORBIDDEN attempt: Authenticated User ${authenticatedUserId} trying to update Player ID for User Param ${paramUserId}.`);
        return res.status(403).json({ error: 'Forbidden: You can only update your own player ID.' });
    }

    logger.info(`[${requestId}] [OneSignal Route] Attempting to update 'oneSignalPlayerId' to '${bodyPlayerId}' for User ID: ${paramUserId}`);

    try {
        // Find the user by their MongoDB _id and update their oneSignalPlayerId field
        const updatedUser = await User.findByIdAndUpdate(
            paramUserId, // Use the userId from the route parameter, already validated against authenticated user
            { $set: { oneSignalPlayerId: bodyPlayerId, updatedAt: new Date() } }, // Assuming 'oneSignalPlayerId' is the field in your User model
            { new: true, runValidators: true } // Returns the updated document and runs schema validators
        );

        if (!updatedUser) {
            logger.warn(`[${requestId}] [OneSignal Route] User not found with ID: ${paramUserId} during Player ID update.`);
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info(`[${requestId}] [OneSignal Route] ✅ 'oneSignalPlayerId' updated successfully for User ID ${updatedUser._id} to '${updatedUser.oneSignalPlayerId}'.`);
        logger.debug(`[${requestId}] [OneSignal Route] Updated User Data:`, { id: updatedUser._id, username: updatedUser.username, oneSignalPlayerId: updatedUser.oneSignalPlayerId });
        
        res.status(200).json({
            success: true,
            message: 'Player ID updated successfully',
            userId: updatedUser._id,
            oneSignalPlayerId: updatedUser.oneSignalPlayerId // Send back the confirmed field
        });

    } catch (err) {
        logger.error(`[${requestId}] [OneSignal Route] ❌ Error updating 'oneSignalPlayerId' for User ID ${paramUserId} to '${bodyPlayerId}'. Error: ${err.message}`, { stack: err.stack });
        
        if (err.name === 'ValidationError') {
            logger.warn(`[${requestId}] [OneSignal Route] Mongoose validation error:`, err.errors);
            return res.status(400).json({ error: 'Validation error updating Player ID.', errors: err.errors });
        }
        if (err.name === 'CastError') {
             logger.warn(`[${requestId}] [OneSignal Route] Mongoose cast error: ${err.path} to ${err.kind} failed for value ${err.value}`);
            return res.status(400).json({ error: `Invalid data format for ${err.path}.` });
        }
        res.status(500).json({ error: 'Server error while updating player ID' });
    } finally {
        logger.info(`[${requestId}] [OneSignal Route] Finished processing PATCH /users/${paramUserId}/player-id. Authenticated User ID: ${authenticatedUserId}`);
    }
});


// POST /api/notify (Assuming this is mounted under /api, so full path is /api/notify)
router.post('/notify', auth, async (req, res) => {
    const { playerId: targetPlayerId, title, body, data } = req.body; // 'playerId' in body is the TARGET OneSignal Player ID
    
    const requestId = `req_onesignal_notify_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString();

    logger.info(`[${requestId}] [OneSignal Notify] POST /notify received. Target OneSignal PlayerID: ${targetPlayerId}. Triggered by User: ${authenticatedUserId}`);
    logger.debug(`[${requestId}] [OneSignal Notify] Request Body:`, JSON.stringify(req.body));

    if (!authenticatedUserId) {
        logger.error(`[${requestId}] [OneSignal Notify] CRITICAL: Authenticated User ID not found in req.user after authMiddleware for notification request.`);
        return res.status(401).json({ error: 'User authentication failed or User ID missing.' });
    }

    if (!targetPlayerId || !title || !body) {
        logger.warn(`[${requestId}] [OneSignal Notify] Validation failed: Target OneSignal PlayerID, title, or body is missing. PlayerID: ${targetPlayerId}, Title: ${title}, Body: ${body ? 'Present' : 'Missing'}`);
        return res.status(400).json({ error: 'Target OneSignal PlayerID, title, and body are required' });
    }

    logger.info(`[${requestId}] [OneSignal Notify] Attempting to send notification. Title: '${title}', Body: '${body ? body.substring(0,30)+'...' : ''}', Target PlayerID: ${targetPlayerId}`);

    try {
        const result = await sendPushNotification({
            targetPlayerId: targetPlayerId, // Ensure your utility uses this to target a specific device
            title,
            body,
            data // Optional custom data
        });
        logger.info(`[${requestId}] [OneSignal Notify] ✅ Manual notification sent successfully to PlayerID: ${targetPlayerId}. OneSignal API Result:`, result);
        res.status(200).json({ success: true, message: 'Notification sent successfully', result });
    } catch (err) {
        logger.error(`[${requestId}] [OneSignal Notify] ❌ Error sending manual notification to PlayerID: ${targetPlayerId}. Error: ${err.message}`, { errorDetails: err, stack: err.stack });
        // The 'err' from sendPushNotification might have more specific details from the OneSignal API
        res.status(500).json({ error: 'Failed to send notification', details: err.message || 'Unknown error from OneSignal utility' });
    } finally {
        logger.info(`[${requestId}] [OneSignal Notify] Finished processing POST /notify. Triggered by User: ${authenticatedUserId}, Target PlayerID: ${targetPlayerId}`);
    }
});

module.exports = router;
