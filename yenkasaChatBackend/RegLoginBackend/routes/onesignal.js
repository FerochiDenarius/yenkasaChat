const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth'); // Renamed for clarity, assuming it's middleware
const User = require('../models/user.model');
const { sendPushNotification } = require('../utils/onesignal');
const { v4: uuidv4 } = require('uuid'); // For unique request IDs

// --- Simple Logger (Consider using a more robust logging library like Winston or Morgan for production) ---
// This is fine for smaller projects, but a dedicated library offers more features (levels, transports, formatting).
const logger = {
    info: (message, ...args) => console.log(`[OneSignalRoute][INFO] ${new Date().toISOString()} - ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[OneSignalRoute][WARN] ${new Date().toISOString()} - ${message}`, ...args),
    error: (message, ...args) => console.error(`[OneSignalRoute][ERROR] ${new Date().toISOString()} - ${message}`, ...args),
    debug: (message, ...args) => console.debug(`[OneSignalRoute][DEBUG] ${new Date().toISOString()} - ${message}`, ...args)
};

// --- Helper function for request logging ---
function logRequest(req, res, next) {
    req.requestId = uuidv4(); // Assign a unique ID to each request
    logger.info(`[${req.requestId}] ${req.method} ${req.originalUrl} - Received request.`);
    logger.debug(`[${req.requestId}] Body:`, req.body);
    logger.debug(`[${req.requestId}] Params:`, req.params);
    logger.debug(`[${req.requestId}] Authenticated User ID:`, (req.user?.id || req.user?._id)?.toString());
    next();
}

// --- Error Handling Middleware (Optional but good practice) ---
// This can be added at the end of your main app.js to catch unhandled errors
// For this router, we'll keep try-catch for now, but a global handler is good.

// =========================================================================================
// ==                           UPDATE USER'S ONESIGNAL PLAYER ID                         ==
// =========================================================================================
router.patch('/users/:userId/player-id', authMiddleware, logRequest, async (req, res) => {
    const { userId: paramUserId } = req.params;
    const { playerId: bodyPlayerId } = req.body;
    const { requestId } = req; // Get requestId from logRequest middleware
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString();

    // --- Validation ---
    if (!authenticatedUserId) {
        logger.warn(`[${requestId}] Authentication failed: No authenticated user ID found.`);
        return res.status(401).json({ success: false, message: 'Authentication failed. Please log in.' });
    }
    if (!bodyPlayerId || typeof bodyPlayerId !== 'string' || bodyPlayerId.trim() === '') {
        logger.warn(`[${requestId}] Validation failed: 'playerId' is required and must be a non-empty string. Received: ${bodyPlayerId}`);
        return res.status(400).json({ success: false, message: "Valid 'playerId' is required." });
    }
    if (authenticatedUserId !== paramUserId.toString()) {
        logger.warn(`[${requestId}] Authorization failed: User ${authenticatedUserId} attempted to update player ID for ${paramUserId}.`);
        return res.status(403).json({ success: false, message: 'Forbidden: You can only update your own player ID.' });
    }
    if (!mongoose.Types.ObjectId.isValid(paramUserId)) {
        logger.warn(`[${requestId}] Validation failed: Invalid User ID format. Received: ${paramUserId}`);
        return res.status(400).json({ success: false, message: 'Invalid User ID format.' });
    }

    try {
        const trimmedPlayerId = bodyPlayerId.trim();
        const updateFields = { playerId: trimmedPlayerId, updatedAt: new Date() };

        // Find the user and update their player ID
        const updatedUser = await User.findByIdAndUpdate(
            paramUserId,
            { $set: updateFields },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        );

        if (!updatedUser) {
            logger.warn(`[${requestId}] User not found with ID: ${paramUserId}`);
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        logger.info(`[${requestId}] Player ID updated successfully for user ${updatedUser._id} to ${updatedUser.playerId}`);
        res.status(200).json({
            success: true,
            message: 'Player ID updated successfully.',
            data: { // Nesting response data can be good practice
                userId: updatedUser._id,
                playerId: updatedUser.playerId // Should always exist after a successful update
            }
        });

    } catch (err) {
        logger.error(`[${requestId}] Server error while updating player ID for user ${paramUserId}: ${err.message}`, err.stack);
        // More specific error handling if needed (e.g., Mongoose validation error)
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation error updating player ID.', errors: err.errors });
        }
        res.status(500).json({ success: false, message: 'Server error while updating player ID.' });
    } finally {
        logger.info(`[${requestId}] Finished ${req.method} ${req.originalUrl}`);
    }
});

// =========================================================================================
// ==                                SEND PUSH NOTIFICATION                               ==
// =========================================================================================
router.post('/notify', authMiddleware, logRequest, async (req, res) => {
    const { playerId: targetPlayerId, title, body, data } = req.body; // 'data' is optional additional data for the notification
    const { requestId } = req;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString();

    // --- Validation ---
    if (!authenticatedUserId) {
        logger.warn(`[${requestId}] Authentication failed: No authenticated user ID found for sending notification.`);
        return res.status(401).json({ success: false, message: 'Authentication failed. Please log in.' });
    }
    // Basic validation for required fields
    if (!targetPlayerId || typeof targetPlayerId !== 'string' || targetPlayerId.trim() === '') {
        logger.warn(`[${requestId}] Validation failed: 'targetPlayerId' is required. Received: ${targetPlayerId}`);
        return res.status(400).json({ success: false, message: "Valid 'targetPlayerId' is required." });
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
        logger.warn(`[${requestId}] Validation failed: 'title' is required. Received: ${title}`);
        return res.status(400).json({ success: false, message: "Valid 'title' is required." });
    }
    if (!body || typeof body !== 'string' || body.trim() === '') {
        logger.warn(`[${requestId}] Validation failed: 'body' is required. Received: ${body}`);
        return res.status(400).json({ success: false, message: "Valid 'body' is required." });
    }
    // Optional: Validate 'data' if it has a specific expected structure

    try {
        const trimmedTargetPlayerId = targetPlayerId.trim();
        const trimmedTitle = title.trim();
        const trimmedBody = body.trim();

        logger.info(`[${requestId}] Attempting to send notification to PlayerID: ${trimmedTargetPlayerId} by User: ${authenticatedUserId}`);
        logger.debug(`[${requestId}] Notification details - Title: "${trimmedTitle}", Body: "${trimmedBody}", Data:`, data);

        // --- Send notification using the utility function ---
        const oneSignalResult = await sendPushNotification({
            targetPlayerIds: [trimmedTargetPlayerId], // sendPushNotification expects an array
            title: trimmedTitle,
            body: trimmedBody,
            data // Pass along additional data
        });

        // Optional: Check oneSignalResult for specific success indicators if the utility provides them
        // For example, if it throws on failure, this part is only reached on success.
        // If it returns an object with error details, you'd check that here.

        logger.info(`[${requestId}] Notification request processed for PlayerID: ${trimmedTargetPlayerId}. OneSignal Result (or part of it):`, oneSignalResult);
        res.status(200).json({
            success: true,
            message: 'Notification sent successfully.',
            result: oneSignalResult // Include OneSignal's response if useful for the client
        });

    } catch (err) {
        // This 'err' could be from sendPushNotification or other unexpected issues
        logger.error(`[${requestId}] Error sending notification to PlayerID ${targetPlayerId?.trim()}: ${err.message}`, err.stack);

        // Provide a more specific error message if the error object has details
        // (e.g., if sendPushNotification throws a custom error with a 'status' property)
        const statusCode = err.status || 500;
        const errorMessage = err.isOneSignalError ? err.message : 'Failed to send notification.'; // Example

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            details: err.isOneSignalError ? (err.response?.data || err.message) : err.message // More detailed error
        });
    } finally {
        logger.info(`[${requestId}] Finished ${req.method} ${req.originalUrl}`);
    }
});

// =========================================================================================
// ==                                SEND CALL INVITE PUSH                                ==
// =========================================================================================
router.post('/call-invite', authMiddleware, logRequest, async (req, res) => {
    const { requestId } = req;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString();
    const {
        receiverId,
        callerName,
        callerPhoto,
        isVideo = true,
        roomUrl,
        token
    } = req.body;

    if (!authenticatedUserId) {
        logger.warn(`[${requestId}] Authentication failed: No authenticated user ID found for call invite.`);
        return res.status(401).json({ success: false, message: 'Authentication failed. Please log in.' });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        logger.warn(`[${requestId}] Validation failed: invalid receiverId '${receiverId}'.`);
        return res.status(400).json({ success: false, message: 'Valid receiverId is required.' });
    }

    if (!roomUrl || typeof roomUrl !== 'string' || !roomUrl.trim()) {
        return res.status(400).json({ success: false, message: 'roomUrl is required.' });
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
        return res.status(400).json({ success: false, message: 'token is required.' });
    }

    try {
        const [caller, receiver] = await Promise.all([
            User.findById(authenticatedUserId).select('username profileImage').lean(),
            User.findById(receiverId).select('username playerId').lean()
        ]);

        if (!receiver) {
            return res.status(404).json({ success: false, message: 'Receiver not found.' });
        }

        if (!receiver.playerId || typeof receiver.playerId !== 'string' || !receiver.playerId.trim()) {
            logger.warn(`[${requestId}] Receiver ${receiverId} has no OneSignal playerId; cannot send call invite.`);
            return res.status(200).json({
                success: false,
                message: 'Receiver has no push target registered.'
            });
        }

        const resolvedCallerName =
            (typeof callerName === 'string' && callerName.trim()) ||
            caller?.username ||
            'Yenkasa caller';
        const resolvedIsVideo = isVideo === true || isVideo === 'true';
        const callType = resolvedIsVideo ? 'video' : 'audio';

        const data = {
            type: 'call_invite',
            targetType: 'call',
            callerId: authenticatedUserId,
            callerName: resolvedCallerName,
            callerPhoto: (typeof callerPhoto === 'string' && callerPhoto.trim()) || caller?.profileImage || '',
            isVideo: resolvedIsVideo,
            callType,
            receiverId: receiver._id.toString(),
            roomUrl: roomUrl.trim(),
            token: token.trim()
        };

        const result = await sendPushNotification({
            playerId: receiver.playerId.trim(),
            title: `Incoming ${resolvedIsVideo ? 'video' : 'audio'} call`,
            body: `${resolvedCallerName} is calling you`,
            data,
            existing_android_channel_id: 'yenkasachat_calls',
            priority: 10,
            ttl: 30,
            small_icon: 'ic_call'
        });

        logger.info(`[${requestId}] Call invite sent from ${authenticatedUserId} to ${receiverId}.`, result);
        return res.status(200).json({
            success: true,
            message: 'Call invite sent.',
            result
        });
    } catch (err) {
        logger.error(`[${requestId}] Error sending call invite to ${receiverId}: ${err.message}`, err.stack);
        const statusCode = err.status || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.isOneSignalError ? err.message : 'Failed to send call invite.',
            details: err.isOneSignalError ? (err.response?.data || err.message) : err.message
        });
    } finally {
        logger.info(`[${requestId}] Finished ${req.method} ${req.originalUrl}`);
    }
});

module.exports = router;
