const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");  // <-- ADD THIS
const auth = require("../middleware/auth");
const UserPrivacy = require("../models/userPrivacy.model");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");


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
// BLOCK USER
// ────────────────────────────────────────────
router.post("/block", auth, async (req, res) => {
    try {
        const { targetId } = req.body;

        const doc = await ensurePrivacy(req.user.id);

        const objectId = new mongoose.Types.ObjectId(targetId);

        if (!doc.blockedUsers.some(id => id.toString() === targetId)) {
            doc.blockedUsers.push(objectId);
            await doc.save();
        }

        // 🔔 SEND BLOCK NOTIFICATION — THIS IS WHERE IT BELONGS
        await Notification.create({
            type: "blocked",
            senderId: req.user.id,
            receiverId: objectId,
            message: "You have been blocked",
            activityId: targetId
        });

        res.json({ message: "User blocked" });

    } catch (err) {
        console.error("BLOCK ROUTE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// ────────────────────────────────────────────
// UNBLOCK USER
// ────────────────────────────────────────────
router.post("/unblock", auth, async (req, res) => {
    try {
        const { targetId } = req.body;
        const userId = req.user.id;

        const doc = await ensurePrivacy(userId);
        doc.blockedUsers = doc.blockedUsers.filter(id => id != targetId);
        await doc.save();

        const targetUser = await User.findById(targetId)
            .select("_id username profileImage role");

        res.json({
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
        res.status(500).json({ message: "Server error" });
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
            activityId: req.user.id
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
            activityId: senderId
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

        // frontend already has community list → just send blocked
        res.json(doc.blockedCommunities);

    } catch (err) {
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
