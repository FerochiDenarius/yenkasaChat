const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Ensure this path is correct
const Message = require('../models/message.model'); // Ensure this path is correct
const ChatRoom = require('../models/chatroom.model'); // Ensure this path is correct, though not used in GET messages
const mongoose = require('mongoose');

// ✅ Send a message (text, image, audio, video, file, contact, or location)
// This route will correspond to POST /api/messages/
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

    // ... (rest of your POST logic remains the same)
    // Ensure roomId is provided in the body for sending a message
    if (!roomId) {
        return res.status(400).json({ error: 'roomId is required in the body for sending a message' });
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
            senderId: req.user.id, // Assuming req.user.id comes from your 'auth' middleware
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

        res.status(201).json(newMessage);
    } catch (err) {
        console.error('❌ Error saving message:', err);
        res.status(500).json({ error: 'Server error saving message' });
    }
});

// ✅ Get all messages in a chat room
// This route will now correspond to GET /api/messages/:roomId
router.get('/:roomId/messages', auth, async (req, res) => {
    const { roomId } = req.params;

    try {
        const messages = await Message.find({
            roomId: new mongoose.Types.ObjectId(roomId)
        }).sort({ timestamp: 1 });

        res.json(messages);
    } catch (err) {
        console.error('❌ Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;
