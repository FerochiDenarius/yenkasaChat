const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const { sendPushNotification } = require('../utils/onesignal');

// =========================
// 🔸 POST: Send a message
// =========================
router.post('/', auth, async (req, res) => {
    const { roomId, text, imageUrl, audioUrl, videoUrl, fileUrl, contactInfo, location } = req.body;

    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: 'Invalid or missing roomId' });
    }

    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized: Missing user info' });
    }

    const hasContent =
        !!(text?.trim() || imageUrl?.trim() || audioUrl?.trim() || videoUrl?.trim() || fileUrl?.trim() ||
        contactInfo || (location?.latitude && location?.longitude));

    if (!hasContent) {
        return res.status(400).json({ error: 'Message must contain some form of content' });
    }

    try {
        const chatRoom = await ChatRoom.findById(roomId).populate('members.user', 'username playerId');
        if (!chatRoom) return res.status(404).json({ error: 'Chat room not found' });

        const isMember = chatRoom.members.some(member => member.user?._id?.toString() === req.user.id);
        if (!isMember) return res.status(403).json({ error: 'Not a member of this room' });

        const newMessage = new Message({
            roomId,
            senderId: req.user.id,
            text: text?.trim().slice(0, 1000),
            imageUrl, audioUrl, videoUrl, fileUrl, contactInfo, location,
            timestamp: new Date()
        });

        await newMessage.save();

        chatRoom.lastMessage = newMessage.text || 'Media message';
        chatRoom.lastMessageTimestamp = newMessage.timestamp;
        await chatRoom.save();

        const sender = chatRoom.members.find(m => m.user._id.toString() === req.user.id)?.user;
        const senderName = sender?.username || 'Someone';

        const recipients = chatRoom.members.filter(m => m.user._id.toString() !== req.user.id && m.user.playerId);
        if (recipients.length > 0) {
            const playerIds = recipients.map(m => m.user.playerId);
            const body = newMessage.text ? `${senderName}: ${newMessage.text.slice(0, 50)}` : `${senderName} sent a message`;
            const typeMsg = newMessage.imageUrl ? 'sent an image' : newMessage.audioUrl ? 'sent an audio' :
                newMessage.videoUrl ? 'sent a video' : newMessage.fileUrl ? 'sent a file' :
                newMessage.contactInfo ? 'shared a contact' : newMessage.location ? 'shared a location' : body;

            await sendPushNotification({
                playerId: playerIds,
                title: chatRoom.name || 'New message',
                body: typeMsg,
                data: { roomId, messageId: newMessage._id, senderId: req.user.id }
            });
        }

        res.status(201).json(newMessage);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// =============================
// 🔸 GET: All messages in room
// =============================
router.get('/:roomId', auth, async (req, res) => {
    const { roomId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId' });
    }
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const chatRoom = await ChatRoom.findOne({ _id: roomId, 'members.user': req.user.id });
        if (!chatRoom) return res.status(403).json({ error: 'Access denied' });

        const messages = await Message.find({ roomId })
            .populate('senderId', 'username _id')
            .sort({ timestamp: 1 });

        res.json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;
