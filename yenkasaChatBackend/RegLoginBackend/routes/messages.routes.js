const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;


// ✅ Send a message
router.post('/', auth, async (req, res) => {
  const {
    roomId,
    text,
    imageUrl,
    audioUrl,
    videoUrl,
    fileUrl,
    contactInfo,
    location
  } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  const hasContent = text || imageUrl || audioUrl || videoUrl || fileUrl || contactInfo ||
    (location?.latitude && location?.longitude);

  if (!hasContent) {
    return res.status(400).json({ error: 'Message must contain text, image, audio, video, file, contact, or location' });
  }

  try {
    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) return res.status(404).json({ error: 'Chat room not found' });

    const newMessage = new Message({
      roomId: new mongoose.Types.ObjectId(roomId),
      senderId: req.user.id,
      text: text?.trim().substring(0, 1000),
      imageUrl,
      audioUrl,
      videoUrl,
      fileUrl,
      contactInfo,
      location,
    });

    await newMessage.save();

    const sender = await User.findById(req.user.id);
    const receiverId = chatRoom.participants.find(p => p.toString() !== req.user.id);
    const receiver = await User.findById(receiverId);

    if (receiver?.playerId) {
      const messageType = imageUrl ? 'image'
        : audioUrl ? 'audio'
        : videoUrl ? 'video'
        : fileUrl ? 'file'
        : contactInfo ? 'contact'
        : location ? 'location'
        : 'text';

      const notificationPayload = {
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [receiver.playerId],
        headings: { en: sender.username || 'YenkasaChat' },
        contents: { en: text || `📎 New ${messageType} message` },
        data: {
          roomId,
          senderId: sender._id.toString(),
          type: messageType,
        }
      };

      try {
        const response = await axios.post(
          'https://onesignal.com/api/v1/notifications',
          notificationPayload,
          {
            headers: {
              Authorization: `Basic ${ONESIGNAL_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('📤 OneSignal sent:', response.data);
      } catch (err) {
        console.error('❌ OneSignal error:', err.message);
      }
    } else {
      console.warn('⚠️ No playerId for recipient');
    }

    res.status(201).json(newMessage);
  } catch (err) {
    console.error('❌ Error saving message:', err);
    res.status(500).json({ error: 'Server error saving message' });
  }
});

// ✅ Get all messages in a chat room
router.get('/:roomId/messages', auth, async (req, res) => {
  const { roomId } = req.params;

  try {
    const messages = await Message.find({
      roomId: new mongoose.Types.ObjectId(roomId)
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ✅ Fix missing timestamps
router.post('/fix-timestamps', async (req, res) => {
  try {
    const result = await Message.updateMany(
      { createdAt: { $exists: false } },
      [{
        $set: {
          createdAt: "$timestamp",
          updatedAt: "$timestamp"
        }
      }]
    );
    res.json({
      message: "✅ Fixed messages with missing createdAt/updatedAt",
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  } catch (err) {
    console.error("❌ Timestamp fix failed:", err.message);
    res.status(500).json({ error: "Failed to fix timestamps" });
  }
});

// (Optional) Test FCM route – deprecated if you're no longer using Firebase
router.post('/test-notification', async (req, res) => {
  res.status(410).json({ message: 'This endpoint is deprecated. Use OneSignal for notifications.' });
});

module.exports = router;
