// routes/notifications.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");
const Comment = require("../models/comment.model");
const { areUsersBlocked } = require("../services/privacy.service");
const { sendNotification } = require("../services/notification.service");
const {
  NOTIFICATION_EVENT_TYPES,
  emitNotificationOperationalEvent
} = require("../services/notificationOperationalEvents.service");

// helper - compute targetUrl from type/activityId (update to match your app routes)
function computeTarget(notification) {
  const { type, activityId, targetType, targetId } = notification;
  // Basic examples; update to match your mobile routes:
  if (targetType && targetId) {
    if (targetType === "post") return `/post/${targetId}`;
    if (targetType === "approval") return `/admin/post-approval/${targetId}`;
    if (targetType === "profile") return `/profile/${targetId}`;
    if (targetType === "comment") return notification.targetUrl || null;
    if (targetType === "community") return targetId ? `/communities?communityId=${targetId}` : "/communities/mine";
    if (targetType === "live" || targetType === "livestream") return `/live/${targetId}`;
  }
  // fallback by type
  if (type === "post_approved") return `/admin/post-approval/${activityId}`;
  if (type === "comment") return `/post/${activityId}?openComments=true`;
  if (type === "like" || type === "post_liked" || ["community_post", "community_post_created"].includes(String(type || "").toLowerCase())) return `/post/${activityId}`;
  return null;
}

function getNotificationPreferences(user) {
  return {
    inAppEnabled: user?.notificationPreferences?.inAppEnabled !== false,
    rewardEnabled: user?.notificationPreferences?.rewardEnabled !== false,
    communityPostEnabled: user?.notificationPreferences?.communityPostEnabled !== false
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
  if (["community_post", "community_post_created"].includes(String(type || "").toLowerCase()) && !preferences.communityPostEnabled) return false;
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
      case "community_post":
      case "COMMUNITY_POST":
      case "COMMUNITY_POST_CREATED":
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

    const resolvedTargetType = req.body.targetType || targetType;
    const resolvedTargetId = req.body.targetId || targetId;
    let resolvedPostId = req.body.postId || null;

    if (
      !resolvedPostId &&
      String(resolvedTargetType || "").toLowerCase() === "comment" &&
      resolvedTargetId
    ) {
      const comment = await Comment.findById(resolvedTargetId).select("postId").lean();
      resolvedPostId = comment?.postId?.toString() || null;
    }

    const resolvedTargetUrl = req.body.targetUrl || (resolvedPostId
      ? `/post/${resolvedPostId}?openComments=true`
      : computeTarget({
      type,
      activityId,
      targetType: resolvedTargetType,
      targetId: resolvedTargetId
    }));

    const shouldPush = [
      "post_like",
      "post_comment",
      "comment_like",
      "comment_reply",
      "community_post",
      "community_post_created",
      "stream_started",
      "follow",
      "new_follower"
    ].includes(String(type || "").toLowerCase());

    const formatted = await sendNotification({
      type,
      senderId,
      receiverId,
      activityId,
      targetType: resolvedTargetType,
      targetId: resolvedTargetId,
      targetUrl: resolvedTargetUrl,
      message,
      emitSocket: true,
      push: shouldPush,
      pushTitle: "Yenkasa",
      pushBody: message,
      pushData: {
        type,
        activityId,
        postId: resolvedPostId,
        commentId: String(resolvedTargetType || "").toLowerCase() === "comment"
          ? resolvedTargetId
          : undefined,
        targetType: resolvedTargetType,
        targetId: resolvedTargetId,
        targetUrl: resolvedTargetUrl
      }
    });

    if (!formatted) {
      return res.status(200).json({ success: true, skipped: true });
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

    const preferenceFilteredNotifications = preferences.communityPostEnabled
      ? visibleNotifications
      : visibleNotifications.filter(n => !["community_post", "community_post_created"].includes(String(n.type || "").toLowerCase()));

    const nonAnnouncementNotifications = preferenceFilteredNotifications.filter(
      n => String(n.type || "").toLowerCase() !== "announcement"
    );

    const commentIds = nonAnnouncementNotifications
      .filter(n => String(n.targetType || "").toLowerCase() === "comment")
      .flatMap(n => [n.targetId, n.activityId])
      .filter(Boolean);

    const comments = commentIds.length
      ? await Comment.find({ _id: { $in: [...new Set(commentIds)] } })
          .select("_id postId")
          .lean()
      : [];

    const commentPostById = new Map(
      comments.map(comment => [comment._id.toString(), comment.postId?.toString?.() || null])
    );

    const formatted = nonAnnouncementNotifications.map(n => {
      const commentId = String(n.targetType || "").toLowerCase() === "comment"
        ? (n.targetId || n.activityId || null)
        : null;
      const resolvedPostId = String(n.targetType || "").toLowerCase() === "post"
        ? n.targetId
        : commentId
          ? commentPostById.get(commentId.toString())
          : null;

      return ({
      id: n._id.toString(),
      type: n.type,
      senderId: n.senderId ? n.senderId._id.toString() : null,
      receiverId: n.receiverId ? n.receiverId.toString() : null,
      message: n.message,
      postId: resolvedPostId || null,
      commentId,
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
      targetUrl: resolvedPostId
        ? `/post/${resolvedPostId}${commentId ? "?openComments=true" : ""}`
        : computeTarget(n)
      });
    });

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

    if (typeof req.body?.communityPostEnabled === "boolean") {
      allowedUpdates["notificationPreferences.communityPostEnabled"] = req.body.communityPostEnabled;
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

    const interaction = String(req.query?.interaction || req.body?.interaction || "opened").toLowerCase();
    emitNotificationOperationalEvent(
      interaction === "dismissed"
        ? NOTIFICATION_EVENT_TYPES.NOTIFICATION_DISMISSED
        : NOTIFICATION_EVENT_TYPES.NOTIFICATION_OPENED,
      {
        notificationId: id,
        notificationType: notification.type,
        userId: req.user.id,
        receiverId: req.user.id,
        senderId: notification.senderId,
        activityId: notification.activityId,
        targetType: notification.targetType,
        targetId: notification.targetId,
        targetUrl: notification.targetUrl || computeTarget(notification),
        message: notification.message,
        timestamp: formatted.readAt
      }
    );

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
