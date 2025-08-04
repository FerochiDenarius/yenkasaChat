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
router.get('/:roomId', auth, async (req, res) => { // CHANGED FROM '/:roomId/messages' to '/:roomId'
    const { roomId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId format' });
    }

    try {
        const messages = await Message.find({
            roomId: new mongoose.Types.ObjectId(roomId)
        }).sort({ timestamp: 1 }); // Sorts by timestamp in ASCENDING order (oldest first)

        // Consider adding a check if no messages are found, though an empty array is valid JSON
        // if (messages.length === 0) {
        //     console.log(`💬 No messages found for roomId: ${roomId}`);
        // }

        res.json(messages);
    } catch (err) {
        console.error(`❌ Error fetching messages for roomId ${roomId}:`, err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;