// TOP-LEVEL DECLARATIONS (REQUIRE STATEMENTS) - KEEP THESE
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const Notification = require('../models/notifications.model');
const UnreadMessageCount = require('../models/unreadMessageCount.model');
const authMiddleware = require('../middleware/auth');
const { areUsersBlocked, canMessageUser } = require('../services/privacy.service');
const { syncChatParticipantsAsContacts } = require('../services/contact.service');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function participantKeyFor(userA, userB) {
  return [userA.toString(), userB.toString()].sort().join(':');
}

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
    const otherUser = await User.findOne({ username: new RegExp(`^${escapeRegExp(recipientUsername)}$`, 'i') });

    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (otherUser._id.toString() === userId) {
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

    const permission = await canMessageUser(userId, otherUser._id);
    if (!permission.allowed) {
      if (permission.reason === 'requires_approval') {
        await Notification.findOneAndUpdate(
          {
            type: 'message_request',
            senderId: userId,
            receiverId: otherUser._id,
            status: 'unread'
          },
          {
            $setOnInsert: {
              type: 'message_request',
              senderId: userId,
              receiverId: otherUser._id,
              message: 'wants to message you',
              activityId: userId,
              targetType: 'profile',
              targetId: userId,
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );

        return res.status(202).json({
          success: false,
          message: 'Message request sent',
          reason: permission.reason,
          receiverId: otherUser._id
        });
      }

      const status = permission.reason?.includes('blocked') ? 403 : 423;
      return res.status(status).json({
        success: false,
        message: permission.reason === 'requires_approval'
          ? 'This user requires message approval'
          : permission.message,
        reason: permission.reason
      });
    }

    const participantKey = participantKeyFor(userId, otherUser._id);
    const existingRoom = await ChatRoom.findOne({
      $or: [
        { participantKey },
        { participants: { $size: 2, $all: [userId, otherUser._id] } },
      ],
    });


    if (existingRoom) {
      await syncChatParticipantsAsContacts(req.user, otherUser, { lastInteractionAt: new Date() });
      return res.json({
        success: true,
        roomId: existingRoom._id,
        message: 'Chat room already exists',
        participant: {
          _id: otherUser._id,
          username: otherUser.username,
          avatar: otherUser.avatar || otherUser.profileImage || null,
          online: otherUser.online || false,
          isOnline: otherUser.online || false,
          lastSeen: otherUser.lastSeen || null
        }
      });
    }

    const newRoom = new ChatRoom({
      participants: [new mongoose.Types.ObjectId(userId), otherUser._id],
      participantKey,
    });
    try {
      await newRoom.save();
    } catch (saveErr) {
      if (saveErr?.code === 11000) {
        const existingAfterRace = await ChatRoom.findOne({ participantKey });
        if (existingAfterRace) {
          await syncChatParticipantsAsContacts(req.user, otherUser, { lastInteractionAt: new Date() });
          return res.json({
            success: true,
            roomId: existingAfterRace._id,
            message: 'Chat room already exists',
            participant: {
              _id: otherUser._id,
              username: otherUser.username,
              avatar: otherUser.avatar || otherUser.profileImage || null,
              online: otherUser.online || false,
              isOnline: otherUser.online || false,
              lastSeen: otherUser.lastSeen || null
            }
          });
        }
      }
      throw saveErr;
    }

    await syncChatParticipantsAsContacts(req.user, otherUser, { lastInteractionAt: new Date() });

    res.status(201).json({
      success: true,
      roomId: newRoom._id,
      message: 'New chat room created',
      participant: {
        _id: otherUser._id,
        username: otherUser.username,
        avatar: otherUser.avatar || otherUser.profileImage || null,
        online: otherUser.online || false,
        isOnline: otherUser.online || false,
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
      .populate('participants', 'username avatar profileImage online lastSeen _id')
      .lean();

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const otherParticipant = room.participants.find(p => p._id.toString() !== userId);
    if (!otherParticipant) {
      return res.status(400).json({ success: false, message: 'No other participant found' });
    }

    if (await areUsersBlocked(userId, otherParticipant._id)) {
      return res.status(403).json({ success: false, message: 'Room unavailable' });
    }

    res.json({
      success: true,
      participant: {
        _id: otherParticipant._id,
        username: otherParticipant.username,
        avatar: otherParticipant.avatar || otherParticipant.profileImage || null,
        profileImage: otherParticipant.profileImage || otherParticipant.avatar || null,
        isOnline: otherParticipant.online || false,
        online: otherParticipant.online || false,
        lastSeen: otherParticipant.lastSeen || null
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
      .populate('participants', 'username profileImage online lastSeen _id')
      .lean();

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const receiver = room.participants.find(p => p._id.toString() !== userId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    if (await areUsersBlocked(userId, receiver._id)) {
      return res.status(403).json({ success: false, message: 'Receiver unavailable' });
    }

    res.json({
      success: true,
      receiver: {
        _id: receiver._id,
        username: receiver.username,
        profileImage: receiver.profileImage || null,
        isOnline: receiver.online || false,
        online: receiver.online || false,
        lastSeen: receiver.lastSeen || null
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
    const chatRoomsFromDB = await ChatRoom.find({
      participants: new mongoose.Types.ObjectId(userId),
      roomType: { $ne: 'group' }
    })
      .populate('participants', 'username profileImage avatar online lastSeen _id')
      .lean();

    if (!chatRoomsFromDB || chatRoomsFromDB.length === 0) {
      return res.json([]);
    }

    const enrichedRooms = await Promise.all(chatRoomsFromDB.map(async (room) => {
      const otherParticipantObject = room.participants.find(p => p && p._id && p._id.toString() !== userId);

      if (otherParticipantObject && await areUsersBlocked(userId, otherParticipantObject._id)) {
        return null;
      }

      let participantForClient = null;
      if (otherParticipantObject) {
        participantForClient = {
          _id: otherParticipantObject._id,
          username: otherParticipantObject.username || null,
          profileImage: otherParticipantObject.profileImage || otherParticipantObject.avatar || null,
          isOnline: otherParticipantObject.online || false,
          online: otherParticipantObject.online || false,
          lastSeen: otherParticipantObject.lastSeen || null
        };
      }

      const lastMessageFromDB = await Message.findOne({ roomId: room._id })
        .sort({ createdAt: -1 })
        .select('text imageUrl audioUrl videoUrl fileUrl contactInfo location createdAt senderId')
        .populate('senderId', 'username profileImage _id')
        .lean();

      const unreadCountDoc = await UnreadMessageCount
        .findOne({ userId, roomId: room._id })
        .select('count')
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
        unreadCount: Number(unreadCountDoc?.count || 0),
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
