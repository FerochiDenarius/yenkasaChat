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
    }

    if (type === "reward") return "/wallet";
    if (type === "post_approved") return `/admin/post-approval/${activityId}`;
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
                const receiver = await User.findById(receiverId).select("playerId");
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
