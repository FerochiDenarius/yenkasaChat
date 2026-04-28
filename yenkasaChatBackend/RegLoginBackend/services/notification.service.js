const Notification = require("../models/notifications.model");
const User = require("../models/user.model");
const { sendPushNotification } = require("../utils/onesignal");

function computeTarget(notification) {
    const { targetType, targetId, targetUrl, type, activityId } = notification;

    if (targetUrl) return targetUrl;

    if (targetType && targetId) {
        if (targetType === "post") return `/post/${targetId}`;
        if (targetType === "approval") return `/admin/post-approval/${targetId}`;
        if (targetType === "profile") return `/profile/${targetId}`;
        if (targetType === "comment") return `/post/${targetId}?openComments=true`;
        if (targetType === "wallet") return `/wallet/${targetId}`;
        if (targetType === "ad") return `/ads/mine`;
        if (targetType === "community") return `/communities/mine`;
    }

    if (type === "reward") return "/wallet";
    if (type === "post_approved") return `/admin/post-approval/${activityId}`;
    if (type === "ad_approved" || type === "ad_rejected") return "/ads/mine";
    if (type === "community_approved" || type === "community_rejected") return "/communities/mine";
    if (type === "comment") return `/post/${activityId}?openComments=true`;
    if (type === "like" || type === "post_liked") return `/post/${activityId}`;

    return null;
}

function formatNotification(notification) {
    return {
        id: notification._id.toString(),
        type: notification.type,
        senderId: notification.senderId?._id?.toString?.() || notification.senderId?.toString?.() || null,
        receiverId: notification.receiverId?.toString?.() || null,
        message: notification.message,
        postId: notification.targetType === "post" ? notification.targetId : null,
        commentId: notification.targetType === "comment" ? notification.targetId : null,
        activityId: notification.activityId,
        status: notification.status,
        createdAt: notification.createdAt?.toISOString?.() || null,
        readAt: notification.readAt?.toISOString?.() || null,
        sender: notification.senderId?._id
            ? {
                userId: notification.senderId._id.toString(),
                username: notification.senderId.username,
                avatar: notification.senderId.profileImage,
                roleName: notification.senderId.roleName || notification.senderId.role?.name || "user"
            }
            : null,
        targetType: notification.targetType || null,
        targetId: notification.targetId || null,
        targetUrl: computeTarget(notification)
    };
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

async function sendNotification({ 
    type,
    senderId,
    receiverId,
    activityId = null,
    targetType = null,
    targetId = null,
    targetUrl = null,
    message,
    emitSocket = true,
    push = false,
    pushTitle = null,
    pushBody = null,
    pushData = null
}) {
    try {
        if (!type || !senderId || !receiverId || !message) {
            console.error("Missing fields for sendNotification()");
            return false;
        }

        const receiver = await User.findById(receiverId).select("playerId notificationPreferences");
        if (!receiver) {
            console.warn(`Notification receiver ${receiverId} not found`);
            return false;
        }

        if (!shouldDeliverNotification(receiver, type, targetType)) {
            return null;
        }

        const notif = await Notification.create({
            type,
            senderId,
            receiverId,
            activityId,
            targetType,
            targetId,
            targetUrl,
            message
        });

        const payload = await Notification.findById(notif._id)
            .populate("senderId", "username profileImage role roleName");

        const formatted = formatNotification(payload || notif);

        if (emitSocket && global.io) {
            global.io.to(receiverId.toString()).emit("notificationCreated", formatted);
        }

        if (push) {
            try {
                if (receiver?.playerId) {
                    await sendPushNotification({
                        playerId: receiver.playerId,
                        title: pushTitle || "Yenkasa",
                        body: pushBody || message,
                        data: {
                            notificationId: formatted.id,
                            type,
                            activityId,
                            targetType,
                            targetId,
                            targetUrl: formatted.targetUrl,
                            ...(pushData || {})
                        }
                    });
                } else {
                    console.warn(`No OneSignal playerId found for notification receiver ${receiverId}`);
                }
            } catch (pushErr) {
                console.error("PUSH NOTIFICATION ERROR →", pushErr.message);
            }
        }

        return formatted;
        
    } catch (err) {
        console.error("SEND NOTIFICATION ERROR →", err);
        return false;
    }
}

module.exports = { sendNotification };
