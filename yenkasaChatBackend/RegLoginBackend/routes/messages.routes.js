const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');

const auth = require('../middleware/auth');
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Notification = require('../models/notifications.model');
const UnreadMessageCount = require('../models/unreadMessageCount.model');
const unreadCountService = require('../services/unreadCount.service');
const { sendNotification } = require('../services/notification.service');
const { canMessageUser } = require('../services/privacy.service');
const { syncChatParticipantsAsContacts } = require('../services/contact.service');
const { updateConversationStreak } = require('../utils/conversationStreak');
const { logUploadAudit } = require('../utils/cloudinaryMedia');
const mediaStorage = require('../services/mediaStorage.service');
const { publishYmeEvent } = require('../src/yme/services/eventPublisher.service');

const chatMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    cb(allowed ? null : new Error('Unsupported file type'), allowed);
  }
});

const cleanPushId = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const maskPushId = (value) => {
  const id = cleanPushId(value);
  if (!id) return null;
  if (id.length <= 12) return `${id.slice(0, 3)}...${id.slice(-3)}`;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
};

const firstValidPushId = (...values) =>
  values.map(cleanPushId).find(Boolean) || null;

function resolveChatUploadType(file, requestedType = '') {
  const type = String(requestedType || '').toLowerCase();
  if (['image', 'video', 'audio', 'file'].includes(type)) return type;
  if (file?.mimetype?.startsWith('image/')) return 'image';
  if (file?.mimetype?.startsWith('video/')) return 'video';
  if (file?.mimetype?.startsWith('audio/')) return 'audio';
  return 'file';
}

// ✅ POST: Upload web chat media before sending a message URL
router.post('/upload', auth, chatMediaUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No chat media file uploaded' });
  }

  try {
    const type = resolveChatUploadType(req.file, req.body?.type);
    const result = await mediaStorage.upload(req.file, {
      folder: 'chat',
      type,
      area: `chat_${type}`,
    });
    logUploadAudit({ area: `chat_${type}`, file: req.file, result });
    const messageKey = type === 'image'
      ? 'imageUrl'
      : type === 'video'
        ? 'videoUrl'
        : type === 'audio'
          ? 'audioUrl'
          : 'fileUrl';

    res.json({
      success: true,
      type,
      messageKey,
      url: result.secure_url,
      publicId: result.public_id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      bytes: result.bytes,
    });
  } catch (err) {
    console.error('[MessagesRoute] ❌ Chat media upload failed:', err.message);
    res.status(500).json({ error: 'Failed to upload chat media' });
  }
});

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
    messageType,
    repliedTo, // ✅ added
    playerId,
    receiverPlayerId,
    recipientPlayerId,
    targetPlayerId,
    onesignalPlayerId,
  } = req.body;

  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    return res.status(400).json({ error: 'Valid roomId is required' });
  }

  const hasLocation =
    location &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number';

  const normalizedText = typeof text === 'string' ? text.trim() : '';
  const normalizedMessageType = messageType === 'laugh_reaction' ? 'laugh_reaction' : 'message';
  const hasContent =
    normalizedMessageType === 'laugh_reaction' ||
    normalizedText ||
    imageUrl ||
    audioUrl ||
    videoUrl ||
    fileUrl ||
    contactInfo ||
    hasLocation;

  if (!hasContent) {
    return res.status(400).json({ error: 'Message must contain some content' });
  }

  try {
    const chatRoom = await ChatRoom.findById(roomId);
    if (!chatRoom) return res.status(404).json({ error: 'Chat room not found' });

    const senderAppUserId = req.user.id.toString();
    const senderUsername = req.user.username || 'A user';
    const senderPlayerIdFromPayload = cleanPushId(playerId);
    const participantAppUserIds = chatRoom.participants.map(p => p.toString());

    if (!participantAppUserIds.includes(senderAppUserId)) {
      return res.status(403).json({ error: 'Not authorized for this room' });
    }

    const recipientAppUserIds = participantAppUserIds.filter(id => id !== senderAppUserId);

    for (const recipientId of recipientAppUserIds) {
      if (chatRoom.roomType === 'group') break;
      const permission = await canMessageUser(senderAppUserId, recipientId);
      if (!permission.allowed) {
        if (permission.reason === 'requires_approval') {
          await Notification.findOneAndUpdate(
            {
              type: 'message_request',
              senderId: senderAppUserId,
              receiverId: recipientId,
              status: 'unread'
            },
            {
              $setOnInsert: {
                type: 'message_request',
                senderId: senderAppUserId,
                receiverId: recipientId,
                message: 'wants to message you',
                activityId: senderAppUserId,
                targetType: 'profile',
                targetId: senderAppUserId,
                createdAt: new Date()
              }
            },
            { upsert: true, new: true }
          );
        }

        return res.status(permission.reason?.includes('blocked') ? 403 : 423).json({
          error: permission.reason === 'requires_approval'
            ? 'Message request sent. You can chat after they approve it.'
            : permission.message,
          reason: permission.reason
        });
      }
    }

    if (senderPlayerIdFromPayload) {
      try {
        await User.updateOne(
          { _id: senderAppUserId },
          {
            $set: {
              playerId: senderPlayerIdFromPayload,
              updatedAt: new Date()
            }
          }
        );
        console.log('[MessagesRoute] ✅ Synced sender OneSignal playerId from message payload:', {
          senderId: senderAppUserId,
          playerId: maskPushId(senderPlayerIdFromPayload)
        });
      } catch (syncErr) {
        console.warn('[MessagesRoute] ⚠️ Failed to sync sender playerId from message payload:', syncErr.message);
      }
    } else {
      console.warn('[MessagesRoute] ⚠️ Message payload did not include sender playerId. Push fallback may rely only on stored user.playerId.');
    }

    // ✅ Create message object with repliedTo reference
    const newMessage = new Message({
      roomId,
      conversationId: roomId,
      senderId: senderAppUserId,
      text: normalizedText ? normalizedText.substring(0, 2000) : normalizedMessageType === 'laugh_reaction' ? '😂' : null,
      messageType: normalizedMessageType,
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

    publishYmeEvent(
      {
        userId: senderAppUserId,
        sourceApp: 'social_app',
        eventType: 'chat_sent',
        conversationId: roomId,
        messageId: newMessage._id.toString(),
        relatedUserId: recipientAppUserIds[0] || '',
        text: normalizedText || '',
        payload: {
          roomType: chatRoom.roomType || 'direct',
          hasImage: Boolean(imageUrl),
          hasAudio: Boolean(audioUrl),
          hasVideo: Boolean(videoUrl),
          hasFile: Boolean(fileUrl),
          messageType: normalizedMessageType,
        },
      },
      {
        defaults: {
          userId: senderAppUserId,
          sourceApp: 'social_app',
        },
      },
    );

    if (chatRoom.roomType !== 'group' && recipientAppUserIds.length === 1) {
      const recipientUser = await User.findById(recipientAppUserIds[0])
        .select('_id username profileImage avatar')
        .lean();
      if (recipientUser) {
        await syncChatParticipantsAsContacts(req.user, recipientUser, {
          lastInteractionAt: newMessage.createdAt || newMessage.timestamp || new Date()
        });
      }
    }

    const streakUserIds = Array.from(new Set([senderAppUserId, ...recipientAppUserIds].filter(Boolean)));
    Promise.allSettled(streakUserIds.map((id) => updateConversationStreak(id)))
      .catch((streakErr) => {
        console.warn('[MessagesRoute] ⚠️ Conversation streak update failed:', streakErr.message);
      });

    // --- Shared Notification + Unread Logic ---
    if (recipientAppUserIds.length > 0) {
      for (const recipientId of recipientAppUserIds) {
        await unreadCountService.incrementUnreadCount(recipientId, newMessage.roomId);
      }

      const senderPushUser = await User.findById(senderAppUserId)
        .select('username playerId')
        .lean();

      const payloadRecipientPlayerId = firstValidPushId(
        receiverPlayerId,
        recipientPlayerId,
        targetPlayerId,
        onesignalPlayerId
      );

      const senderPlayerIds = new Set([
        senderPlayerIdFromPayload,
        cleanPushId(senderPushUser?.playerId)
      ].filter(Boolean));

      const isGroupMessage = chatRoom.roomType === 'group';
      const groupName = chatRoom.groupName || 'Yenkasa Group';
      let notificationBody = normalizedText || 'Sent you a message';
      if (imageUrl) notificationBody = `${senderUsername} sent an image`;
      else if (audioUrl) notificationBody = `${senderUsername} sent an audio message`;
      else if (videoUrl) notificationBody = `${senderUsername} sent a video`;
      else if (fileUrl) notificationBody = `${senderUsername} sent a file`;
      if (isGroupMessage && normalizedText) {
        notificationBody = `${senderUsername}: ${normalizedText}`;
      }

      console.log('[MessagesRoute] Shared chat notification dispatch:', {
        roomId,
        messageId: newMessage._id.toString(),
        senderId: senderAppUserId,
        receiverIds: recipientAppUserIds,
        receiverCount: recipientAppUserIds.length,
        senderPlayerIdsExcluded: Array.from(senderPlayerIds).map(maskPushId),
        payloadRecipientPlayerId: maskPushId(payloadRecipientPlayerId)
      });

      for (const recipientId of recipientAppUserIds) {
        await sendNotification({
          type: 'new_chat_message',
          senderId: senderAppUserId,
          receiverId: recipientId,
          activityId: newMessage._id.toString(),
          targetType: 'chat',
          targetId: newMessage.roomId.toString(),
          targetUrl: `/chat/${newMessage.roomId.toString()}`,
          message: notificationBody,
          emitSocket: true,
          push: true,
          pushTitle: isGroupMessage ? groupName : `New message from ${senderUsername}`,
          pushBody: notificationBody,
          pushCollapseId: `chat_${newMessage._id.toString()}`,
          pushAndroidGroup: `chat_${newMessage.roomId.toString()}`,
          pushAndroidGroupMessage: 'New messages',
          pushTtl: 604800,
          pushPriority: 10,
          pushData: {
            roomId: newMessage.roomId.toString(),
            chatId: newMessage.roomId.toString(),
            senderId: senderAppUserId,
            messageId: newMessage._id.toString(),
            type: 'new_chat_message',
            targetType: 'chat',
            targetId: newMessage.roomId.toString(),
            isGroupChat: isGroupMessage,
            groupName: isGroupMessage ? groupName : '',
            groupImage: isGroupMessage ? (chatRoom.groupImage || '') : '',
            groupMemberCount: isGroupMessage
              ? (chatRoom.groupMembers?.length || chatRoom.participants?.length || 0)
              : 0
          },
          excludePlayerIds: Array.from(senderPlayerIds)
        });
      }
    }

    // ✅ Populate sender and repliedTo message before sending response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate({
        path: 'sender',
        select: 'username profileImage _id',
      })
      .populate({
        path: 'repliedTo',
        populate: { path: 'sender', select: 'username profileImage _id' },
      })
      .lean();

    if (global.io) {
      const targetRooms = [
        newMessage.roomId.toString(),
        senderAppUserId,
        ...recipientAppUserIds
      ];
      global.io.to(targetRooms).emit('messageCreated', populatedMessage);
      global.io.to(targetRooms).emit('chatRoomUpdated', {
        roomId: newMessage.roomId.toString(),
        lastMessage: populatedMessage,
        lastMessageTime: populatedMessage?.timestamp || populatedMessage?.createdAt || new Date().toISOString()
      });
    }

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error('[MessagesRoute] ❌ Error saving message:', err.message);
    res.status(500).json({ error: 'Server error saving message' });
  }
});

async function resolveMessageRoomId(id, userId) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { status: 'invalid', roomId: null, chatRoom: null };
  }

  const chatRoom = await ChatRoom.findOne({ _id: id, participants: userId });
  if (chatRoom) {
    return { status: 'room', roomId: chatRoom._id, chatRoom };
  }

  const targetUser = await User.findById(id).select('_id').lean();
  if (!targetUser) {
    return { status: 'missing', roomId: id, chatRoom: null };
  }

  const directRoom = await ChatRoom.findOne({
    participants: {
      $size: 2,
      $all: [
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(id)
      ]
    }
  });

  if (!directRoom) {
    return { status: 'empty_user_conversation', roomId: null, chatRoom: null, targetUserId: id };
  }

  return { status: 'user', roomId: directRoom._id, chatRoom: directRoom, targetUserId: id };
}

async function fetchMessagesForConversation(req, res) {
  const id = req.params.id || req.params.userId;
  const userId = req.user.id.toString();

  console.log("Fetching messages for:", id);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn('[MessagesRoute] ⚠️ Invalid message conversation id:', id);
    return res.json([]);
  }

  try {
    const resolved = await resolveMessageRoomId(id, userId);

    if (resolved.status === 'empty_user_conversation' || resolved.status === 'missing') {
      console.log('[MessagesRoute] No chat room/messages found; returning empty array:', {
        requestedId: id,
        status: resolved.status
      });
      return res.json([]);
    }

    if (!resolved.chatRoom || !resolved.roomId) {
      return res.json([]);
    }

    const chatRoom = resolved.chatRoom;
    const roomId = resolved.roomId;
    const participantIds = chatRoom.participants.map(participantId => participantId.toString());

    if (!participantIds.includes(userId)) {
      console.warn('[MessagesRoute] ⚠️ User tried to fetch room they do not belong to:', {
        requestedId: id,
        resolvedRoomId: roomId.toString(),
        userId
      });
      return res.status(403).json({ error: 'Not authorized for this room' });
    }

    for (const participantId of participantIds) {
      if (participantId !== userId) {
        const permission = await canMessageUser(userId, participantId);
        if (!permission.allowed && permission.reason?.includes('blocked')) {
        console.warn('[MessagesRoute] ⚠️ Message fetch blocked by privacy settings:', {
          requestedId: id,
          roomId: roomId.toString(),
          userId,
          participantId
        });
          return res.status(403).json({
            error: permission.message,
            reason: permission.reason
          });
        }
      }
    }

    const messages = await Message.find({
      $or: [
        { roomId },
        { conversationId: roomId },
        { conversationId: id }
      ]
    })
      .sort({ timestamp: 1 })
      .populate({
        path: 'sender',
        select: 'username profileImage _id',
      })
      .populate({
        path: 'repliedTo',
        populate: { path: 'sender', select: 'username profileImage _id' },
      }) // ✅ Include repliedTo data
      .lean();

    console.log('[MessagesRoute] ✅ Messages fetched:', {
      requestedId: id,
      roomId: roomId.toString(),
      count: messages.length
    });

    res.json(messages);
  } catch (err) {
    console.error('[MessagesRoute] ❌ Error fetching messages:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

// ✅ GET: Messages by direct user id. Returns [] if no room/messages exist.
router.get('/user/:userId', auth, fetchMessagesForConversation);

// ✅ GET: Messages for a chat room/conversation ID, with user ID fallback
router.get('/:id', auth, fetchMessagesForConversation);

// ✅ PATCH: Edit a text message owned by the logged-in user
router.patch('/:messageId', auth, async (req, res) => {
  const { messageId } = req.params;
  const { text } = req.body;
  const userId = req.user.id.toString();

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ error: 'Invalid message ID' });
  }

  const nextText = typeof text === 'string' ? text.trim().substring(0, 2000) : '';
  if (!nextText) {
    return res.status(400).json({ error: 'Edited message text is required' });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (message.senderId?.toString() !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    if (message.imageUrl || message.audioUrl || message.videoUrl || message.fileUrl || message.location || message.contactInfo) {
      return res.status(400).json({ error: 'Only plain text messages can be edited' });
    }

    message.text = nextText;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await Message.findById(message._id)
      .populate({ path: 'sender' })
      .populate({
        path: 'repliedTo',
        populate: { path: 'sender', select: 'username profileImage _id' },
      })
      .lean();

    if (global.io) {
      const editRoom = await ChatRoom.findById(message.roomId).select('participants').lean();
      const targetRooms = [
        message.roomId.toString(),
        ...(editRoom?.participants || []).map(participantId => participantId.toString())
      ];
      global.io.to(targetRooms).emit('messageEdited', updatedMessage);
    }

    res.json(updatedMessage);
  } catch (err) {
    console.error('[MessagesRoute] ❌ Error editing message:', err.message);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// ✅ DELETE: Delete a message owned by the logged-in user
router.delete('/:messageId', auth, async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id.toString();

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ error: 'Invalid message ID' });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (message.senderId?.toString() !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    const deleteRoom = await ChatRoom.findById(message.roomId).select('participants').lean();
    await message.deleteOne();

    if (global.io) {
      const targetRooms = [
        message.roomId.toString(),
        ...(deleteRoom?.participants || []).map(participantId => participantId.toString())
      ];
      global.io.to(targetRooms).emit('messageDeleted', {
        messageId,
        roomId: message.roomId.toString()
      });
    }

    publishYmeEvent({
      userId,
      sourceApp: 'social_app',
      eventType: 'chat_deleted',
      conversationId: message.roomId.toString(),
      messageId: message._id.toString(),
      relatedUserId: (deleteRoom?.participants || []).find(
        (participantId) => participantId?.toString() !== userId,
      )?.toString?.() || '',
      text: message.text || '',
      payload: {
        messageType: message.messageType || 'message',
        roomType: deleteRoom?.participants?.length > 2 ? 'group' : 'direct',
      },
    });

    res.status(204).send();
  } catch (err) {
    console.error('[MessagesRoute] ❌ Error deleting message:', err.message);
    res.status(500).json({ error: 'Failed to delete message' });
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
    const chatRoom = await ChatRoom.findOne({ _id: roomId, participants: userId });
    if (!chatRoom) return res.status(403).json({ message: 'Not authorized for this room' });

    await UnreadMessageCount.updateOne(
      { userId, roomId },
      { $set: { count: 0, lastReadTimestamp: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
    if (global.io) {
      global.io.to(userId.toString()).emit('chatRoomRead', {
        roomId,
        unreadCount: 0,
        readAt: new Date().toISOString()
      });
    }

    publishYmeEvent({
      userId,
      sourceApp: 'social_app',
      eventType: 'chat_read',
      conversationId: roomId,
      relatedUserId: (chatRoom.participants || []).find(
        (participantId) => participantId?.toString() !== userId.toString(),
      )?.toString?.() || '',
      payload: {
        roomType: chatRoom.roomType || (chatRoom.participants?.length > 2 ? 'group' : 'direct'),
        unreadCount: 0,
      },
    });

    res.status(200).json({ message: 'Room marked as read' });
  } catch (err) {
    console.error('Error marking as read:', err);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

module.exports = router;
