//notifications.model
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    type: { type: String, required: true }, // e.g., post_liked, comment, follower, message_request
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    activityId: { type: String }, // postId, commentId, requestId, followerId, etc
    message: { type: String, required: true },
    status: { type: String, default: "unread" }, // unread | read
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", NotificationSchema);
