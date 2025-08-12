// File: routes/userProfileRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming your User model is in 'models/User.js'
const authMiddleware = require('../middleware/authMiddleware'); // Your authentication middleware

// --- Simple Logger Function (Optional but can be expanded) ---
// You could use a more sophisticated logger like Winston or Morgan,
// but for this example, a simple console logger with levels will do.
const logger = {
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args),
    debug: (message, ...args) => console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args) // For more verbose logs if needed
};
// --- End Logger Function ---


/**
 * @route   PUT /api/profile/player-id
 * @desc    Add or Update the OneSignal Player ID for the authenticated user
 * @access  Private (requires authentication)
 */
router.put('/player-id', authMiddleware, async (req, res) => {
    const { playerId } = req.body;
    // req.user should be populated by authMiddleware and contain user details (e.g., id)
    const authenticatedUserId = req.user ? req.user.id : null; // Get from auth middleware

    // Generate a unique request ID for tracing (optional but good for complex systems)
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logger.info(`[${requestId}] Received request to update Player ID. Authenticated User ID (from token): ${authenticatedUserId}`);
    logger.debug(`[${requestId}] Request Body:`, JSON.stringify(req.body)); // Log the raw body for debugging if needed

    // --- Validation ---
    if (!authenticatedUserId) {
        // This should technically be caught by authMiddleware.
        logger.error(`[${requestId}] CRITICAL: User ID not found in req.user after authMiddleware. This indicates an issue with authMiddleware.`);
        return res.status(401).json({ msg: 'User authentication failed or User ID missing.' });
    }

    if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
        logger.warn(`[${requestId}] Validation failed: Player ID is missing, not a string, or empty. Provided Player ID: '${playerId}'. User ID: ${authenticatedUserId}`);
        return res.status(400).json({ msg: 'Valid Player ID (non-empty string) is required in the request body.' });
    }
    // --- End Validation ---

    logger.info(`[${requestId}] Attempting to update Player ID to '${playerId}' for User ID: ${authenticatedUserId}`);

    try {
        const userToUpdate = await User.findById(authenticatedUserId);

        if (!userToUpdate) {
            logger.warn(`[${requestId}] User not found in database with ID: ${authenticatedUserId} during Player ID update. Token might be valid for a deleted user.`);
            return res.status(404).json({ msg: 'User associated with token not found.' });
        }
        
        // Log current Player ID before update for comparison
        logger.debug(`[${requestId}] User '${authenticatedUserId}' current Player ID: '${userToUpdate.playerId}'. New Player ID: '${playerId}'.`);

        // Update the user's playerId and updatedAt timestamp
        userToUpdate.playerId = playerId;
        userToUpdate.updatedAt = new Date();
        
        const updatedUser = await userToUpdate.save(); // .save() is often preferred for triggering Mongoose middleware/validation

        // Alternative using findByIdAndUpdate (your original approach, also valid):
        /*
        const updatedUser = await User.findByIdAndUpdate(
            authenticatedUserId,
            {
                $set: {
                    playerId: playerId,
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: true } // {new: true} returns the modified document, runValidators ensures schema validations run
        );

        if (!updatedUser) { // This check is still valid with findByIdAndUpdate
            logger.warn(`[${requestId}] User not found in database with ID: ${authenticatedUserId} during Player ID update (findByIdAndUpdate). Token might be valid for a deleted user.`);
            return res.status(404).json({ msg: 'User not found for update.' });
        }
        */

        logger.info(`[${requestId}] ✅ Successfully updated Player ID to '${updatedUser.playerId}' for User ID: ${updatedUser._id} (Username: ${updatedUser.username})`);
        
        res.json({
            msg: 'Player ID updated successfully.',
            user: { // Send back relevant parts of the user
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email, // If you want to send email
                playerId: updatedUser.playerId,
                updatedAt: updatedUser.updatedAt
            }
        });

    } catch (err) {
        logger.error(`[${requestId}] ❌ Error updating Player ID for User ID: ${authenticatedUserId}. Player ID was: '${playerId}'. Error: ${err.message}`, { stack: err.stack });
        
        // Specific Mongoose Validation Error
        if (err.name === 'ValidationError') {
            logger.warn(`[${requestId}] Mongoose validation error during Player ID update:`, err.errors);
            return res.status(400).json({ msg: 'Validation error updating Player ID.', errors: err.errors });
        }
        
        // Specific Mongoose Cast Error (e.g., invalid ObjectId format if that were a possibility here)
        if (err.name === 'CastError') {
             logger.warn(`[${requestId}] Mongoose cast error: ${err.path} to ${err.kind} failed for value ${err.value}`);
            return res.status(400).json({ msg: `Invalid data format for ${err.path}.` });
        }

        res.status(500).json({ msg: 'Server error while updating Player ID.' });
    } finally {
        logger.info(`[${requestId}] Finished processing request to update Player ID for User ID: ${authenticatedUserId}.`);
    }
});

module.exports = router;
