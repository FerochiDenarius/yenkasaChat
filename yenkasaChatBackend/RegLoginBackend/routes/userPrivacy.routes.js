const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");  // <-- ADD THIS
const auth = require("../middleware/auth");
const UserPrivacy = require("../models/userPrivacy.model");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");
const Community = require("../models/community.model");


// ensure privacy doc
async function ensurePrivacy(userId) {
    let doc = await UserPrivacy.findOne({ userId });
    if (!doc) doc = await UserPrivacy.create({ userId });
    return doc;
}

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
        const { privacyLevel } = req.query;
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
        const { targetId } = req.body;
        const userId = req.user.id;

        if (!targetId) {
            return res.status(400).json({ message: "targetId is required" });
        }

        // ❌ Cannot block yourself
        if (targetId === userId) {
            return res.status(400).json({ message: "You cannot block yourself" });
        }

        const doc = await ensurePrivacy(userId);

        const alreadyBlocked = doc.blockedUsers.some(id => id.toString() === targetId);
        if (alreadyBlocked) {
            return res.status(400).json({ message: "User is already blocked" });
        }

        // Add to block list
        doc.blockedUsers.push(targetId);
        await doc.save();

        // 🔔 BLOCK NOTIFICATION
        await Notification.create({
            type: "blocked",
            senderId: userId,
            receiverId: targetId,
            message: "has blocked you",
            activityId: `block_${userId}_${targetId}_${Date.now()}`,
            targetType: "profile",
            targetId: userId     // open the blocker’s profile
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
        const { targetId } = req.body;
        const userId = req.user.id;

        if (!targetId) {
            return res.status(400).json({ message: "targetId is required" });
        }

        const doc = await ensurePrivacy(userId);

        // Check if already unblocked
        const wasBlocked = doc.blockedUsers.some(id => id.toString() === targetId);

        if (!wasBlocked) {
            return res.status(400).json({ message: "User is not blocked" });
        }

        // Remove from blocked list
        doc.blockedUsers = doc.blockedUsers.filter(id => id.toString() !== targetId);
        await doc.save();

        const targetUser = await User.findById(targetId)
            .select("_id username profileImage role");

        // 🔔 SEND UNBLOCK NOTIFICATION
        await Notification.create({
            type: "unblocked",
            senderId: userId,               // the one doing the unblock
            receiverId: targetId,           // the one being unblocked
            message: "has unblocked you",
            activityId: `unblock_${userId}_${targetId}_${Date.now()}`,
            targetType: "profile",
            targetId: userId                // open the unblocker’s profile
        });

        return res.json({
            success: true,
            message: "User unblocked",
            user: {
                userId: targetUser._id,
                username: targetUser.username,
                avatar: targetUser.profileImage,
                roleName: targetUser.role?.name ?? "user"
            }
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

        // Populate user details based on doc.blockedUsers array
        const blockedUsers = await User.find({
            _id: { $in: doc.blockedUsers }
        })
        .select("_id username profileImage bio verified")  // tidy, safe fields
        .lean();

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

        const doc = await ensurePrivacy(receiverId);

        if (doc.privacyLevel === "nobody") {
            return res.json({ allowed: false, message: "User does not accept messages" });
        }

        if (doc.privacyLevel === "everyone") {
            return res.json({ allowed: true, message: "Open chat immediately" });
        }

        // requires approval → create notification request
        await Notification.create({
            type: "message_request",
            senderId: req.user.id,
            receiverId,
            message: "wants to message you",
            activityId: req.user.id,
             targetType: "profile",
             targetId: req.user.id
        });

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
        const { requestId, senderId } = req.body;

        await Notification.findByIdAndUpdate(requestId, { status: "read" });

        await Notification.create({
            type: "message_request_approved",
            senderId: req.user.id,
            receiverId: senderId,
            message: "approved your message request",
            activityId: senderId,
             targetType: "profile",
            targetId: senderId
            
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
        const doc = await ensurePrivacy(req.user.id);

        if (!doc.blockedCommunities.includes(communityId)) {
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
        const doc = await ensurePrivacy(req.user.id);

        doc.blockedCommunities = doc.blockedCommunities.filter(id => id != communityId);
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
        const countryFilter = country.toLowerCase() === "ghana"
            ? { $or: [{ country: new RegExp(`^${country}$`, "i") }, { country: { $in: [null, ""] } }] }
            : { country: new RegExp(`^${country}$`, "i") };

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
        const doc = await ensurePrivacy(req.user.id);

        if (!doc.hiddenUsers.includes(targetId)) {
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
        const doc = await ensurePrivacy(req.user.id);

        doc.hiddenUsers = doc.hiddenUsers.filter(id => id != targetId);
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
