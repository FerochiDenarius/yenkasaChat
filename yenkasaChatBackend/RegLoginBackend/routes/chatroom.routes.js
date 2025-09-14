// TOP-LEVEL DECLARATIONS (REQUIRE STATEMENTS) - KEEP THESE
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model'); // Ensure this path is correct
const User = require('../models/user.model');         // Ensure this path is correct
const Message = require('../models/message.model');   // Ensure this path is correct
const authMiddleware = require('../middleware/auth'); // Ensure this path is correct

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
        participant: { // Sends a single participant object
            _id: otherUser._id, // Changed 'id' to '_id' for consistency with GET response
            username: otherUser.username,
            profileImage: otherUser.profileImage || otherUser.avatar || null, // Consistent field name
            isOnline: otherUser.isOnline || false // Include isOnline status
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
      participant: { // Sends a single participant object
        _id: otherUser._id, // Changed 'id' to '_id'
        username: otherUser.username,
        profileImage: otherUser.profileImage || otherUser.avatar || null, // Consistent field name
        isOnline: otherUser.isOnline || false // Include isOnline status
      }
    });

  } catch (err) {
    console.error('❌ Chat room creation error:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to create chat room' });
  }
});


// --- GET ALL CHAT ROOMS FOR THE LOGGED-IN USER (MODIFIED) ---
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id; // This is the ID of the logged-in user (sender)
  console.log(`Fetching enriched chat rooms for user ID: ${userId}`);

  try {
    const chatRoomsFromDB = await ChatRoom.find({ participants: new mongoose.Types.ObjectId(userId) })
      // Populate all necessary fields for *all* participants in the room
      // CRITICAL: Ensure your User model has 'isOnline' and that it's populated correctly
      .populate('participants', '_id username profileImage avatar isOnline')
      .sort({ updatedAt: -1 }) // Optional: sort by last updated
      .lean(); // .lean() for plain JS objects, faster

    if (!chatRoomsFromDB || chatRoomsFromDB.length === 0) {
        console.log(`No chat rooms found for user ${userId}`);
        return res.json([]); // Return empty array if no rooms
    }

    // Map the database rooms to the structure the client expects
    const clientReadyRooms = await Promise.all(chatRoomsFromDB.map(async (room) => {
      // Create the participant objects for the client
      // The client will iterate through these to find the "other" participant
      const clientParticipants = room.participants.map(p => {
        if (!p) return null; // Should ideally not happen if populate worked
        return {
          _id: p._id.toString(), // Ensure IDs are strings
          username: p.username,
          profileImage: p.profileImage || p.avatar || null, // Prioritize profileImage, fallback to avatar
          isOnline: typeof p.isOnline === 'boolean' ? p.isOnline : false, // Ensure boolean, default false
        };
      }).filter(p => p !== null); // Remove any null participants if populate failed for one

      // Ensure there's at least one "other" participant for the room to be valid for this user's list
      const otherParticipantExists = clientParticipants.some(p => p._id !== userId);
      if (!otherParticipantExists && clientParticipants.length > 0) {
        // This case might indicate a room where the user is alone or data issue.
        console.warn(`Room ${room._id} for user ${userId} does not have a clearly identifiable 'other' participant. Participants:`, clientParticipants);
        // Depending on requirements, you might filter this room out or handle it differently
      }


      // Fetch the last message for the room
      const lastMessageFromDB = await Message.findOne({ roomId: room._id })
        .sort({ createdAt: -1 })
        // Select all fields that the client might need for the ChatMessage model
        .select('_id text imageUrl audioUrl videoUrl fileUrl contactInfo location createdAt senderId readBy')
        .lean();

      // Determine message type (optional, client might do this too)
      const lastMessageType =
        lastMessageFromDB?.imageUrl ? 'image' :
        lastMessageFromDB?.audioUrl ? 'audio' :
        lastMessageFromDB?.videoUrl ? 'video' :
        lastMessageFromDB?.fileUrl ? 'file' :
        lastMessageFromDB?.contactInfo ? 'contact' :
        lastMessageFromDB?.location ? 'location' :
        lastMessageFromDB?.text ? 'text' :
        null;

      // TODO: Implement actual unread messages count logic
      // This is a placeholder. You'll need to compare lastReadTimestamp for the user in this room
      // with message timestamps, or store unread counts explicitly.
      const unreadMessagesCount = 0;

      return {
        _id: room._id.toString(), // Ensure room ID is a string
        participants: clientParticipants, // Array of participant objects
        lastMessage: lastMessageFromDB ? {
            _id: lastMessageFromDB._id.toString(),
            senderId: lastMessageFromDB.senderId?.toString(), // Ensure senderId is string
            text: lastMessageFromDB.text,
            imageUrl: lastMessageFromDB.imageUrl,
            audioUrl: lastMessageFromDB.audioUrl,
            videoUrl: lastMessageFromDB.videoUrl,
            fileUrl: lastMessageFromDB.fileUrl,
            contactInfo: lastMessageFromDB.contactInfo,
            location: lastMessageFromDB.location,
            createdAt: lastMessageFromDB.createdAt,
            // You might also want to send readBy or other relevant fields
        } : null,
        // lastMessageTime is often used for sorting rooms on the client
        lastMessageTime: lastMessageFromDB?.createdAt || room.updatedAt || room.createdAt,
        unreadCount: unreadMessagesCount,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt, // Good to have for client-side sorting or checks
        // Any other fields your Android ChatRoom model expects
      };
    }));

    // Filter out any rooms that might have become invalid during mapping (e.g., no other participant found)
    const validClientReadyRooms = clientReadyRooms.filter(room => {
        return room && room.participants && room.participants.some(p => p._id !== userId);
    });

    res.json(validClientReadyRooms);

  } catch (err) {
    console.error('❌ Error fetching chat rooms:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch chat rooms' });
  }
});

// KEEP THIS - EXPORT THE ROUTER
module.exports = router;
