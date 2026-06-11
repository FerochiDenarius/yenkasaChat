// user.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const Permission = require('../models/permissions.model');
const mongoose = require("mongoose");

// ⬇️ CORRECT upload imports (from utils/upload.js)
const { profileImageUpload, uploadFiles } = require('../utils/upload');

const { logUploadAudit } = require('../utils/cloudinaryMedia');
const mediaStorage = require('../services/mediaStorage.service');
const {
    auditSecurityEvent,
    createMemoryRateLimiter,
    normalizeRoleKey: normalizeSecurityRoleKey,
    requireRoles
} = require('../utils/securityAudit');

// --- Logger ---
const logger = {
    info: (m, ...a) => console.log(`[INFO] ${new Date().toISOString()} - ${m}`, ...a),
    warn: (m, ...a) => console.warn(`[WARN] ${new Date().toISOString()} - ${m}`, ...a),
    error: (m, ...a) => console.error(`[ERROR] ${new Date().toISOString()} - ${m}`, ...a),
    debug: (m, ...a) => console.debug(`[DEBUG] ${new Date().toISOString()} - ${m}`, ...a)
};

const STAFF_ROLES = new Set(['moderator', 'admin', 'junior_developer', 'senior_developer']);
const MAINTENANCE_ROLES = ['admin', 'senior_developer'];
const maintenanceLimiter = createMemoryRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 3,
    label: 'user_maintenance'
});
const PUBLIC_ROLE_PRIORITY = [
    'campus_influencer',
    'premium_seller',
    'business_account',
    'brand_ambassador',
    'top_vendor',
    'legend',
    'rising_star',
    'verified_creator'
];
const PERMISSION_ROLE_FALLBACK = {
    verified_creator: 'verified',
    top_vendor: 'verified',
    business_account: 'legend',
    premium_seller: 'legend',
    campus_influencer: 'legend',
    brand_ambassador: 'legend'
};

function normalizeRoleKey(role) {
    return String(role || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

function getEffectiveRoleName(user) {
    const staffRole = normalizeRoleKey(user.staffRole);
    if (STAFF_ROLES.has(staffRole)) return staffRole;

    const publicRoles = new Set((user.publicRoles || []).map(normalizeRoleKey));
    const publicRole = PUBLIC_ROLE_PRIORITY.find(role => publicRoles.has(role));
    if (publicRole) return publicRole;

    return normalizeRoleKey(user.roleName || user.accessRole || user.role?.role || user.role) || 'unverified';
}

function getPermissionLookupRole(roleName) {
    return PERMISSION_ROLE_FALLBACK[roleName] || roleName || 'unverified';
}

function safePublicRoleName(user) {
    const roleName = normalizeSecurityRoleKey(user.roleName);
    if (PUBLIC_ROLE_PRIORITY.includes(roleName)) return roleName;
    return user.verified ? 'verified' : 'user';
}

function toPublicUser(user) {
    return {
        _id: user._id,
        username: user.username,
        profileImage: user.profileImage || '',
        verified: Boolean(user.verified),
        bio: user.bio || '',
        location: user.location || '',
        roleName: safePublicRoleName(user),
        followersCount: Number(user.followersCount || 0),
        followingCount: Number(user.followingCount || 0),
        online: Boolean(user.online),
        lastSeen: user.lastSeen || null
    };
}

function escapedRegex(value) {
    return new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

// ======================================================================
// GET USERS (SAFE PUBLIC FIELDS ONLY)
// ======================================================================
router.get('/', authMiddleware, async (req, res) => {
    const requestId = `req_get_users_${Date.now()}`;
    const userId = req.user?.id || req.user?._id;

    logger.info(`[${requestId}] GET / - Fetching public users page`);

    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
        const filter = q.length >= 2
            ? {
                $or: [
                    { username: escapedRegex(q) },
                    { bio: escapedRegex(q) },
                    { location: escapedRegex(q) }
                ]
            }
            : {};

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('_id username profileImage verified bio location roleName followersCount followingCount online lastSeen createdAt')
                .sort({ verified: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        const publicUsers = users.map(toPublicUser);
        res.set('X-Total-Count', String(total));
        res.set('X-Page', String(page));
        res.set('X-Limit', String(limit));

        logger.info(`[${requestId}] GET / - Returned ${publicUsers.length}/${total} safe public users for ${userId}`);

        if (req.query.includePagination === 'true' || req.query.format === 'page') {
            return res.status(200).json({
                success: true,
                users: publicUsers,
                pagination: {
                    page,
                    limit,
                    total,
                    hasMore: page * limit < total
                }
            });
        }

        return res.status(200).json(publicUsers);

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
        if (!req.file || (!req.file.path && !req.file.buffer)) {
            return res.status(400).json({ error: "No image uploaded" });
        }

        const result = await mediaStorage.upload(req.file, {
            folder: "profiles",
            type: "image",
            area: "profile_image",
            cloudinary: {
                width: 400,
                height: 400,
                crop: "fill",
                gravity: "face",
                quality: "auto:good",
                fetch_format: "auto"
            }
        });
        logUploadAudit({ area: "profile_image", file: req.file, result });

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
            .select('-password -refreshToken -verificationCode -emailVerificationCode -phoneVerificationCode -passwordResetToken -passwordResetExpires')
            .populate({ path: 'community', select: '_id name location membersCount' })
            .lean();

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let roleDoc = null;

        const effectiveRoleName = getEffectiveRoleName(user);
        const permissionLookupRole = getPermissionLookupRole(effectiveRoleName);

        const fallback = Permission.normalize(permissionLookupRole || user.role || "user");
        roleDoc = await Permission.findOne({ role: fallback }).lean();

        if (!roleDoc) {
            roleDoc = await Permission.findOne({ role: getPermissionLookupRole(effectiveRoleName) }).lean();
        }

        if (!roleDoc && mongoose.isValidObjectId(user.role)) {
            roleDoc = await Permission.findById(user.role).lean();
        }

        if (!roleDoc) {
            roleDoc = await Permission.findOne({ role: "unverified" }).lean();
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

        const preciseCoinsBalance = Number(user.coinsBalance ?? user.ykcBalance ?? 0);
        const preciseYkcBalance = Number(user.ykcBalance ?? preciseCoinsBalance);
        const userAgent = req.get("user-agent") || "";
        const isAndroidClient = /okhttp|android/i.test(userAgent) && !/mozilla/i.test(userAgent);

        const profile = {
            ...user,
            // Keep older Android builds from crashing on decimal balances while
            // exposing the precise value for current clients.
            coinsBalance: isAndroidClient ? Math.floor(preciseCoinsBalance) : preciseCoinsBalance,
            coinsBalancePrecise: preciseCoinsBalance,
            ykcBalance: preciseYkcBalance,
            roleName: effectiveRoleName,
            accessRole: user.accessRole || effectiveRoleName.toUpperCase(),
            staffRole: user.staffRole || null,
            publicRoles: user.publicRoles || [],
            role: finalRole
        };

        res.status(200).json(profile);

    } catch (err) {
        logger.error(`[${requestId}] ❌ Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
});

// ======================================================================
// ONESIGNAL PLAYER ID
// ======================================================================
router.patch('/:userId/player-id', authMiddleware, async (req, res) => {
    const requestId = `req_patch_player_id_${Date.now()}`;
    const authenticatedUserId = (req.user?.id || req.user?._id)?.toString();
    const { userId } = req.params;
    const { playerId } = req.body;

    logger.info(`[${requestId}] PATCH /:userId/player-id - Authenticated user: ${authenticatedUserId}, target user: ${userId}`);

    if (!authenticatedUserId) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    if (authenticatedUserId !== userId.toString()) {
        return res.status(403).json({ success: false, message: "You can only update your own player ID." });
    }

    if (!playerId || typeof playerId !== "string" || !playerId.trim()) {
        return res.status(400).json({ success: false, message: "Valid playerId is required." });
    }

    try {
        const trimmedPlayerId = playerId.trim();
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    playerId: trimmedPlayerId,
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: true }
        ).select("_id username playerId");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        logger.info(`[${requestId}] ✅ Player ID updated for user ${user._id}.`);
        res.status(200).json({
            success: true,
            message: "Player ID updated successfully.",
            user: {
                id: user._id,
                username: user.username,
                playerId: user.playerId
            }
        });
    } catch (err) {
        logger.error(`[${requestId}] ❌ Failed to update player ID for ${userId}: ${err.message}`);
        res.status(500).json({ success: false, message: "Failed to update player ID." });
    }
});

// ======================================================================
// USER PRESENCE
// ======================================================================
router.get('/:userId/presence', authMiddleware, async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
        const user = await User.findById(userId)
            .select('_id username online lastSeen')
            .lean();

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({
            userId: user._id,
            username: user.username,
            isOnline: user.online || false,
            online: user.online || false,
            lastSeen: user.lastSeen || null,
            statusText: user.online ? "Online" : "Offline"
        });
    } catch (err) {
        logger.error(`❌ Presence lookup failed for ${userId}: ${err.message}`);
        res.status(500).json({ error: "Failed to retrieve user presence" });
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
router.post(
  '/fix-contacts',
  authMiddleware,
  maintenanceLimiter,
  requireRoles(MAINTENANCE_ROLES, { label: 'fix_contacts' }),
  async (req, res) => {
    const requestId = `req_fix_contacts_${Date.now()}`;
    logger.info(`[${requestId}] Fixing user contacts`);
    auditSecurityEvent('maintenance_fix_contacts_started', req);

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

        auditSecurityEvent('maintenance_fix_contacts_completed', req, {
            matched: result.matchedCount,
            modified: result.modifiedCount
        });

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
  }
);

// ======================================================================
// UPDATE USER PROFILE
// ======================================================================
router.put('/profile', authMiddleware, async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const updates = {};
    const allowedFields = [
      "username",
      "email",
      "phoneNumber",
      "location",
      "gender",
      "dateOfBirth",
      "preferredLanguage"
    ];

    allowedFields.forEach(field => {
      const value = req.body[field];

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed !== "") {
          updates[field] = trimmed;
        }
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password -refreshToken -emailVerificationCode -verificationCode -phoneVerificationCode -passwordResetToken -passwordResetExpires");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated",
      user: updatedUser
    });

  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});

// ======================================================================
// CHANGE PASSWORD
// ======================================================================
router.put('/change-password', authMiddleware, async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const { oldPassword, newPassword } = req.body;

  try {
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Both passwords required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password too short" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect current password" });
    }

    user.password = newPassword; // pre-save hook hashes it

    const savedUser = await user.save();

    if (!savedUser) {
      return res.status(500).json({ error: "Password update failed" });
    }

    return res.status(200).json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (err) {
    console.error("❌ Change password error:", err);
    return res.status(500).json({
      error: "Internal server error while updating password"
    });
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
