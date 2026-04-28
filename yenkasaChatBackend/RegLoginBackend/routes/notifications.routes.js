// routes/notifications.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");
const { areUsersBlocked } = require("../services/privacy.service");

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

function getNotificationPreferences(user) {
  return {
    inAppEnabled: user?.notificationPreferences?.inAppEnabled !== false,
    rewardEnabled: user?.notificationPreferences?.rewardEnabled !== false
  };
}

function isRewardNotification(type, targetType) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedTargetType = String(targetType || "").toLowerCase();
  return normalizedType === "reward" ||
    normalizedType.startsWith("reward_") ||
    normalizedTargetType === "wallet";
}

function shouldDeliverNotification(user, type, targetType) {
  const preferences = getNotificationPreferences(user);
  if (!preferences.inAppEnabled) return false;
  if (isRewardNotification(type, targetType) && !preferences.rewardEnabled) return false;
  return true;
}

router.post("/create", auth, async (req, res) => {
  try {
    const { type, receiverId, activityId, message } = req.body;
    const senderId = req.user.id;

    if (!type || !senderId || !receiverId || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (req.body.senderId && req.body.senderId.toString() !== senderId.toString()) {
      return res.status(403).json({ message: "Cannot create notification as another user" });
    }

    // ------------------------------------
    // AUTO-RESOLVE targetType + targetId
    // ------------------------------------
    let targetType = null;
    let targetId = null;

    switch (type) {

      // ------------------------------------------------
      // POST EVENTS
      // ------------------------------------------------
      case "post_like":
      case "post_comment":
      case "post_reply":
      case "post_mention":
      case "post_under_review":
      case "post_pending":
      case "post_approved":
      case "post_view":
      case "view_milestone":
        targetType = "post";
        targetId = activityId;  // ALWAYS the postId
        break;

      // ------------------------------------------------
      // COMMENT EVENTS
      // ------------------------------------------------
      case "comment_like":
      case "comment_reply":
        targetType = "comment";
        targetId = activityId; // ALWAYS the commentId
        break;

      // ------------------------------------------------
      // FOLLOW EVENTS
      // ------------------------------------------------
      case "follow":
      case "new_follower":
      case "follow_request":
      case "follow_accepted":
        targetType = "profile";
        targetId = senderId; // open follower profile
        break;

      // ------------------------------------------------
      // BLOCK EVENTS
      // ------------------------------------------------
      case "blocked":
      case "unblocked":
        targetType = "profile";
        targetId = senderId; // open blocker/unblocker profile
        break;

      // ------------------------------------------------
      // SYSTEM EVENTS
      // ------------------------------------------------
      case "system_block":
      case "system_unblock":
      case "system_warning":
        targetType = "system";
        targetId = null;
        break;

      // ------------------------------------------------
      // MESSAGE REQUESTS
      // ------------------------------------------------
      case "message_request":
      case "message_request_approved":
        targetType = "profile";
        targetId = senderId; // open requester
        break;

      default:
        targetType = null;
        targetId = null;
    }

    const receiver = await User.findById(receiverId).select("notificationPreferences");
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    if (await areUsersBlocked(senderId, receiverId)) {
      return res.status(403).json({ message: "Notification blocked by privacy settings" });
    }

    if (!shouldDeliverNotification(receiver, type, targetType)) {
      return res.status(200).json({ success: true, muted: true });
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

    // Populate sender
    const payload = await Notification.findById(notif._id)
      .populate("senderId", "username profileImage role roleName");

    // Format for frontend
    const formatted = {
      id: payload._id.toString(),
      type: payload.type,
      message: payload.message,

      postId: payload.targetType === "post" ? payload.targetId : null,
      commentId: payload.targetType === "comment" ? payload.targetId : null,

      activityId: payload.activityId,
      status: payload.status,
      createdAt: payload.createdAt?.toISOString() ?? null,

      senderId: payload.senderId?._id?.toString() ?? null,
      sender: payload.senderId
        ? {
            userId: payload.senderId._id.toString(),
            username: payload.senderId.username,
            avatar: payload.senderId.profileImage,
            roleName: payload.senderId.roleName || payload.senderId.role?.name || "user"
          }
        : null,

      targetType: payload.targetType,
      targetId: payload.targetId,
      targetUrl: computeTarget(payload)
    };

    // SOCKET
    if (global.io) {
      global.io.to(payload.receiverId.toString()).emit("notificationCreated", formatted);
    }

    return res.status(201).json(formatted);

  } catch (err) {
    console.error("NOTIFICATION CREATE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// GET all notifications for logged-in user (returns array matching Android model)
router.get("/all", auth, async (req, res) => {
  try {
    const preferences = getNotificationPreferences(req.user);
    if (!preferences.inAppEnabled) {
      return res.json([]);
    }

    const notifications = await Notification.find({ receiverId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("senderId", "username profileImage role roleName");

    const visibleNotifications = preferences.rewardEnabled
      ? notifications
      : notifications.filter(n => !isRewardNotification(n.type, n.targetType));

    const formatted = visibleNotifications.map(n => ({
      id: n._id.toString(),
      type: n.type,
      senderId: n.senderId ? n.senderId._id.toString() : null,
      receiverId: n.receiverId ? n.receiverId.toString() : null,
      message: n.message,
 postId: n.targetType === "post" ? n.targetId : null,
commentId: n.targetType === "comment" ? n.targetId : null,
activityId: n.activityId,
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

router.get("/preferences", auth, async (req, res) => {
  res.json({
    success: true,
    preferences: getNotificationPreferences(req.user)
  });
});

router.put("/preferences", auth, async (req, res) => {
  try {
    const allowedUpdates = {};

    if (typeof req.body?.inAppEnabled === "boolean") {
      allowedUpdates["notificationPreferences.inAppEnabled"] = req.body.inAppEnabled;
    }

    if (typeof req.body?.rewardEnabled === "boolean") {
      allowedUpdates["notificationPreferences.rewardEnabled"] = req.body.rewardEnabled;
    }

    if (Object.keys(allowedUpdates).length > 0) {
      await User.updateOne({ _id: req.user.id }, { $set: allowedUpdates });
    }

    const updatedUser = await User.findById(req.user.id).select("notificationPreferences");

    res.json({
      success: true,
      preferences: getNotificationPreferences(updatedUser)
    });
  } catch (err) {
    console.error("NOTIFICATION PREFERENCES ERROR:", err);
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
