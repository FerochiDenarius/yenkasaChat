// ✅ Import models (ensure the paths are correct relative to this file)
const ChatRoom = require("../models/chatroom.model"); // Note lowercase "r" if your file is named that way
const Message = require("../models/message.model");
const User = require("../models/user.model");

// ✅ File handling
const multer = require("multer");
const mediaStorage = require("../services/mediaStorage.service");
const { sendPushNotification } = require("../utils/onesignal");

// ✅ Multer config (buffered memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Push Notification via OneSignal
const sendNotification = async (playerId, title, body) => {
  try {
    const response = await sendPushNotification({ playerId, title, body });
    console.log("✅ Push notification sent:", response);
  } catch (error) {
    console.error("❌ Error sending notification:", error.message);
  }
};

// ✅ Send message logic
const sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, messageType, text } = req.body;
    let mediaUrl = "";

    // ✅ Upload media if file is attached
    if (req.file) {
      const result = await mediaStorage.upload(req.file, {
        folder: "chat",
        type: messageType || "file",
        area: "legacy_chat_media",
      });
      mediaUrl = result.secure_url;
    }

    // ✅ Save message
    const message = new Message({
      senderId,
      receiverId,
      messageType,
      text,
      mediaUrl,
    });

    await message.save();

    // ✅ Update or create chat room
    let chatRoom = await ChatRoom.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!chatRoom) {
      chatRoom = new ChatRoom({
        participants: [senderId, receiverId],
        lastMessage: text || "Media",
      });
    } else {
      chatRoom.lastMessage = text || "Media";
    }

    await chatRoom.save();

    // ✅ Send OneSignal push
    const receiver = await User.findById(receiverId);
    const sender = await User.findById(senderId);

    if (receiver?.playerId) {
      const pushTitle = sender?.username || "YenkasaChat";
      const pushBody = text || (messageType === "image" ? "📷 Image" : "📎 Attachment");
      await sendNotification(receiver.playerId, pushTitle, pushBody);
    }

    res.status(201).json({ message: "Message sent successfully", data: message });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
};

module.exports = {
  sendMessage,
  upload,
};
