// TOP-LEVEL DECLARATIONS (REQUIRE STATEMENTS) - KEEP THESE
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const UnreadMessageCount = require('../models/unreadMessageCount.model'); // === ADDED THIS REQUIRE ===
const authMiddleware = require('../middleware/auth');

// --- CREATE OR REUSE A CHAT ROOM ---
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { username: rawRecipientUsername } = req.body;

  console.log('[ChatRoomRoute] POST / - Attempting to create/retrieve chat room');
  console.log(`[ChatRoomRoute] POST / - Authenticated User ID (sender): ${userId}`);
  console.log(`[ChatRoomRoute] POST / - Received recipient username (raw) from request body: "${rawRecipientUsername}"`);

  if (!rawRecipientUsername) {
    console.log('[ChatRoomRoute] POST / - Recipient username not provided in request body.');
    return res.status(400).json({ success: false, message: 'Recipient username is required.' });
  }

  const recipientUsername = rawRecipientUsername.trim().toLowerCase(); // Standardize to lowercase for query

  if (recipientUsername === "") {
    console.log('[ChatRoomRoute] POST / - Recipient username became empty after trimming.');
    return res.status(400).json({ success: false, message: 'Recipient username is invalid.' });
  }
  
  // Ensure the sender's username (if available from req.user) is also standardized if you were to compare them
  const senderUsernameForCheck = req.user.username ? req.user.username.trim().toLowerCase() : null;

  if (senderUsernameForCheck && recipientUsername === senderUsernameForCheck) {
      console.log('[ChatRoomRoute] POST / - User attempting to create chat room with themselves based on username.');
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
  }


  console.log(`[ChatRoomRoute] POST / - Querying User collection for username (trimmed, case-insensitive): "${recipientUsername}"`);

  try {
    // Assuming usernames are stored lowercase or you handle case-insensitivity consistently
    const otherUser = await User.findOne({ username: recipientUsername }); 

    if (!otherUser) {
      console.error(`[ChatRoomRoute] POST / - Recipient NOT FOUND in DB with username: "${recipientUsername}"`);
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    console.log(`[ChatRoomRoute] POST / - Recipient found: ID = ${otherUser._id}, Username = ${otherUser.username}`);

    if (otherUser._id.toString() === userId) {
      // This check is still good as a fallback or if usernames aren't perfectly unique across different casings
      console.log('[ChatRoomRoute] POST / - User attempting to create chat room with themselves based on ID.');
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

    // For 1-on-1 chats, ensure participants are always stored in a consistent order (e.g., sorted alphabetically by ID)
    // This makes finding existing rooms more reliable if the client might send participants in a different order.
    // However, for $all, order doesn't matter. This is fine.
    const participantsArray = [new mongoose.Types.ObjectId(userId), otherUser._id];

    const existingRoom = await ChatRoom.findOne({
      participants: { $all: participantsArray, $size: 2 }, // Ensure it's a 1-on-1 room
      isGroupChat: false // Explicitly look for 1-on-1 if you have this field
    });

    if (existingRoom) {
      console.log(`[ChatRoomRoute] POST / - Existing 1-on-1 chat room found: ${existingRoom._id}`);
      return res.json({
        success: true,
        _id: existingRoom._id, // === CHANGED to _id for consistency ===
        name: otherUser.username, // For 1-on-1, room name is often the other user's name
        participants: [{ // Send participant details consistent with GET
            _id: otherUser._id,
            username: otherUser.username,
            profileImage: otherUser.profileImage || null,
            isOnline: otherUser.isOnline || false,
            lastSeen: otherUser.lastSeen || null
        }],
        isGroupChat: existingRoom.isGroupChat,
        createdAt: existingRoom.createdAt,
        updatedAt: existingRoom.updatedAt,
        message: 'Chat room already exists'
      });
    }

    console.log('[ChatRoomRoute] POST / - No existing 1-on-1 room found. Creating a new chat room.');
    const newRoom = new ChatRoom({
      participants: participantsArray,
      // name: `Chat with ${otherUser.username}`, // Optional: set a default name
      isGroupChat: false, // Explicitly set for new 1-on-1 rooms
      // createdBy: new mongoose.Types.ObjectId(userId) // Optional: track who initiated
    });
    await newRoom.save();
    console.log(`[ChatRoomRoute] POST / - New chat room created successfully: ${newRoom._id}`);

    res.status(201).json({
      success: true,
      _id: newRoom._id, // === CHANGED to _id for consistency ===
      name: otherUser.username, // For 1-on-1, room name is often the other user's name
      participants: [{ // Send participant details consistent with GET
            _id: otherUser._id,
            username: otherUser.username,
            profileImage: otherUser.profileImage || null,
            isOnline: otherUser.isOnline || false,
            lastSeen: otherUser.lastSeen || null
      }],
      isGroupChat: newRoom.isGroupChat,
      createdAt: newRoom.createdAt,
      updatedAt: newRoom.updatedAt,
      message: 'New chat room created'
    });

  } catch (err) {
    console.error('[ChatRoomRoute] POST / - ❌ Chat room creation error:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error creating chat room' });
  }
});


// --- GET ALL CHAT ROOMS FOR THE LOGGED-IN USER ---
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const userObjectId = new mongoose.Types.ObjectId(userId); // Convert once
  console.log(`[ChatRoomRoute] GET / - Fetching enriched chat rooms for user ID: ${userId}`);

  try {
    const chatRoomsFromDB = await ChatRoom.find({ participants: userObjectId })
      // === UPDATED POPULATE: Added isOnline, lastSeen. Removed 'avatar' if not in User model ===
      .populate({
          path: 'participants', 
          select: 'username profileImage _id isOnline lastSeen' // Select all needed fields
      })
      .sort({ updatedAt: -1 }) // Sort rooms by recent activity
      .lean();

    if (!chatRoomsFromDB || chatRoomsFromDB.length === 0) {
        console.log(`[ChatRoomRoute] GET / - No chat rooms found for user ${userId}`);
        return res.json([]);
    }
    console.log(`[ChatRoomRoute] GET / - Found ${chatRoomsFromDB.length} initial chat rooms for user ${userId}. Enriching...`);

    const enrichedRooms = await Promise.all(chatRoomsFromDB.map(async (room) => {
      // Find the other participant(s)
      // For 1-on-1 chats, there will be one other participant.
      // For group chats, this logic would need to adapt or client handles multiple participants.
      const otherParticipantData = room.participants
                                     .filter(p => p && p._id && p._id.toString() !== userId)
                                     .map(p => ({ // Transform to consistent client-side structure
                                        _id: p._id.toString(),
                                        username: p.username,
                                        profileImage: p.profileImage || null,
                                        isOnline: p.isOnline || false,
                                        lastSeen: p.lastSeen || null
                                     }));
      
      let roomName = room.name; // Use existing room name if set (e.g., for group chats)
      // For 1-on-1 chats, if no room name, use the other participant's username
      if (!roomName && !room.isGroupChat && otherParticipantData.length === 1) {
          roomName = otherParticipantData[0].username;
      } else if (!roomName && room.isGroupChat) {
          roomName = "Group Chat"; // Fallback name for group chats
      }


      if (room.isGroupChat === false && otherParticipantData.length === 0 && room.participants.length > 1) {
        // This could happen if a participant user document was deleted or is inconsistent
        console.warn(`[ChatRoomRoute] GET / - Room ${room._id} (1-on-1) missing other participant data after populate. Original participants: ${room.participants.map(p=>p?._id?.toString())}. Current user: ${userId}`);
        // Decide how to handle: skip room, or return with placeholder? For now, let's skip.
        // return null; 
      }
      
      // Fetch the last message
      const lastMessageFromDB = await Message.findOne({ roomId: room._id })
        .sort({ createdAt: -1 }) // Messages should be sorted by their own creation time
        .populate('senderId', 'username _id') // Populate sender of last message
        .select('text imageUrl audioUrl videoUrl fileUrl contactInfo location createdAt senderId') // Keep senderId selected
        .lean();

      // Fetch unread messages count for the current user in this room
      let unreadMessagesCount = 0;
      try {
        const unreadEntry = await UnreadMessageCount.findOne({
            userId: userObjectId,
            roomId: room._id
        }).lean();
        if (unreadEntry) {
            unreadMessagesCount = unreadEntry.count;
        }
      } catch (unreadError) {
        console.error(`[ChatRoomRoute] GET / - Error fetching unread count for room ${room._id}, user ${userId}: ${unreadError.message}`);
      }

      const roomForClient = {
        _id: room._id.toString(),
        name: roomName, // Use the determined room name
        participants: otherParticipantData, // This will be an array of other participants
        isGroupChat: room.isGroupChat || false, // Default to false if not set
        lastMessage: lastMessageFromDB ? {
            _id: lastMessageFromDB._id.toString(),
            senderId: lastMessageFromDB.senderId?._id?.toString() || null, // Handle if senderId is not populated or null
            senderUsername: lastMessageFromDB.senderId?.username || 'User', // Handle if senderId or username is not populated
            text: lastMessageFromDB.text,
            imageUrl: lastMessageFromDB.imageUrl,
            audioUrl: lastMessageFromDB.audioUrl,
            videoUrl: lastMessageFromDB.videoUrl,
            fileUrl: lastMessageFromDB.fileUrl,
            contactInfo: lastMessageFromDB.contactInfo,
            location: lastMessageFromDB.location,
            createdAt: lastMessageFromDB.createdAt
        } : null,
        // Use message's createdAt for lastMessageTime primarily, then room's updatedAt
        lastMessageTime: lastMessageFromDB?.createdAt || room.updatedAt || room.createdAt,
        unreadCount: unreadMessagesCount,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt // Good to send this too
      };
      
      // For 1-on-1 chats, if after all this there's no other participant, it's problematic
      if (!room.isGroupChat && otherParticipantData.length === 0) {
           console.warn(`[ChatRoomRoute] GET / - Skipping 1-on-1 room ${room._id} for user ${userId} as no other participant data was resolved.`);
           return null; // Skip this room from the final list
      }

      return roomForClient;
    }));

    const validEnrichedRooms = enrichedRooms.filter(room => room !== null);
    console.log(`[ChatRoomRoute] GET / - Returning ${validEnrichedRooms.length} enriched rooms for user ${userId}.`);
    res.json(validEnrichedRooms);

  } catch (err) {
    console.error('[ChatRoomRoute] GET / - ❌ Error fetching chat rooms:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch chat rooms' });
  }
});

// KEEP THIS - EXPORT THE ROUTER
module.exports = router;
