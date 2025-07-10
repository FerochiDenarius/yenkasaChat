const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const authMiddleware = require('../middleware/auth');

// ✅ Create or reuse a chat room
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { username } = req.body;

  try {
    const otherUser = await User.findOne({ username });
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (otherUser._id.toString() === userId) {
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

    const existingRoom = await ChatRoom.findOne({
      participants: {
        $all: [
          new mongoose.Types.ObjectId(userId),
          otherUser._id
        ]
      }
    });

    if (existingRoom) {
      return res.json({
        success: true,
        roomId: existingRoom._id,
        message: 'Chat room already exists'
      });
    }

    const newRoom = new ChatRoom({
      participants: [
        new mongoose.Types.ObjectId(userId),
        otherUser._id
      ]
    });

    await newRoom.save();

    res.status(201).json({
      success: true,
      roomId: newRoom._id,
      message: 'New chat room created'
    });

  } catch (err) {
    console.error('❌ Chat room creation error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create chat room' });
  }
});

// ✅ Get all chat rooms with latest message info
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const rooms = await ChatRoom.find({
      participants: new mongoose.Types.ObjectId(userId)
    })
      .populate('participants', 'username profileImage')
      .lean();

    const enrichedRooms = await Promise.all(rooms.map(async room => {
      const lastMsg = await Message.findOne({ roomId: room._id })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean();

      return {
        ...room,
        lastMessage: lastMsg?.text || null,
        lastMessageTimestamp: lastMsg?.timestamp || null,
        unreadCount: 0 // You can later compute this based on userId
      };
    }));

    res.json(enrichedRooms);
  } catch (err) {
    console.error('❌ Failed to fetch chat rooms:', err.message);
    res.status(500).json({ error: 'Failed to get chat rooms' });
  }
});

module.exports = router;
