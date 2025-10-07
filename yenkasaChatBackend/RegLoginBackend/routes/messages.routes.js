const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');

const auth = require('../middleware/auth');
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const UnreadMessageCount = require('../models/unreadMessageCount.model');
const unreadCountService = require('../services/unreadCount.service');

// --- OneSignal Config ---
const ONE_SIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const YENKASACHAT_ONE_SIGNAL_KEY = process.env.yenkasachatOneSignalKey;
const ONE_SIGNAL_ANDROID_CHANNEL_ID = process.env.ONESIGNAL_ANDROID_CHANNEL_ID;

// ✅ POST: Send a message (supports repliedTo)
router.post('/', auth, async (req, res) => {
  console.log('[MessagesRoute] POST / - Received message from:', req.user.id);

  const {
    roomId,
    text,
    imageUrl,
    audioUrl,
    videoUrl,
    fileUrl,
    contactInfo,
    location,
    repliedTo, // ✅ added
  } = req.body;

  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(400).json({ error: 'Valid roomId is required' });
  }

  const hasContent =
    text ||
    imageUrl ||
    audioUrl ||
    videoUrl ||
    fileUrl ||
    contactInfo ||
    (location?.latitude && location?.longitude);

  if (!hasContent) {
    return res.status(400).json({ error: 'Message must contain some content' });
  }

  try {
    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) return res.status(404).json({ error: 'Chat room not found' });

    const senderAppUserId = req.user.id.toString();
    const senderUsername = req.user.username || 'A user';

    // ✅ Create message object with repliedTo reference
    const newMessage = new Message({
      roomId,
      senderId: senderAppUserId,
      text: text ? text.trim().substring(0, 2000) : null,
      imageUrl,
      audioUrl,
      videoUrl,
      fileUrl,
      contactInfo,
      location,
      repliedTo: repliedTo && mongoose.Types.ObjectId.isValid(repliedTo)
        ? new mongoose.Types.ObjectId(repliedTo)
        : null, // ✅ safely add reply reference
      timestamp: new Date(),
    });

    await newMessage.save();
    console.log(`[MessagesRoute] ✅ Message saved with ID: ${newMessage._id}`);

    // --- Push Notification Logic (unchanged) ---
    const participantAppUserIds = chatRoom.participants.map(p => p.toString());
    const recipientAppUserIds = participantAppUserIds.filter(id => id !== senderAppUserId);

    if (recipientAppUserIds.length > 0) {
      for (const recipientId of recipientAppUserIds) {
        await unreadCountService.incrementUnreadCount(recipientId, newMessage.roomId);
      }

      if (ONE_SIGNAL_APP_ID && YENKASACHAT_ONE_SIGNAL_KEY) {
        const recipients = await User.find(
          { _id: { $in: recipientAppUserIds.map(id => new mongoose.Types.ObjectId(id)) } },
          'username playerId'
        ).lean();

        const validPlayerIds = recipients
          .filter(u => u.playerId && u.playerId.trim() !== '')
          .map(u => u.playerId.trim());

        if (validPlayerIds.length > 0) {
          let notificationTitle = `New message from ${senderUsername}`;
          let notificationBody = text || 'Sent you a message';
          if (imageUrl) notificationBody = `${senderUsername} sent an image`;
          else if (audioUrl) notificationBody = `${senderUsername} sent an audio message`;
          else if (videoUrl) notificationBody = `${senderUsername} sent a video`;
          else if (fileUrl) notificationBody = `${senderUsername} sent a file`;

          const payload = {
            app_id: ONE_SIGNAL_APP_ID,
            include_player_ids: validPlayerIds,
            headings: { en: notificationTitle },
            contents: { en: notificationBody },
            data: {
              roomId: newMessage.roomId.toString(),
              senderId: senderAppUserId,
              messageId: newMessage._id.toString(),
              type: 'new_chat_message',
            },
          };

          if (ONE_SIGNAL_ANDROID_CHANNEL_ID) {
            payload.android_channel_id = ONE_SIGNAL_ANDROID_CHANNEL_ID;
          }

          try {
            await axios.post('https://onesignal.com/api/v1/notifications', payload, {
              headers: {
                Authorization: `Basic ${YENKASACHAT_ONE_SIGNAL_KEY}`,
                'Content-Type': 'application/json',
              },
            });
          } catch (err) {
            console.error('⚠️ OneSignal error:', err.response?.data || err.message);
          }
        }
      }
    }

    // ✅ Populate sender and repliedTo message before sending response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate({
        path: 'senderId',
        select: 'username profileImage _id',
      })
      .populate({
        path: 'repliedTo',
        populate: { path: 'senderId', select: 'username profileImage _id' },
      })
      .lean();

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error('[MessagesRoute] ❌ Error saving message:', err.message);
    res.status(500).json({ error: 'Server error saving message' });
  }
});

// ✅ GET: Messages for a chat room (includes repliedTo data)
router.get('/:roomId', auth, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(400).json({ error: 'Invalid roomId' });
  }

  try {
    const chatRoom = await ChatRoom.findOne({ _id: roomId, participants: userId });
    if (!chatRoom) return res.status(403).json({ error: 'Not authorized for this room' });

    const messages = await Message.find({ roomId })
      .sort({ timestamp: 1 })
      .populate({
        path: 'senderId',
        select: 'username profileImage _id',
      })
      .populate({
        path: 'repliedTo',
        populate: { path: 'senderId', select: 'username profileImage _id' },
      }) // ✅ Include repliedTo data
      .lean();

    res.json(messages);
  } catch (err) {
    console.error('[MessagesRoute] ❌ Error fetching messages:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// --- Mark as Read (unchanged) ---
router.post('/:roomId/mark-as-read', auth, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(400).json({ message: 'Invalid room ID' });
  }

  try {
    await UnreadMessageCount.updateOne(
      { userId, roomId },
      { $set: { count: 0 } },
      { upsert: true }
    );
    res.status(200).json({ message: 'Room marked as read' });
  } catch (err) {
    console.error('Error marking as read:', err);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

module.exports = router;
