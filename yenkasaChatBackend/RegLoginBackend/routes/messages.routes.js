const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const admin = require('firebase-admin');

const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model'); // ✅ Needed for sender + receiver lookup

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

  const hasContent =
    text || imageUrl || audioUrl || videoUrl || fileUrl || contactInfo ||
    (location?.latitude && location?.longitude);

  if (!hasContent) {
    return res.status(400).json({
      error: 'Message must contain text, image, audio, video, file, contact, or location'
    });
  }

  try {
    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

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

    console.log('💾 Saving message:', newMessage);
    await newMessage.save();

    // ✅ Send FCM notification to other user
    const sender = await User.findById(req.user.id);
    const receiverId = chatRoom.participants.find(p => p.toString() !== req.user.id);
    const receiver = await User.findById(receiverId);

    if (receiver?.fcmToken) {
      const messageType = imageUrl ? 'image'
        : audioUrl ? 'audio'
        : videoUrl ? 'video'
        : fileUrl ? 'file'
        : contactInfo ? 'contact'
        : location ? 'location'
        : 'text';

      const fcmPayload = {
        token: receiver.fcmToken,
        notification: {
          title: sender.username || 'YenkasaChat',
          body: text || `📎 New ${messageType} message`,
        },
        data: {
          chatId: roomId,
          senderId: sender._id.toString(),
          senderName: sender.username,
          text: text || '',
          type: messageType
        }
      };

      try {
        const response = await admin.messaging().send(fcmPayload);
        console.log('📤 FCM sent:', response);
      } catch (err) {
        console.error('❌ Failed to send FCM:', err.message);
      }
    } else {
      console.warn('⚠️ No FCM token for recipient');
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
      [
        {
          $set: {
            createdAt: "$timestamp",
            updatedAt: "$timestamp"
          }
        }
      ]
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

module.exports = router;
