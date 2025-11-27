const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Notification = require("../models/notifications.model");

// ─────────────────────────────────────────────
// CREATE a new notification
// This will be called from posts, likes, comments, follow, etc.
// ─────────────────────────────────────────────
router.post("/create", auth, async (req, res) => {
    try {
        const { type, senderId, receiverId, activityId, message } = req.body;

        if (!type || !senderId || !receiverId || !message) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const notification = await Notification.create({
            type,
            senderId,
            receiverId,
            activityId,
            message
        });

        return res.status(201).json(notification);

    } catch (err) {
        console.error("NOTIFICATION CREATE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET all notifications for logged-in user
// ─────────────────────────────────────────────
router.get("/all", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const notifications = await Notification.find({ receiverId: userId })
            .sort({ createdAt: -1 });

        return res.json(notifications);

    } catch (err) {
        console.error("NOTIFICATION FETCH ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// MARK a notification as read
// example: PUT /api/notifications/read?id=abc123
// ─────────────────────────────────────────────
router.put("/read", auth, async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ message: "Missing notification id" });

        await Notification.findByIdAndUpdate(id, { status: "read" });

        return res.json({ message: "Marked as read" });

    } catch (err) {
        console.error("NOTIFICATION READ ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// MARK ALL notifications as read
// ─────────────────────────────────────────────
router.put("/read-all", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        await Notification.updateMany(
            { receiverId: userId },
            { status: "read" }
        );

        return res.json({ message: "All notifications marked as read" });

    } catch (err) {
        console.error("NOTIFICATION READ ALL ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
