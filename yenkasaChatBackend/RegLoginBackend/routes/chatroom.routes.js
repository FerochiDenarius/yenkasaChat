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
    console.log('Recipient username became empty after trimming.');
    return res.status(400).json({ success: false, message: 'Recipient username is invalid.' });
  }

  console.log(`Querying User collection for username (trimmed, case-insensitive): "${recipientUsername}"`);

  try {
    const otherUser = await User.findOne({ username: new RegExp(`^${recipientUsername}$`, 'i') });

    if (!otherUser) {
      console.error(`Recipient NOT FOUND in DB with username: "${recipientUsername}" (using trimmed, case-insensitive query)`);
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    console.log(`Recipient found: ID = ${otherUser._id}, Username = ${otherUser.username}`);

    if (otherUser._id.toString() === userId) {
      console.log('User attempting to create chat room with themselves.');
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

    const existingRoom = await ChatRoom.findOne({
      participants: { $all: [new mongoose.Types.ObjectId(userId), otherUser._id] },
    });

    if (existingRoom) {
      console.log(`Existing chat room found: ${existingRoom._id}`);
      return res.json({
        success: true,
        roomId: existingRoom._id,
        message: 'Chat room already exists',
        participant: {
            id: otherUser._id,
            username: otherUser.username,
            avatar: otherUser.avatar || otherUser.profileImage || null
        }
      });
    }

    console.log('No existing room found. Creating a new chat room.');
    const newRoom = new ChatRoom({
      participants: [new mongoose.Types.ObjectId(userId), otherUser._id],
    });
    await newRoom.save();
    console.log(`New chat room created successfully: ${newRoom._id}`);

    res.status(201).json({
      success: true,
      roomId: newRoom._id,
      message: 'New chat room created',
      participant: {
        id: otherUser._id,
        username: otherUser.username,
        avatar: otherUser.avatar || otherUser.profileImage || null
      }
    });

  } catch (err) {
    console.error('❌ Chat room creation error:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to create chat room' });
  }
});


// --- GET ALL CHAT ROOMS FOR THE LOGGED-IN USER ---
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  console.log(`Fetching enriched chat rooms for user ID: ${userId}`);

  try {
    const chatRooms = await ChatRoom.find({ participants: new mongoose.Types.ObjectId(userId) })
      .populate('participants', 'username avatar profileImage _id') // Added profileImage
      .lean();

    if (!chatRooms || chatRooms.length === 0) {
        console.log(`No chat rooms found for user ${userId}`);
        return res.json([]);
    }

    const enrichedRooms = await Promise.all(chatRooms.map(async (room) => {
      const otherParticipant = room.participants.find(p => p && p._id && p._id.toString() !== userId);

      if (!otherParticipant) {
        console.warn(`Could not find other participant for room ${room._id} for user ${userId}. Participants:`, room.participants);
        return {
          roomId: room._id,
          participant: null,
          lastMessage: null,
          lastMessageType: null,
          lastMessageAt: null,
          error: "Could not identify other participant"
        };
      }

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
          avatar: otherParticipant.avatar || otherParticipant.profileImage || null, // Added profileImage
        },
        lastMessage: lastMessage ? {
            text: lastMessage.text,
            imageUrl: lastMessage.imageUrl,
            audioUrl: lastMessage.audioUrl,
            videoUrl: lastMessage.videoUrl,
            fileUrl: lastMessage.fileUrl,
            contactInfo: lastMessage.contactInfo,
            location: lastMessage.location,
            createdAt: lastMessage.createdAt
        } : null,
        lastMessageType,
        lastMessageAt: lastMessage?.createdAt || room.createdAt
      };
    }));

    res.json(enrichedRooms);
  } catch (err) {
    console.error('❌ Error fetching chat rooms:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch chat rooms' });
  }
});

module.exports = router;
