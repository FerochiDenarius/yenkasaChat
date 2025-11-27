const Notification = require("../models/notifications.model");

async function sendNotification({ 
    type,
    senderId,
    receiverId,
    activityId = null,
    message
}) {
    try {
        if (!type || !senderId || !receiverId || !message) {
            console.error("Missing fields for sendNotification()");
            return;
        }

        await Notification.create({
            type,
            senderId,
            receiverId,
            activityId,
            message
        });

        return true;
        
    } catch (err) {
        console.error("SEND NOTIFICATION ERROR →", err);
        return false;
    }
}

module.exports = { sendNotification };
