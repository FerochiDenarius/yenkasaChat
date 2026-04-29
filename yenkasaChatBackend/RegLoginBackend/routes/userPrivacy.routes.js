const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");  // <-- ADD THIS
const auth = require("../middleware/auth");
const UserPrivacy = require("../models/userPrivacy.model");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");
const Community = require("../models/community.model");
const {
    VALID_PRIVACY_LEVELS,
    approveMessageUser,
    canMessageUser,
    ensurePrivacy,
    hasId
} = require("../services/privacy.service");


// ────────────────────────────────────────────
// GET CURRENT PRIVACY LEVEL
// ────────────────────────────────────────────
router.get("/get", auth, async (req, res) => {
    try {
        const doc = await ensurePrivacy(req.user.id);
        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// SET PRIVACY LEVEL
// ────────────────────────────────────────────
router.put("/set-privacy", auth, async (req, res) => {
    try {
        const privacyLevel = req.query.privacyLevel || req.body?.privacyLevel;

        if (!VALID_PRIVACY_LEVELS.has(privacyLevel)) {
            return res.status(400).json({ message: "Invalid privacy level" });
        }

        const doc = await ensurePrivacy(req.user.id);

        doc.privacyLevel = privacyLevel;
        await doc.save();

        res.json({ message: "Privacy updated" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// BLOCK USER (FINAL VERSION)
// ────────────────────────────────────────────
router.post("/block", auth, async (req, res) => {
    try {
        const targetId = req.body.targetId || req.body.blockedUserId;
        const userId = req.user.id;

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "targetId is required" });
        }

        // ❌ Cannot block yourself
        if (targetId === userId) {
            return res.status(400).json({ message: "You cannot block yourself" });
        }

        const targetUser = await User.findById(targetId).select("_id");
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const doc = await ensurePrivacy(userId);

        const alreadyBlocked = hasId(doc.blockedUsers, targetId);
        if (alreadyBlocked) {
            return res.status(400).json({ message: "User is already blocked" });
        }

        // Add to block list
        doc.blockedUsers.push(targetId);
        doc.approvedMessageUsers = doc.approvedMessageUsers.filter(id => id.toString() !== targetId);
        await doc.save();

        await UserPrivacy.updateOne(
            { userId: targetId },
            { $pull: { approvedMessageUsers: userId } }
        );

        await Notification.deleteMany({
            type: { $in: ["message_request", "message_request_approved"] },
            $or: [
                { senderId: userId, receiverId: targetId },
                { senderId: targetId, receiverId: userId }
            ]
        });

        return res.json({ success: true, message: "User blocked" });

    } catch (err) {
        console.error("BLOCK ROUTE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// ────────────────────────────────────────────
// UNBLOCK USER (FIXED & UPGRADED)
// ────────────────────────────────────────────
router.post("/unblock", auth, async (req, res) => {
    try {
        const targetId = req.body.targetId || req.body.blockedUserId;
        const userId = req.user.id;

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "targetId is required" });
        }

        const doc = await ensurePrivacy(userId);

        // Check if already unblocked
        const wasBlocked = hasId(doc.blockedUsers, targetId);

        if (!wasBlocked) {
            return res.status(400).json({ message: "User is not blocked" });
        }

        // Remove from blocked list
        doc.blockedUsers = doc.blockedUsers.filter(id => id.toString() !== targetId);
        await doc.save();

        const targetUser = await User.findById(targetId)
            .select("_id username profileImage role");

        return res.json({
            success: true,
            message: "User unblocked",
            user: targetUser ? {
                userId: targetUser._id,
                username: targetUser.username,
                avatar: targetUser.profileImage,
                roleName: targetUser.role?.name ?? "user"
            } : null
        });

    } catch (err) {
        console.error("UNBLOCK ROUTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
});



// ────────────────────────────────────────────
// GET USERS YOU BLOCKED (FULL USER OBJECTS)
// ────────────────────────────────────────────
router.get("/blocked-users", auth, async (req, res) => {
    try {
        const doc = await ensurePrivacy(req.user.id);

        const users = await User.find({
            _id: { $in: doc.blockedUsers }
        })
        .select("_id username profileImage bio verified roleName role")
        .lean();

        const blockedUsers = users.map(user => ({
            userId: user._id.toString(),
            username: user.username,
            profileImage: user.profileImage,
            bio: user.bio,
            verified: user.verified,
            roleName: user.roleName || user.role?.name || "user",
            dateBlocked: doc.updatedAt || null
        }));

        res.json(blockedUsers);

    } catch (err) {
        console.error("GET BLOCKED USERS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// GET USERS WHO BLOCKED YOU  (FULL USER OBJECTS)
// ────────────────────────────────────────────
router.get("/who-blocked-you", auth, async (req, res) => {
    try {
        // Find all privacy docs where YOU appear in their blockedUsers list
        const docs = await UserPrivacy.find({
            blockedUsers: req.user.id
        }).select("userId updatedAt");

        const ids = docs.map(d => d.userId);

        // Load full user profiles
        const users = await User.find({ _id: { $in: ids } })
            .select("_id username profileImage role roleName");

        // Merge dateBlocked
        const result = users.map(user => {
            const doc = docs.find(d => d.userId.toString() === user._id.toString());
            return {
                userId: user._id,
                username: user.username,
                avatar: user.profileImage,
                roleName: user.roleName || user.role?.name || "user",
                dateBlocked: doc?.updatedAt ?? null
            };
        });

        res.json(result);

    } catch (err) {
        console.error("ERROR /who-blocked-you:", err);
        res.status(500).json({ message: "Server error" });
    }
});



// ────────────────────────────────────────────
// SEND MESSAGE REQUEST
// ────────────────────────────────────────────
router.post("/message-request", auth, async (req, res) => {
    try {
        const { receiverId } = req.body;

        if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({ allowed: false, message: "receiverId is required" });
        }

        if (receiverId === req.user.id) {
            return res.status(400).json({ allowed: false, message: "You cannot message yourself" });
        }

        const receiver = await User.findById(receiverId).select("_id");
        if (!receiver) {
            return res.status(404).json({ allowed: false, message: "User not found" });
        }

        const permission = await canMessageUser(req.user.id, receiverId);

        if (permission.allowed) {
            return res.json({ allowed: true, message: "Open chat immediately" });
        }

        if (permission.reason === "blocked") {
            return res.status(403).json({ allowed: false, message: "Unable to send message request" });
        }

        if (permission.reason === "not_accepting") {
            return res.json({ allowed: false, message: "User does not accept messages" });
        }

        // requires approval → create notification request
        await Notification.findOneAndUpdate(
            {
                type: "message_request",
                senderId: req.user.id,
                receiverId,
                status: "unread"
            },
            {
                $setOnInsert: {
                    type: "message_request",
                    senderId: req.user.id,
                    receiverId,
                    message: "wants to message you",
                    activityId: req.user.id,
                    targetType: "profile",
                    targetId: req.user.id,
                    createdAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        res.json({ allowed: false, message: "Request sent" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// APPROVE MESSAGE REQUEST
// ────────────────────────────────────────────
router.post("/approve-request", auth, async (req, res) => {
    try {
        const requestId = req.body?.requestId || req.query?.requestId;
        let senderId = req.body?.senderId || req.query?.senderId;

        let request = null;
        if (requestId && mongoose.Types.ObjectId.isValid(requestId)) {
            request = await Notification.findOne({
                _id: requestId,
                receiverId: req.user.id,
                type: "message_request"
            });
            senderId = senderId || request?.senderId?.toString();
        }

        if (!senderId || !mongoose.Types.ObjectId.isValid(senderId)) {
            return res.status(400).json({ message: "senderId or valid requestId is required" });
        }

        await approveMessageUser(req.user.id, senderId);

        if (request?._id) {
            await Notification.findByIdAndUpdate(request._id, {
                status: "read",
                readAt: new Date()
            });
        }

        await Notification.create({
            type: "message_request_approved",
            senderId: req.user.id,
            receiverId: senderId,
            message: "approved your message request",
            activityId: req.user.id,
            targetType: "profile",
            targetId: req.user.id
            
        });

        res.json({ message: "Approved" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// BLOCK COMMUNITY FROM SEEING POSTS
// ────────────────────────────────────────────
router.post("/block-community", auth, async (req, res) => {
    try {
        const { communityId } = req.body;
        if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
            return res.status(400).json({ message: "Valid communityId is required" });
        }

        const doc = await ensurePrivacy(req.user.id);

        if (!hasId(doc.blockedCommunities, communityId)) {
            doc.blockedCommunities.push(communityId);
            await doc.save();
        }

        res.json({ message: "Community blocked" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// UNBLOCK COMMUNITY
// ────────────────────────────────────────────
router.post("/unblock-community", auth, async (req, res) => {
    try {
        const { communityId } = req.body;
        if (!communityId || !mongoose.Types.ObjectId.isValid(communityId)) {
            return res.status(400).json({ message: "Valid communityId is required" });
        }

        const doc = await ensurePrivacy(req.user.id);

        doc.blockedCommunities = doc.blockedCommunities.filter(id => id.toString() !== communityId);
        await doc.save();

        res.json({ message: "Community unblocked" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// GET COMMUNITY VISIBILITY LIST
// ────────────────────────────────────────────
router.get("/community-visibility", auth, async (req, res) => {
    try {
        const doc = await ensurePrivacy(req.user.id);
        const country = req.user.country || "Ghana";
        const countryFilter = { country: new RegExp(`^${country}$`, "i") };

        const communities = await Community.find({
            isActive: true,
            isApproved: true,
            ...countryFilter
        })
            .select("displayName name")
            .lean();

        const merged = communities.map(c => {
            const setting = doc.visibilitySettings.find(v =>
                v.communityId.toString() === c._id.toString()
            );

            return {
                communityId: c._id,
                communityName: c.displayName || c.name,
                blockUsers: setting ? setting.blockUsers : false,
                exceptFollowers: setting ? setting.exceptFollowers : false
            };
        });

        res.json(merged);

    } catch (err) {
        console.error("LOAD COMMUNITY VISIBILITY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// post COMMUNITY VISIBILITY LIST
// ────────────────────────────────────────────

router.post("/community-visibility", auth, async (req, res) => {
    try {
        const { visibility } = req.body; // array of { communityId, blockUsers, exceptFollowers }

        const doc = await ensurePrivacy(req.user.id);

        // overwrite existing settings
        doc.visibilitySettings = visibility;

        await doc.save();

        res.json({ success: true, message: "Visibility updated" });

    } catch (err) {
        console.error("SAVE COMMUNITY VISIBILITY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// ────────────────────────────────────────────
// HIDE USER FROM SEEING POSTS
// ────────────────────────────────────────────
router.post("/hide-user", auth, async (req, res) => {
    try {
        const { targetId } = req.body;
        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "targetId is required" });
        }

        const doc = await ensurePrivacy(req.user.id);

        if (!hasId(doc.hiddenUsers, targetId)) {
            doc.hiddenUsers.push(targetId);
            await doc.save();
        }

        res.json({ message: "User hidden from posts" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ────────────────────────────────────────────
// UNHIDE USER
// ────────────────────────────────────────────
router.post("/unhide-user", auth, async (req, res) => {
    try {
        const { targetId } = req.body;
        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "targetId is required" });
        }

        const doc = await ensurePrivacy(req.user.id);

        doc.hiddenUsers = doc.hiddenUsers.filter(id => id.toString() !== targetId);
        await doc.save();

        res.json({ message: "User unhidden" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});



// ────────────────────────────────────────────
// GET USERS YOU HID FROM POSTS
// ────────────────────────────────────────────
router.get("/hidden-users", auth, async (req, res) => {
    try {
        const doc = await ensurePrivacy(req.user.id);
        res.json(doc.hiddenUsers);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
