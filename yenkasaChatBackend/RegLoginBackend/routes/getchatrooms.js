// routes/getchatrooms.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ChatRoom = require('../models/chatroom.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// ✅ Get all chat rooms for the logged-in user, with last message details
router.get('/', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const chatRooms = await ChatRoom.find({ participants: userId })
      .populate('participants', 'username avatar _id')
      .lean();

    const enrichedRooms = await Promise.all(chatRooms.map(async (room) => {
      const otherParticipant = room.participants.find(p => p._id.toString() !== userId);

      const lastMessage = await Message.findOne({ roomId: room._id })
        .sort({ createdAt: -1 })
        .select('text imageUrl audioUrl videoUrl fileUrl contactInfo location createdAt')
        .lean();

      const lastMessageType =
        lastMessage?.imageUrl ? 'image' :
        lastMessage?.audioUrl ? 'audio' :
        lastMessage?.videoUrl ? 'video' :
        lastMessage?.fileUrl ? 'file' :
        lastMessage?.contactInfo ? 'contact' :
        lastMessage?.location ? 'location' :
        lastMessage?.text ? 'text' :
        null;

      return {
        roomId: room._id,
        participant: {
          id: otherParticipant._id,
          username: otherParticipant.username,
          avatar: otherParticipant.avatar || null,
        },
        lastMessage: lastMessage || null,
        lastMessageType,
        lastMessageAt: lastMessage?.createdAt || null
      };
    }));

    res.json(enrichedRooms);
  } catch (err) {
    console.error('❌ Error fetching chat rooms:', err.message);
    res.status(500).json({ error: 'Failed to fetch chat rooms' });
  }
});

module.exports = router;
