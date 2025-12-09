// models/notifications.model.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., post_liked, comment, follower, post_approved
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  activityId: { type: String }, // generic id of the thing that caused the notification (postId, commentId, approvalId...)
  // Convenience for client navigation:
  targetType: { type: String, default: null }, // "post" | "comment" | "approval" | "profile"
  targetId: { type: String, default: null },   // actual id for the target (e.g. the post id)
  targetUrl: { type: String, default: null },  // optional, server-side computed client route path
  message: { type: String, required: true },
  status: { type: String, enum: ["unread", "read"], default: "unread" },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false // we manually expose createdAt, readAt only
});

module.exports = mongoose.model("Notification", NotificationSchema);
