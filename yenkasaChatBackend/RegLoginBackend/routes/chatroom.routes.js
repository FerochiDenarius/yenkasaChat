// TOP-LEVEL DECLARATIONS (REQUIRE STATEMENTS) - KEEP THESE
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const authMiddleware = require('../middleware/auth');

// --- CREATE OR REUSE A CHAT ROOM ---
// KEEP YOUR EXISTING POST ROUTE UNCHANGED (UNLESS IT ALSO NEEDS MODIFICATION FOR OTHER REASONS)
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
        roomId: existingRoom._id, // Note: This POST route returns roomId, not _id for the room.
                                  // Client creating a room might need to handle this differently
                                  // than when fetching the list of rooms. Or you could align this too.
        message: 'Chat room already exists',
        participant: { // Sends a single participant object
            id: otherUser._id, // Uses 'id', not '_id' for participant here
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
      roomId: newRoom._id, // Note: This POST route returns roomId, not _id for the room.
      message: 'New chat room created',
      participant: { // Sends a single participant object
        id: otherUser._id, // Uses 'id', not '_id' for participant here
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
// THIS IS THE MODIFIED GET ROUTE
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  console.log(`Fetching enriched chat rooms for user ID: ${userId}`);

  try {
    const chatRoomsFromDB = await ChatRoom.find({ participants: new mongoose.Types.ObjectId(userId) })
      .populate('participants', 'username avatar profileImage _id')
      .lean();

    if (!chatRoomsFromDB || chatRoomsFromDB.length === 0) {
        console.log(`No chat rooms found for user ${userId}`);
        return res.json([]);
    }

    const enrichedRooms = await Promise.all(chatRoomsFromDB.map(async (room) => {
      const otherParticipantObject = room.participants.find(p => p && p._id && p._id.toString() !== userId);

      let participantForClient = null;
      if (otherParticipantObject) {
        participantForClient = {
          _id: otherParticipantObject._id,
          username: otherParticipantObject.username,
          avatar: otherParticipantObject.avatar || otherParticipantObject.profileImage || null,
        };
      } else {
        console.warn(`Could not find other participant for room ${room._id} for user ${userId}. Participants:`, room.participants);
      }

      const lastMessageFromDB = await Message.findOne({ roomId: room._id })
        .sort({ createdAt: -1 })
        .select('text imageUrl audioUrl videoUrl fileUrl contactInfo location createdAt senderId')
        .lean();

      const lastMessageType =
        lastMessageFromDB?.imageUrl ? 'image' :
        lastMessageFromDB?.audioUrl ? 'audio' :
        lastMessageFromDB?.videoUrl ? 'video' :
        lastMessageFromDB?.fileUrl ? 'file' :
        lastMessageFromDB?.contactInfo ? 'contact' :
        lastMessageFromDB?.location ? 'location' :
        lastMessageFromDB?.text ? 'text' :
        null;

      const unreadMessagesCount = 0; // TODO: Implement actual unread count logic

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
            createdAt: lastMessageFromDB.createdAt
        } : null,
        lastMessageTime: lastMessageFromDB?.createdAt || room.updatedAt || room.createdAt,
        unreadCount: unreadMessagesCount,
        createdAt: room.createdAt,
      };

      if (!participantForClient) {
          console.warn(`Skipping room ${room._id} due to missing other participant information.`);
          return null;
      }

      return roomForClient;
    }));

    const validEnrichedRooms = enrichedRooms.filter(room => room !== null);
    res.json(validEnrichedRooms);

  } catch (err) {
    console.error('❌ Error fetching chat rooms:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch chat rooms' });
  }
});

// KEEP THIS - EXPORT THE ROUTER
module.exports = router;
