// user.routes.js (assuming this is the correct filename based on content)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const { storage } = require('../config/cloudinary'); // Assuming Cloudinary setup

// --- Consistent Logger Function ---
const logger = {
    info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args),
    error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args),
    debug: (message, ...args) => console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args)
};
// --- End Logger Function ---

const upload = multer({ storage }); // Using Cloudinary storage

/**
 * @route   GET /api/users (Assuming this router is mounted at /api/users)
 * @desc    Get all users (excluding passwords)
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
    const requestId = `req_get_users_${Date.now()}`;
    const authenticatedUserId = req.user?.id || req.user?._id;

    logger.info(`[${requestId}] GET / - Request to fetch all users by User: ${authenticatedUserId}`);

    try {
        // .lean() is good for performance if you don't need Mongoose model instances
        const users = await User.find().select('-password').lean();
        logger.info(`[${requestId}] GET / - Successfully fetched ${users.length} users.`);
        res.status(200).json(users);
    } catch (err) {
        logger.error(`[${requestId}] GET / - ❌ Failed to fetch users. User: ${authenticatedUserId}. Error: ${err.message}`, { stack: err.stack });
        res.status(500).json({ error: 'Failed to retrieve users' });
    } finally {
        logger.info(`[${requestId}] GET / - Finished processing request by User: ${authenticatedUserId}`);
    }
});

/**
 * @route   POST /api/users/profile-picture
 * @desc    Upload profile picture to Cloudinary and save URL
 * @access  Private
 */
router.post('/profile-picture', authMiddleware, upload.single('profileImage'), async (req, res) => {
    const requestId = `req_upload_pp_${Date.now()}`;
    const authenticatedUserId = req.user?.id || req.user?._id;

    logger.info(`[${requestId}] POST /profile-picture - Request by User: ${authenticatedUserId}`);
    logger.debug(`[${requestId}] POST /profile-picture - Request file details:`, req.file); // Log file info
    logger.debug(`[${requestId}] POST /profile-picture - Request body (non-file parts):`, req.body);


    if (!authenticatedUserId) {
        // Should be caught by authMiddleware, but as a safeguard
        logger.error(`[${requestId}] POST /profile-picture - CRITICAL: User ID not found in req.user after authMiddleware.`);
        return res.status(401).json({ error: 'User authentication failed.' });
    }

    try {
        const user = await User.findById(authenticatedUserId);
        if (!user) {
            logger.warn(`[${requestId}] POST /profile-picture - User not found with ID: ${authenticatedUserId}.`);
            return res.status(404).json({ error: 'User not found' });
        }

        if (!req.file || !req.file.path) {
            logger.warn(`[${requestId}] POST /profile-picture - No image uploaded or upload failed for User: ${authenticatedUserId}. req.file is:`, req.file);
            return res.status(400).json({ error: 'No image uploaded or upload failed' });
        }

        logger.info(`[${requestId}] POST /profile-picture - File uploaded to Cloudinary. Path: ${req.file.path}. Updating user profileImage for User: ${authenticatedUserId}`);
        user.profileImage = req.file.path; // URL from Cloudinary storage
        user.updatedAt = new Date();
        await user.save();

        logger.info(`[${requestId}] POST /profile-picture - ✅ Profile image URL saved successfully for User: ${authenticatedUserId}. New URL: ${user.profileImage}`);
        res.status(200).json({
            message: 'Profile image uploaded successfully',
            imageUrl: user.profileImage,
        });
    } catch (err) {
        logger.error(`[${requestId}] POST /profile-picture - ❌ Image upload or DB save error for User: ${authenticatedUserId}. Error: ${err.message}`, { stack: err.stack, file: req.file });
        res.status(500).json({ error: 'Server error while uploading profile picture' });
    } finally {
        logger.info(`[${requestId}] POST /profile-picture - Finished processing request by User: ${authenticatedUserId}`);
    }
});

/**
 * @route   GET /api/users/me
 * @desc    Get logged-in user's profile (no password)
 * @access  Private
 */
router.get('/me', authMiddleware, async (req, res) => {
    const requestId = `req_get_me_${Date.now()}`;
    const authenticatedUserId = req.user?.id || req.user?._id;

    logger.info(`[${requestId}] GET /me - Request to fetch profile for User: ${authenticatedUserId}`);

    if (!authenticatedUserId) {
        logger.error(`[${requestId}] GET /me - CRITICAL: User ID not found in req.user after authMiddleware.`);
        return res.status(401).json({ error: 'User authentication failed.' });
    }

    try {
        const user = await User.findById(authenticatedUserId)
            .populate('community', 'name') // ✅ FIXED: populate community reference
            .select('-password')
            .lean();

        if (!user) {
            logger.warn(`[${requestId}] GET /me - User not found in DB with ID: ${authenticatedUserId}.`);
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info(`[${requestId}] GET /me - ✅ Successfully fetched profile for User: ${authenticatedUserId}`);
        res.status(200).json(user);
    } catch (err) {
        logger.error(`[${requestId}] GET /me - ❌ Failed to fetch profile for User: ${authenticatedUserId}. Error: ${err.message}`, { stack: err.stack });
        res.status(500).json({ error: 'Failed to retrieve user profile' });
    } finally {
        logger.info(`[${requestId}] GET /me - Finished processing request by User: ${authenticatedUserId}`);
    }
});


/**
 * @route   POST /api/users/fix-contacts
 * @desc    Fix user emails and phoneNumbers (lowercase, trimmed)
 * @access  Admin / Internal (No authMiddleware here, ensure this is intended and secured appropriately if exposed)
 */
router.post('/fix-contacts', async (req, res) => {
    const requestId = `req_fix_contacts_${Date.now()}`;
    // Consider adding IP logging or some form of requestor identification if this is an open internal tool
    logger.info(`[${requestId}] POST /fix-contacts - Request received to fix user contacts formatting.`);

    try {
        const result = await User.updateMany(
            {}, // Empty filter to update all documents
            [ // Using aggregation pipeline for updates
                {
                    $set: {
                        email: { $toLower: { $trim: { input: "$email" } } },
                        phoneNumber: { $trim: { input: "$phoneNumber" } }
                        // Consider adding updatedAt: new Date() here as well if you want to track this kind of mass update
                    }
                }
            ],
            { upsert: false } // Ensure no new documents are created
        );

        logger.info(`[${requestId}] POST /fix-contacts - ✅ Successfully processed fix-contacts. Documents matched: ${result.matchedCount}, Documents modified: ${result.modifiedCount}`);
        res.json({
            success: true,
            message: 'Fixed emails and phone numbers formatting for applicable users.',
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            acknowledged: result.acknowledged
        });
    } catch (err) {
        logger.error(`[${requestId}] POST /fix-contacts - ❌ Failed to fix user contacts. Error: ${err.message}`, { stack: err.stack });
        res.status(500).json({ error: 'Server error fixing users' });
    } finally {
        logger.info(`[${requestId}] POST /fix-contacts - Finished processing request.`);
    }
});

// PATCH /api/users/:userId/player-id
// **IMPORTANT**: This duplicates functionality likely present in other route files.
// Choose ONE place for this logic. Assuming this is the chosen one for this logging exercise.
router.patch('/:userId/player-id', authMiddleware, async (req, res) => {
    const { userId: paramUserId } = req.params;
    const { playerId: bodyPlayerId } = req.body; // This is the OneSignal Player ID value from Android

    const requestId = `req_user_playerid_${Date.now()}`;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString();

    logger.info(`[${requestId}] PATCH /${paramUserId}/player-id - Request received by Auth User: ${authenticatedUserId}`);
    logger.debug(`[${requestId}] PATCH /${paramUserId}/player-id - Request Params:`, req.params);
    logger.debug(`[${requestId}] PATCH /${paramUserId}/player-id - Request Body (payload):`, JSON.stringify(req.body));


    if (!authenticatedUserId) {
        logger.error(`[${requestId}] PATCH /${paramUserId}/player-id - CRITICAL: Authenticated User ID not found in req.user after authMiddleware.`);
        return res.status(401).json({ error: 'User authentication failed or User ID missing.' });
    }

    if (paramUserId !== authenticatedUserId) {
        logger.warn(`[${requestId}] PATCH /${paramUserId}/player-id - FORBIDDEN: Auth User ${authenticatedUserId} attempting to update Player ID for target User Param ${paramUserId}.`);
        return res.status(403).json({ error: 'Forbidden: You can only update your own player ID.' });
    }

    if (!bodyPlayerId || typeof bodyPlayerId !== 'string' || bodyPlayerId.trim() === '') {
        logger.warn(`[${requestId}] PATCH /${paramUserId}/player-id - VALIDATION FAILED: Invalid or missing 'playerId' in request body. Provided: "${bodyPlayerId}" by Auth User: ${authenticatedUserId}`);
        return res.status(400).json({ error: 'Invalid or missing player ID. It must be a non-empty string.' });
    }

    logger.info(`[${requestId}] PATCH /${paramUserId}/player-id - Attempting to update DB for User: ${paramUserId} with oneSignalPlayerId: '${bodyPlayerId}'`);

    try {
        const updatedUser = await User.findByIdAndUpdate(
            paramUserId, // User ID from URL parameter (already validated against authenticated user)
            { $set: { oneSignalPlayerId: bodyPlayerId, updatedAt: new Date() } }, // ** CRITICAL: Ensure 'oneSignalPlayerId' is the correct field in your User model **
            { new: true, runValidators: true } // Return updated doc, run schema validations
        );

        if (!updatedUser) {
            logger.warn(`[${requestId}] PATCH /${paramUserId}/player-id - User not found in DB with ID: ${paramUserId} for Player ID update.`);
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info(`[${requestId}] PATCH /${paramUserId}/player-id - ✅ Player ID ('oneSignalPlayerId') updated successfully for User: ${updatedUser._id} to '${updatedUser.oneSignalPlayerId}'`);
        res.status(200).json({
            message: 'Player ID updated successfully',
            userId: updatedUser._id,
            oneSignalPlayerId: updatedUser.oneSignalPlayerId // Confirm the updated value
        });
    } catch (err) {
        logger.error(`[${requestId}] PATCH /${paramUserId}/player-id - ❌ Error updating 'oneSignalPlayerId' for User: ${paramUserId} with value '${bodyPlayerId}'. Error: ${err.message}`, { stack: err.stack });
        if (err.name === 'ValidationError') {
            logger.warn(`[${requestId}] Mongoose validation error:`, err.errors);
            return res.status(400).json({ error: 'Validation error updating Player ID.', errors: err.errors });
        }
        if (err.name === 'CastError') {
             logger.warn(`[${requestId}] Mongoose cast error: ${err.path} to ${err.kind} failed for value ${err.value}`);
            return res.status(400).json({ error: `Invalid data format for ${err.path}.` });
        }
        res.status(500).json({ error: 'Failed to save Player ID due to server error' });
    } finally {
        logger.info(`[${requestId}] PATCH /${paramUserId}/player-id - Finished processing request by Auth User: ${authenticatedUserId}`);
    }
});

/**
 * @route   PATCH /api/users/:userId/fcm-token
 * @desc    Update user's FCM token (legacy if needed)
 * @access  Private
 */
router.patch('/:userId/fcm-token', authMiddleware, async (req, res) => {
    const { userId: paramUserId } = req.params;
    const { fcmToken } = req.body; // FCM token from request body

    const requestId = `req_user_fcmtoken_${Date.now()}`;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString();

    logger.info(`[${requestId}] PATCH /${paramUserId}/fcm-token - Request received by Auth User: ${authenticatedUserId}`);
    logger.debug(`[${requestId}] PATCH /${paramUserId}/fcm-token - Request Params:`, req.params);
    logger.debug(`[${requestId}] PATCH /${paramUserId}/fcm-token - Request Body (payload):`, JSON.stringify(req.body));


    if (!authenticatedUserId) {
        logger.error(`[${requestId}] PATCH /${paramUserId}/fcm-token - CRITICAL: Authenticated User ID not found in req.user.`);
        return res.status(401).json({ error: 'User authentication failed.' });
    }

    if (paramUserId !== authenticatedUserId) {
        logger.warn(`[${requestId}] PATCH /${paramUserId}/fcm-token - FORBIDDEN: Auth User ${authenticatedUserId} attempting to update FCM token for target User Param ${paramUserId}.`);
        return res.status(403).json({ error: 'Forbidden: You can only update your own FCM token.' });
    }

    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim() === '') {
        logger.warn(`[${requestId}] PATCH /${paramUserId}/fcm-token - VALIDATION FAILED: Invalid or missing 'fcmToken' in request body. Provided: "${fcmToken}" by Auth User: ${authenticatedUserId}`);
        return res.status(400).json({ error: 'Invalid or missing FCM token. It must be a non-empty string.' });
    }

    logger.info(`[${requestId}] PATCH /${paramUserId}/fcm-token - Attempting to update DB for User: ${paramUserId} with fcmToken: '${fcmToken.substring(0, 15)}...'`); // Log truncated token

    try {
        const updatedUser = await User.findByIdAndUpdate(
            paramUserId,
            { $set: { fcmToken: fcmToken, updatedAt: new Date() } }, // Ensure 'fcmToken' is the correct field in your User model
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            logger.warn(`[${requestId}] PATCH /${paramUserId}/fcm-token - User not found in DB with ID: ${paramUserId} for FCM token update.`);
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info(`[${requestId}] PATCH /${paramUserId}/fcm-token - ✅ FCM token updated successfully for User: ${updatedUser._id}.`);
        // Typically a 204 (No Content) is fine for updates if not returning the full object,
        // or 200 with a success message/partial data.
        res.status(200).json({ message: 'FCM token updated successfully', userId: updatedUser._id });
        // Or res.sendStatus(204); if you don't need to send a body

    } catch (err) {
        logger.error(`[${requestId}] PATCH /${paramUserId}/fcm-token - ❌ Error updating FCM token for User: ${paramUserId}. Error: ${err.message}`, { stack: err.stack });
        if (err.name === 'ValidationError') {
            logger.warn(`[${requestId}] Mongoose validation error for FCM token:`, err.errors);
            return res.status(400).json({ error: 'Validation error updating FCM token.', errors: err.errors });
        }
        res.status(500).json({ error: 'Failed to save FCM token due to server error' });
    } finally {
        logger.info(`[${requestId}] PATCH /${paramUserId}/fcm-token - Finished processing request by Auth User: ${authenticatedUserId}`);
    }
});

module.exports = router;
