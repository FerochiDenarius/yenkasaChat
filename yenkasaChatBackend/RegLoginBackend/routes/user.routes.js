// user.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const Permission = require('../models/permissions.model');
const mongoose = require("mongoose");

// ⬇️ CORRECT upload imports (from utils/upload.js)
const { profileImageUpload, uploadFiles } = require('../utils/upload');

// ⬇️ Cloudinary import (required!)
const { cloudinary } = require('../config/cloudinary');

// --- Logger ---
const logger = {
    info: (m, ...a) => console.log(`[INFO] ${new Date().toISOString()} - ${m}`, ...a),
    warn: (m, ...a) => console.warn(`[WARN] ${new Date().toISOString()} - ${m}`, ...a),
    error: (m, ...a) => console.error(`[ERROR] ${new Date().toISOString()} - ${m}`, ...a),
    debug: (m, ...a) => console.debug(`[DEBUG] ${new Date().toISOString()} - ${m}`, ...a)
};

// ======================================================================
// GET ALL USERS
// ======================================================================
router.get('/', authMiddleware, async (req, res) => {
    const requestId = `req_get_users_${Date.now()}`;
    const userId = req.user?.id || req.user?._id;

    logger.info(`[${requestId}] GET / - Fetching all users`);

    try {
        const users = await User.find().select('-password').lean();
        logger.info(`[${requestId}] GET / - Found ${users.length} users`);
        res.status(200).json(users);

    } catch (err) {
        logger.error(`[${requestId}] ❌ Failed to fetch users: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

// ======================================================================
// PROFILE PICTURE UPLOAD
// ======================================================================
router.post('/profile-picture', authMiddleware, profileImageUpload, async (req, res) => {
    const userId = req.user?.id || req.user?._id;

    try {
        if (!req.file || !req.file.path) {
            return res.status(400).json({ error: "No image uploaded" });
        }

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "yenkasa/profile",
            width: 400,
            height: 400,
            crop: "fill",
            gravity: "face",
            quality: "auto:good",
            fetch_format: "auto"
        });

        const user = await User.findByIdAndUpdate(
            userId,
            { profileImage: result.secure_url },
            { new: true }
        ).select("-password");

        return res.json({
            success: true,
            message: "Profile image updated",
            imageUrl: user.profileImage
        });

    } catch (err) {
        console.error("❌ Profile picture upload error:", err);
        res.status(500).json({ error: "Failed to upload profile picture" });
    }
});

// ======================================================================
// GET /me (FULL USER PROFILE)
// ======================================================================
router.get('/me', authMiddleware, async (req, res) => {
    const requestId = `req_get_me_${Date.now()}`;
    const userId = req.user?.id || req.user?._id;

    logger.info(`[${requestId}] GET /me - User: ${userId}`);

    try {
        const user = await User.findById(userId)
            .select('-password -verificationCode -emailVerificationCode -refreshToken')
            .populate({ path: 'community', select: '_id name location membersCount' })
            .lean();

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let roleDoc = null;

        if (mongoose.isValidObjectId(user.role)) {
            roleDoc = await Permission.findById(user.role).lean();
        }

        if (!roleDoc) {
            const fallback = Permission.normalize(user.role || "user");
            roleDoc = await Permission.findOne({ role: fallback }).lean();
        }

        if (!roleDoc) {
            roleDoc = await Permission.findOne({ role: "user" }).lean();
        }

        const finalRole = {
            _id: roleDoc._id,
            role: roleDoc.role,
            description: roleDoc.description || null,
            permissions: {
                name: roleDoc.role,
                description: roleDoc.description || null,
                canPost: roleDoc.canPost || false,
                canApprovePost: roleDoc.canApprove || false,
                canSuspendUser: roleDoc.canSuspend || false,
                canAssignRoles: roleDoc.canAssignRoles || false,
                canRevokeAdmin: roleDoc.canRevoke || false
            }
        };

        const profile = {
            ...user,
            roleName: user.roleName || roleDoc.role,
            role: finalRole
        };

        res.status(200).json(profile);

    } catch (err) {
        logger.error(`[${requestId}] ❌ Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
});

// ======================================================================
// TOGGLE FOLLOW
// ======================================================================
router.post('/toggle-follow/:targetUserId', authMiddleware, async (req, res) => {
    const requestId = `req_toggle_follow_${Date.now()}`;
    const myId = req.user?.id || req.user?._id;
    const { targetUserId } = req.params;

    logger.info(`[${requestId}] Toggle follow -> ${myId} -> ${targetUserId}`);

    try {
        if (myId === targetUserId) {
            return res.status(400).json({ message: "You cannot follow yourself." });
        }

        const user = await User.findById(myId);
        const target = await User.findById(targetUserId);

        if (!user || !target) return res.status(404).json({ message: "User not found." });

        const already = user.following.some(id => id.toString() === targetUserId);

        if (already) {
            user.following = user.following.filter(id => id.toString() !== targetUserId);
            target.followers = target.followers.filter(id => id.toString() !== myId);

            user.followingCount--;
            target.followersCount--;

            await user.save();
            await target.save();

            return res.status(200).json({ message: "Unfollowed successfully", isFollowing: false });
        }

        // Follow
        user.following.push(targetUserId);
        target.followers.push(myId);
        user.followingCount++;
        target.followersCount++;

        await user.save();
        await target.save();

        return res.status(200).json({ message: "Followed successfully", isFollowing: true });

    } catch (err) {
        logger.error(`[${requestId}] ❌ Follow toggle error: ${err.message}`);
        res.status(500).json({ message: "Server error while toggling follow" });
    }
});

// ======================================================================
// FIX CONTACTS (ADMIN TOOL)
// ======================================================================
router.post('/fix-contacts', async (req, res) => {
    const requestId = `req_fix_contacts_${Date.now()}`;
    logger.info(`[${requestId}] Fixing user contacts`);

    try {
        const result = await User.updateMany(
            {},
            [{
                $set: {
                    email: { $toLower: { $trim: { input: "$email" } } },
                    phoneNumber: { $trim: { input: "$phoneNumber" } }
                }
            }]
        );

        res.json({
            success: true,
            message: 'Contacts normalized',
            matched: result.matchedCount,
            modified: result.modifiedCount
        });

    } catch (err) {
        logger.error(`[${requestId}] ❌ Fix contacts error: ${err.message}`);
        res.status(500).json({ error: 'Server error fixing users' });
    }
});

// ======================================================================
// UPDATE FCM TOKEN
// ======================================================================
router.patch('/:userId/fcm-token', authMiddleware, async (req, res) => {
    const requestId = `req_fcm_${Date.now()}`;
    const paramId = req.params.userId;
    const authId = (req.user?.id || req.user?._id)?.toString();
    const { fcmToken } = req.body;

    if (paramId !== authId) {
        return res.status(403).json({ error: 'Forbidden: Cannot update another user.' });
    }

    try {
        const updated = await User.findByIdAndUpdate(
            authId,
            { $set: { fcmToken, updatedAt: new Date() } },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: "User not found" });

        res.status(200).json({ message: 'FCM token updated', userId: updated._id });

    } catch (err) {
        logger.error(`[${requestId}] ❌ FCM error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save FCM token' });
    }
});

module.exports = router;
