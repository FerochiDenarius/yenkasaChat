// routes/notifications.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Notification = require("../models/notifications.model");
const User = require("../models/user.model");
const Comment = require("../models/comment.model");
const { areUsersBlocked } = require("../services/privacy.service");
const { sendNotification } = require("../services/notification.service");
const { createLogger } = require("../src/yme/observability/logger");

const logger = createLogger("notifications.route", {
  sourceModule: "http.notifications",
});

// helper - compute targetUrl from type/activityId (update to match your app routes)
function computeTarget(notification) {
  const { type, activityId, targetType, targetId } = notification;
  // Basic examples; update to match your mobile routes:
  if (targetType && targetId) {
    if (targetType === "post") return `/post/${targetId}`;
    if (targetType === "approval") return `/admin/post-approval/${targetId}`;
    if (targetType === "profile") return `/profile/${targetId}`;
    if (targetType === "comment") return notification.targetUrl || null;
  }
  // fallback by type
  if (type === "post_approved") return `/admin/post-approval/${activityId}`;
  if (type === "comment") return `/post/${activityId}?openComments=true`;
  if (type === "like" || type === "post_liked" || String(type || "").toLowerCase() === "community_post") return `/post/${activityId}`;
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
  if (String(type || "").toLowerCase() === "community_post" && !preferences.communityPostEnabled) return false;
  return true;
}

router.post("/create", auth, async (req, res) => {
  try {
    const { type, receiverId, activityId, message } = req.body;
    const senderId = req.user.id;

    if (!type || !senderId || !receiverId || !message) {
      logger.track({
        message: "Notification create payload is missing required fields.",
        severity: "WARN",
        req,
        userId: senderId,
        data: {
          statusCode: 400,
          receiverId: receiverId || "",
        },
        event: {
          category: "analytics_event",
          eventName: "notification_create_invalid_payload",
          severity: "warn",
          statusCode: 400,
          relatedUserId: receiverId || "",
        },
      });
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (req.body.senderId && req.body.senderId.toString() !== senderId.toString()) {
      logger.track({
        message: "Notification create attempt spoofed senderId.",
        severity: "WARN",
        req,
        userId: senderId,
        data: {
          statusCode: 403,
          receiverId: receiverId || "",
        },
        event: {
          category: "auth_event",
          eventName: "notification_sender_spoof_blocked",
          severity: "warn",
          statusCode: 403,
          relatedUserId: receiverId || "",
        },
      });
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
      logger.track({
        message: "Notification receiver was not found.",
        severity: "WARN",
        req,
        userId: senderId,
        data: {
          statusCode: 404,
          receiverId: receiverId || "",
        },
        event: {
          category: "analytics_event",
          eventName: "notification_receiver_not_found",
          severity: "warn",
          statusCode: 404,
          relatedUserId: receiverId || "",
        },
      });
      return res.status(404).json({ message: "Receiver not found" });
    }

    if (await areUsersBlocked(senderId, receiverId)) {
      logger.track({
        message: "Notification blocked by privacy settings.",
        severity: "WARN",
        req,
        userId: senderId,
        data: {
          statusCode: 403,
          receiverId: receiverId || "",
        },
        event: {
          category: "moderation_event",
          eventName: "notification_blocked_by_privacy",
          severity: "warn",
          statusCode: 403,
          relatedUserId: receiverId || "",
        },
      });
      return res.status(403).json({ message: "Notification blocked by privacy settings" });
    }

    if (!shouldDeliverNotification(receiver, type, targetType)) {
      logger.track({
        message: "Notification muted by receiver preferences.",
        severity: "INFO",
        req,
        userId: senderId,
        data: {
          statusCode: 200,
          receiverId: receiverId || "",
          type,
        },
        event: {
          category: "analytics_event",
          eventName: "notification_muted",
          severity: "info",
          statusCode: 200,
          relatedUserId: receiverId || "",
        },
      });
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
      logger.track({
        message: "Notification was skipped by downstream delivery logic.",
        severity: "INFO",
        req,
        userId: senderId,
        data: {
          statusCode: 200,
          receiverId: receiverId || "",
          type,
        },
        event: {
          category: "analytics_event",
          eventName: "notification_skipped",
          severity: "info",
          statusCode: 200,
          relatedUserId: receiverId || "",
        },
      });
      return res.status(200).json({ success: true, skipped: true });
    }

    logger.track({
      message: "Notification created successfully.",
      severity: "INFO",
      req,
      userId: senderId,
      data: {
        statusCode: 201,
        receiverId: receiverId || "",
        type,
      },
      event: {
        category: "analytics_event",
        eventName: "notification_created",
        severity: "info",
        statusCode: 201,
        relatedUserId: receiverId || "",
      },
    });
    return res.status(201).json(formatted);

  } catch (err) {
    logger.track({
      message: "Notification create request failed.",
      severity: "ERROR",
      req,
      userId: req.user?.id || "",
      error: err,
      data: {
        statusCode: 500,
      },
      event: {
        category: "infrastructure_event",
        eventName: "notification_create_error",
        severity: "error",
        statusCode: 500,
      },
    });
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
      : visibleNotifications.filter(n => String(n.type || "").toLowerCase() !== "community_post");

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
    logger.error("Notification list request failed.", {
      req,
      userId: req.user?.id || "",
      error: err,
      data: {
        statusCode: 500,
      },
    });
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
    logger.track({
      message: "Notification preferences update failed.",
      severity: "ERROR",
      req,
      userId: req.user?.id || "",
      error: err,
      data: {
        statusCode: 500,
      },
      event: {
        category: "infrastructure_event",
        eventName: "notification_preferences_update_error",
        severity: "error",
        statusCode: 500,
      },
    });
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

    logger.track({
      message: "Notification marked as read.",
      severity: "INFO",
      req,
      userId: req.user?.id || "",
      data: {
        statusCode: 200,
        notificationId: id,
      },
      event: {
        category: "engagement",
        eventName: "notification_read",
        eventType: "notification_open",
        severity: "info",
        statusCode: 200,
        contentId: id,
        ymeEligible: true,
      },
    });
    return res.json(formatted);

  } catch (err) {
    logger.track({
      message: "Notification read request failed.",
      severity: "ERROR",
      req,
      userId: req.user?.id || "",
      error: err,
      data: {
        statusCode: 500,
      },
      event: {
        category: "infrastructure_event",
        eventName: "notification_read_error",
        severity: "error",
        statusCode: 500,
      },
    });
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

    logger.track({
      message: "All notifications marked as read.",
      severity: "INFO",
      req,
      userId,
      data: {
        statusCode: 200,
      },
      event: {
        category: "engagement",
        eventName: "notification_read_all",
        severity: "info",
        statusCode: 200,
        ymeEligible: true,
      },
    });
    return res.json({ message: "All notifications marked as read", readAt: now.toISOString() });
  } catch (err) {
    logger.track({
      message: "Read-all notifications request failed.",
      severity: "ERROR",
      req,
      userId: req.user?.id || "",
      error: err,
      data: {
        statusCode: 500,
      },
      event: {
        category: "infrastructure_event",
        eventName: "notification_read_all_error",
        severity: "error",
        statusCode: 500,
      },
    });
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
