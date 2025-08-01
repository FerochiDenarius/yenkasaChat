const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Message = require('../models/message.model'); // Added
const authMiddleware = require('../middleware/auth'); // Assuming this is your auth middleware

// ✅ Create or reuse a chat room (from your original chat.routes.js)
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { username: recipientUsername } = req.body; // Using recipientUsername from our previous debugging

  console.log('--- Attempting to create/retrieve chat room ---');
  console.log(`Authenticated User ID (sender): ${userId}`);
  console.log(`Received recipient username from request body: "${recipientUsername}"`);

  if (!recipientUsername) {
    console.log('Recipient username not provided in request body.');
    return res.status(400).json({ success: false, message: 'Recipient username is required.' });
  }

  try {
    console.log(`Querying User collection for username: "${recipientUsername}"`);
    // Consider case-insensitive: new RegExp(`^${recipientUsername}$`, 'i')
    const otherUser = await User.findOne({ username: new RegExp(`^${recipientUsername}$`, 'i') });

    if (!otherUser) {
      console.error(`Recipient NOT FOUND in DB with username: "${recipientUsername}"`);
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    console.log(`Recipient found: ID = ${otherUser._id}, Username = ${otherUser.username}`);

    if (otherUser._id.toString() === userId) {
      console.log('User attempting to create chat room with themselves.');
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

    console.log(`Checking for existing room between ${userId} and ${otherUser._id}`);
    const existingRoom = await ChatRoom.findOne({
      participants: { $all: [new mongoose.Types.ObjectId(userId), otherUser._id] },
    });

    if (existingRoom) {
      console.log(`Existing chat room found: ${existingRoom._id}`);
      return res.json({
        success: true,
        roomId: existingRoom._id, // Send existing room ID
        message: 'Chat room already exists',
        // You might want to send other participant details here too for consistency
        participant: {
            id: otherUser._id,
            username: otherUser.username,
            avatar: otherUser.avatar || null // Assuming avatar field exists
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
      participant: { // Send participant details for new room too
        id: otherUser._id,
        username: otherUser.username,
        avatar: otherUser.avatar || null
      }
    });

  } catch (err) {
    console.error('❌ Chat room creation error:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to create chat room' });
  }
});


// ✅ Get all chat rooms for the logged-in user, with last message (from getchatrooms.js)
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  console.log(`Fetching enriched chat rooms for user ID: ${userId}`);

  try {
    const chatRooms = await ChatRoom.find({ participants: new mongoose.Types.ObjectId(userId) }) // Ensure userId is ObjectId if needed here
      .populate('participants', 'username avatar _id') // 'avatar' added, adjust if your User model has different field name
      .lean(); // .lean() is good for performance if you're not modifying docs

    if (!chatRooms || chatRooms.length === 0) {
        console.log(`No chat rooms found for user ${userId}`);
        return res.json([]); // Send empty array if no rooms
    }

    const enrichedRooms = await Promise.all(chatRooms.map(async (room) => {
      // Find the other participant
      const otherParticipant = room.participants.find(p => p && p._id && p._id.toString() !== userId);

      if (!otherParticipant) {
        // This case should ideally not happen if rooms always have 2 participants
        // and one is the current user. Log it if it does.
        console.warn(`Could not find other participant for room ${room._id} for user ${userId}. Participants:`, room.participants);
        return { // Return a gracefully degraded room object or skip
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
        .select('text imageUrl audioUrl videoUrl fileUrl contactInfo location createdAt') // Ensure these fields exist in Message model
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
          avatar: otherParticipant.avatar || null, // Ensure 'avatar' is the correct field name
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
        lastMessageAt: lastMessage?.createdAt || room.createdAt // Fallback to room creation if no message
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
