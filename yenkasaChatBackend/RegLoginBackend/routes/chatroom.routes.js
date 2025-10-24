// TOP-LEVEL DECLARATIONS (REQUIRE STATEMENTS) - KEEP THESE
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const authMiddleware = require('../middleware/auth');

// --- CREATE OR REUSE A CHAT ROOM ---
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { username: rawRecipientUsername } = req.body;

  console.log('--- Attempting to create/retrieve chat room ---');
  console.log(`Authenticated User ID (sender): ${userId}`);
  console.log(`Received recipient username (raw) from request body: "${rawRecipientUsername}"`);

  if (!rawRecipientUsername) {
    console.log('Recipient username not provided in request body.');
    return res.status(400).json({ success: false, message: 'Recipient username is required.' });
  }

  const recipientUsername = rawRecipientUsername.trim();
  if (recipientUsername === "") {
    return res.status(400).json({ success: false, message: 'Recipient username is invalid.' });
  }

  try {
    const otherUser = await User.findOne({ username: new RegExp(`^${recipientUsername}$`, 'i') });

    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (otherUser._id.toString() === userId) {
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

 const existingRoom = await ChatRoom.findOne({
  participants: { $size: 2, $all: [userId, otherUser._id] },
});


    if (existingRoom) {
      return res.json({
        success: true,
        roomId: existingRoom._id,
        message: 'Chat room already exists',
        participant: {
          _id: otherUser._id,
          username: otherUser.username,
          avatar: otherUser.avatar || otherUser.profileImage || null,
          online: otherUser.online || false,
          lastSeen: otherUser.lastSeen || null
        }
      });
    }

    const newRoom = new ChatRoom({
      participants: [new mongoose.Types.ObjectId(userId), otherUser._id],
    });
    await newRoom.save();

    res.status(201).json({
      success: true,
      roomId: newRoom._id,
      message: 'New chat room created',
      participant: {
        _id: otherUser._id,
        username: otherUser.username,
        avatar: otherUser.avatar || otherUser.profileImage || null,
        online: otherUser.online || false,
        lastSeen: otherUser.lastSeen || null
      }
    });

  } catch (err) {
    console.error('❌ Chat room creation error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create chat room' });
  }
});

// --- GET SINGLE CHAT ROOM BY ID ---
router.get('/:roomId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { roomId } = req.params;

  try {
    const room = await ChatRoom.findById(roomId)
      .populate('participants', 'username avatar profileImage isOnline _id')
      .lean();

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const otherParticipant = room.participants.find(p => p._id.toString() !== userId);
    if (!otherParticipant) {
      return res.status(400).json({ success: false, message: 'No other participant found' });
    }

    res.json({
      success: true,
      participant: {
        _id: otherParticipant._id,
        username: otherParticipant.username,
        avatar: otherParticipant.avatar || otherParticipant.profileImage || null,
        profileImage: otherParticipant.profileImage || otherParticipant.avatar || null,
        isOnline: otherParticipant.isOnline || false
      }
    });
  } catch (err) {
    console.error('❌ Error fetching chat room details:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chat room details' });
  }
});
// --- GET RECEIVER INFO DIRECTLY BY ROOM ID ---
router.get('/:roomId/receiver', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { roomId } = req.params;

  try {
    const room = await ChatRoom.findById(roomId)
      .populate('participants', 'username profileImage isOnline _id')
      .lean();

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const receiver = room.participants.find(p => p._id.toString() !== userId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    res.json({
      success: true,
      receiver: {
        _id: receiver._id,
        username: receiver.username,
        profileImage: receiver.profileImage || null,
        isOnline: receiver.isOnline || false
      }
    });
  } catch (err) {
    console.error('❌ Error fetching receiver info:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch receiver info' });
  }
});

// --- GET ALL CHAT ROOMS FOR THE LOGGED-IN USER ---// --- GET ALL CHAT ROOMS FOR THE LOGGED-IN USER ---
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  console.log(`Fetching enriched chat rooms for user ID: ${userId}`);

  try {
    const chatRoomsFromDB = await ChatRoom.find({ participants: new mongoose.Types.ObjectId(userId) })
      .populate('participants', 'username profileImage avatar isOnline lastSeen _id')
      .lean();

    if (!chatRoomsFromDB || chatRoomsFromDB.length === 0) {
      return res.json([]);
    }

    const enrichedRooms = await Promise.all(chatRoomsFromDB.map(async (room) => {
      const otherParticipantObject = room.participants.find(p => p && p._id && p._id.toString() !== userId);

      let participantForClient = null;
      if (otherParticipantObject) {
        participantForClient = {
          _id: otherParticipantObject._id,
          username: otherParticipantObject.username || null,
          profileImage: otherParticipantObject.profileImage || otherParticipantObject.avatar || null,
          isOnline: otherParticipantObject.isOnline || otherParticipantObject.online || false,
          lastSeen: otherParticipantObject.lastSeen || null
        };
      }

      const lastMessageFromDB = await Message.findOne({ roomId: room._id })
        .sort({ createdAt: -1 })
        .select('text imageUrl audioUrl videoUrl fileUrl contactInfo location createdAt senderId')
        .populate('senderId', 'username profileImage _id')
        .lean();

      const roomForClient = {
        _id: room._id,
        participants: participantForClient ? [participantForClient] : [],
        lastMessage: lastMessageFromDB ? {
          _id: lastMessageFromDB._id,
          senderId: lastMessageFromDB.senderId,
          text: lastMessageFromDB.text,
          imageUrl: lastMessageFromDB.imageUrl,
          audioUrl: lastMessageFromDB.audioUrl,
          videoUrl: lastMessageFromDB.videoUrl,
          fileUrl: lastMessageFromDB.fileUrl,
          contactInfo: lastMessageFromDB.contactInfo,
          location: lastMessageFromDB.location,
          timestamp: lastMessageFromDB.createdAt
        } : null,
        lastMessageTime: lastMessageFromDB?.createdAt || room.updatedAt || room.createdAt,
        unreadCount: 0,
        createdAt: room.createdAt,
      };

      return participantForClient ? roomForClient : null;
    }));

    const validEnrichedRooms = enrichedRooms.filter(Boolean);
    res.json(validEnrichedRooms);

  } catch (err) {
    console.error('❌ Error fetching chat rooms:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch chat rooms' });
  }
});


module.exports = router;
