const ChatRoom = require("../models/chatRoom.model");
const Message = require("../models/message.model");
const User = require("../models/user.model");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const axios = require("axios");

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer config (buffer storage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ✅ Send push notification via OneSignal
const sendNotification = async (playerId, title, body) => {
  const notificationData = {
    app_id: process.env.ONESIGNAL_APP_ID,
    include_player_ids: [playerId],
    headings: { en: title },
    contents: { en: body },
  };

  try {
    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      notificationData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${process.env.yenkasachatOneSignalKey}`,
        },
      }
    );

    console.log("✅ Push notification sent:", response.data);
  } catch (error) {
    console.error("❌ Error sending notification:", error.response?.data || error.message);
  }
};

// ✅ Send message logic
const sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, messageType, text } = req.body;
    let mediaUrl = "";

    if (req.file) {
      const streamUpload = (req) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream((error, result) => {
            if (result) resolve(result);
            else reject(error);
          });

          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req);
      mediaUrl = result.secure_url;
    }

    const messageData = {
      senderId,
      receiverId,
      messageType,
      text,
      mediaUrl,
    };

    const message = new Message(messageData);
    await message.save();

    // ✅ Update chat room's last message
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

    // ✅ Send push notification to recipient
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
