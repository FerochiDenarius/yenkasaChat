// routes/notifications.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");

// helper - compute targetUrl from type/activityId (update to match your app routes)
function computeTarget(notification) {
  const { type, activityId, targetType, targetId } = notification;
  // Basic examples; update to match your mobile routes:
  if (targetType && targetId) {
    if (targetType === "post") return `/post/${targetId}`;
    if (targetType === "approval") return `/admin/post-approval/${targetId}`;
    if (targetType === "profile") return `/profile/${targetId}`;
    if (targetType === "comment") return `/post/${targetId}?openComments=true`;
  }
  // fallback by type
  if (type === "post_approved") return `/admin/post-approval/${activityId}`;
  if (type === "comment") return `/post/${activityId}?openComments=true`;
  if (type === "like" || type === "post_liked") return `/post/${activityId}`;
  return null;
}

// CREATE a new notification
router.post("/create", auth, async (req, res) => {
  try {
    const { type, senderId, receiverId, activityId, message } = req.body;

    if (!type || !senderId || !receiverId || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ------------------------------------
    // AUTO-RESOLVE targetType + targetId
    // ------------------------------------
    let targetType = null;
    let targetId = null;

    switch (type) {
      // Likes on a post → open the post
      case "post_like":
      case "post_comment":
      case "post_view":
      case "post_mention":
        targetType = "post";
        targetId = activityId; // this MUST be the postId
        break;

      // Likes or replies on a comment → open post but show comment section
      case "comment_like":
      case "comment_reply":
        targetType = "comment";
        
        // activityId in these notifications MUST be the commentId
        targetId = activityId;  
        break;

      // Follow → open the user's profile
      case "follow":
      case "new_follower":
        targetType = "profile";
        targetId = senderId; // sender is the follower
        break;

      // Default fallback
      default:
        targetType = null;
        targetId = null;
        break;
    }

    // ------------------------------------
    // CREATE NOTIFICATION
    // ------------------------------------
    const notif = await Notification.create({
      type,
      senderId,
      receiverId,
      activityId,
      message,
      targetType,
      targetId,
      targetUrl: null
    });

    // Re-fetch with sender populated
    const payload = await Notification.findById(notif._id)
      .populate("senderId", "username profileImage role roleName");

    const formatted = {
      id: payload._id.toString(),
      type: payload.type,
      message: payload.message,
      postId: payload.targetType === "post" ? payload.targetId : null,
      commentId: payload.targetType === "comment" ? payload.targetId : null,
      activityId: payload.activityId || null,
      status: payload.status,
      createdAt: payload.createdAt ? payload.createdAt.toISOString() : null,

      senderId: payload.senderId?._id?.toString() ?? null,
      sender: payload.senderId ? {
        userId: payload.senderId._id.toString(),
        username: payload.senderId.username,
        avatar: payload.senderId.profileImage,
        roleName: payload.senderId.roleName || payload.senderId.role?.name || "user"
      } : null,

      targetType: payload.targetType,
      targetId: payload.targetId,
      targetUrl: computeTarget(payload)
    };

    // ------------------------------------
    // SOCKET EVENTS
    // ------------------------------------
    if (global.io) {
      global.io.to(payload.receiverId.toString()).emit("notificationCreated", formatted);
      global.io.emit("newNotification", formatted);
    }

    return res.status(201).json(formatted);

  } catch (err) {
    console.error("NOTIFICATION CREATE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// GET all notifications for logged-in user (returns array matching Android model)
router.get("/all", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ receiverId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("senderId", "username profileImage role roleName");

    const formatted = notifications.map(n => ({
      id: n._id.toString(),
      type: n.type,
      senderId: n.senderId ? n.senderId._id.toString() : null,
      receiverId: n.receiverId ? n.receiverId.toString() : null,
      message: n.message,
      postId: n.activityId || null,         // backward compatible with Android model
      activityId: n.activityId || null,
      status: n.status,
      createdAt: n.createdAt ? n.createdAt.toISOString() : null,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      sender: n.senderId ? {
        userId: n.senderId._id.toString(),
        username: n.senderId.username,
        avatar: n.senderId.profileImage,
        roleName: n.senderId.roleName || n.senderId.role?.name || "user"
      } : null,
      targetType: n.targetType || null,
      targetId: n.targetId || null,
      targetUrl: computeTarget(n)
    }));

    res.json(formatted);
  } catch (err) {
    console.error("NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// MARK a single notification as read -> DELETE /api/notifications/:id/read
router.put("/:id/read", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // delete the notification
    const notification = await Notification.findOneAndDelete({
      _id: id,
      receiverId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // socket payload (similar to old formatted)
    const formatted = {
      id: id,
      status: "read",
      readAt: new Date().toISOString(),
      deleted: true
    };

    // emit socket event so other clients update UI
    if (global.io) {
      global.io.to(req.user.id).emit("notificationRead", formatted);
    }

    return res.json(formatted);

  } catch (err) {
    console.error("NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// MARK ALL notifications as read
router.put("/read-all", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    await Notification.updateMany({ receiverId: userId, status: "unread" }, { status: "read", readAt: now });

    if (global.io) {
      global.io.to(userId).emit("allNotificationsRead", { readAt: now.toISOString() });
    }

    return res.json({ message: "All notifications marked as read", readAt: now.toISOString() });
  } catch (err) {
    console.error("NOTIFICATION READ ALL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
