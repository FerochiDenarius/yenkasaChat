const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const sendPushNotification = require('../utils/sendPushNotification'); // Ensure this exists

// =========================
// 🔸 POST: Send a message
// =========================
router.post('/', auth, async (req, res) => {
    const {
        roomId,
        text,
        imageUrl,
        audioUrl,
        videoUrl,
        fileUrl,
        contactInfo,
        location
    } = req.body;

    if (!roomId) {
        return res.status(400).json({ error: 'roomId is required in the body for sending a message' });
    }

    const hasContent =
        (text && text.trim()) ||
        (imageUrl && imageUrl.trim()) ||
        (audioUrl && audioUrl.trim()) ||
        (videoUrl && videoUrl.trim()) ||
        (fileUrl && fileUrl.trim()) ||
        contactInfo ||
        (location?.latitude && location?.longitude);

    if (!hasContent) {
        return res.status(400).json({
            error: 'Message must contain text, image, audio, video, file, contact, or location'
        });
    }

    try {
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        const newMessage = new Message({
            roomId: new mongoose.Types.ObjectId(roomId),
            senderId: req.user.id,
            text: text?.trim().substring(0, 1000),
            imageUrl,
            audioUrl,
            videoUrl,
            fileUrl,
            contactInfo,
            location,
            timestamp: new Date()
        });

        console.log('💾 Saving message:', newMessage);
        await newMessage.save();

        // ================================
        // 🔔 Notify other chat members
        // ================================
        const sender = req.user;
        const recipients = chatRoom.members.filter(
            member => member._id.toString() !== sender.id.toString() && member.playerId
        );

        if (recipients.length > 0) {
            const playerIds = recipients.map(member => member.playerId);
            const notificationTitle = `New message in ${chatRoom.name || 'your chat'}`;

            let notificationBody = text
                ? `${sender.username || 'Someone'}: ${text.length > 50 ? text.substring(0, 47) + '...' : text}`
                : `${sender.username || 'Someone'} sent an attachment`;

            if (imageUrl) notificationBody = `${sender.username || 'Someone'} sent an image.`;
            else if (audioUrl) notificationBody = `${sender.username || 'Someone'} sent an audio message.`;
            else if (videoUrl) notificationBody = `${sender.username || 'Someone'} sent a video.`;
            else if (fileUrl) notificationBody = `${sender.username || 'Someone'} sent a file.`;

            const notificationData = {
                roomId: roomId.toString(),
                messageId: newMessage._id.toString(),
            };

            try {
                const result = await sendPushNotification({
                    playerId: playerIds,
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                });

                console.log(`[MessageRoute] Notification sent for message ${newMessage._id}.`, result.id || result);
            } catch (err) {
                console.error(`[MessageRoute] Error sending notification for message ${newMessage._id}:`, err.message);
            }
        } else {
            console.log(`[MessageRoute] No recipients with player IDs found for message ${newMessage._id}.`);
        }

        res.status(201).json(newMessage);
    } catch (err) {
        console.error('❌ Error saving message:', err);
        res.status(500).json({ error: 'Server error saving message' });
    }
});

// =============================
// 🔸 GET: All messages in room
// =============================
router.get('/:roomId', auth, async (req, res) => {
    const { roomId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId format' });
    }

    try {
        const messages = await Message.find({
            roomId: new mongoose.Types.ObjectId(roomId)
        }).sort({ timestamp: 1 });

        res.json(messages);
    } catch (err) {
        console.error(`❌ Error fetching messages for roomId ${roomId}:`, err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;
