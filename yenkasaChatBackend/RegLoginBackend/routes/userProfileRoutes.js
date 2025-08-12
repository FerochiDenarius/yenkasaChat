// File: routes/userProfileRoutes.js

const express = require('express');
const router = express.Router();
// MODIFIED: Corrected the path to require 'user.model.js' from the 'models' folder
const User = require('../models/user.model'); 
const authMiddleware = require('../middleware/authMiddleware'); // Your authentication middleware

// --- Simple Logger Function (Optional but can be expanded) ---
// You could use a more sophisticated logger like Winston or Morgan,
// but for this example, a simple console logger with levels will do.
const logger = {
    info: (message, ...args) => console.log(`[UserProfileRoute][INFO] ${new Date().toISOString()} - ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[UserProfileRoute][WARN] ${new Date().toISOString()} - ${message}`, ...args),
    error: (message, ...args) => console.error(`[UserProfileRoute][ERROR] ${new Date().toISOString()} - ${message}`, ...args),
    debug: (message, ...args) => console.debug(`[UserProfileRoute][DEBUG] ${new Date().toISOString()} - ${message}`, ...args) // For more verbose logs if needed
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
    const requestId = `req_profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logger.info(`[${requestId}] PUT /api/profile/player-id - Received request. Authenticated User ID (from token): ${authenticatedUserId}`);
    logger.debug(`[${requestId}] PUT /api/profile/player-id - Request Body:`, JSON.stringify(req.body));

    // --- Validation ---
    if (!authenticatedUserId) {
        // This should technically be caught by authMiddleware.
        logger.error(`[${requestId}] PUT /api/profile/player-id - CRITICAL: User ID not found in req.user after authMiddleware. This indicates an issue with authMiddleware.`);
        return res.status(401).json({ msg: 'User authentication failed or User ID missing.' });
    }

    if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
        logger.warn(`[${requestId}] PUT /api/profile/player-id - Validation failed: Player ID is missing, not a string, or empty. Provided Player ID: '${playerId}'. User ID: ${authenticatedUserId}`);
        return res.status(400).json({ msg: 'Valid Player ID (non-empty string) is required in the request body.' });
    }
    // --- End Validation ---

    logger.info(`[${requestId}] PUT /api/profile/player-id - Attempting to update Player ID to '${playerId}' for User ID: ${authenticatedUserId}`);

    try {
        const userToUpdate = await User.findById(authenticatedUserId);

        if (!userToUpdate) {
            logger.warn(`[${requestId}] PUT /api/profile/player-id - User not found in database with ID: ${authenticatedUserId} during Player ID update. Token might be valid for a deleted user.`);
            return res.status(404).json({ msg: 'User associated with token not found.' });
        }
        
        logger.debug(`[${requestId}] PUT /api/profile/player-id - User '${authenticatedUserId}' current Player ID: '${userToUpdate.playerId}'. New Player ID: '${playerId}'.`);

        // Update the user's playerId and updatedAt timestamp
        userToUpdate.playerId = playerId.trim(); // Trim the playerId before saving
        userToUpdate.updatedAt = new Date(); // Mongoose 'timestamps: true' in schema usually handles this, but explicit update is fine.
        
        const updatedUser = await userToUpdate.save(); 

        logger.info(`[${requestId}] PUT /api/profile/player-id - ✅ Successfully updated Player ID to '${updatedUser.playerId}' for User ID: ${updatedUser._id} (Username: ${updatedUser.username})`);
        
        res.json({
            msg: 'Player ID updated successfully.',
            user: { 
                id: updatedUser._id,
                username: updatedUser.username,
                // email: updatedUser.email, // Only send if necessary for the response
                playerId: updatedUser.playerId,
                updatedAt: updatedUser.updatedAt
            }
        });

    } catch (err) {
        logger.error(`[${requestId}] PUT /api/profile/player-id - ❌ Error updating Player ID for User ID: ${authenticatedUserId}. Player ID was: '${playerId}'. Error: ${err.message}`, { stack: err.stack });
        
        if (err.name === 'ValidationError') {
            logger.warn(`[${requestId}] PUT /api/profile/player-id - Mongoose validation error:`, err.errors);
            return res.status(400).json({ msg: 'Validation error updating Player ID.', errors: err.errors });
        }
        
        if (err.name === 'CastError') {
             logger.warn(`[${requestId}] PUT /api/profile/player-id - Mongoose cast error: ${err.path} to ${err.kind} failed for value ${err.value}`);
            return res.status(400).json({ msg: `Invalid data format for ${err.path}.` });
        }

        res.status(500).json({ msg: 'Server error while updating Player ID.' });
    } finally {
        logger.info(`[${requestId}] PUT /api/profile/player-id - Finished processing request for User ID: ${authenticatedUserId}.`);
    }
});


// You can add other profile-related routes here, for example:
/**
 * @route   GET /api/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
    const authenticatedUserId = req.user ? req.user.id : null;
    const requestId = `req_profile_get_${Date.now()}`;
    logger.info(`[${requestId}] GET /api/profile - Received request. Authenticated User ID: ${authenticatedUserId}`);

    if (!authenticatedUserId) {
        logger.error(`[${requestId}] GET /api/profile - CRITICAL: User ID not found in req.user after authMiddleware.`);
        return res.status(401).json({ msg: 'User authentication failed or User ID missing.' });
    }

    try {
        // Exclude sensitive fields like password.
        // Also, if your User model has fields like 'friends', 'blockedUsers', you might want to populate them.
        const userProfile = await User.findById(authenticatedUserId).select('-password -verificationCode -resetPasswordToken -resetPasswordExpires'); 

        if (!userProfile) {
            logger.warn(`[${requestId}] GET /api/profile - User not found in database with ID: ${authenticatedUserId}.`);
            return res.status(404).json({ msg: 'User profile not found.' });
        }

        logger.info(`[${requestId}] GET /api/profile - ✅ Successfully fetched profile for User ID: ${userProfile._id}`);
        res.json(userProfile);

    } catch (err) {
        logger.error(`[${requestId}] GET /api/profile - ❌ Error fetching profile for User ID: ${authenticatedUserId}. Error: ${err.message}`, { stack: err.stack });
        res.status(500).json({ msg: 'Server error while fetching user profile.' });
    } finally {
        logger.info(`[${requestId}] GET /api/profile - Finished processing request for User ID: ${authenticatedUserId}.`);
    }
});


// Add more profile routes as needed (e.g., update profile details, profile picture, etc.)

module.exports = router;
