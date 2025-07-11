const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const mongoose = require('mongoose');

// ✅ Send a message (text, image, audio, video, file, contact, or location)
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
    return res.status(400).json({ error: 'roomId is required' });
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
      senderId: req.user.id,
      text: text?.trim().substring(0, 1000),
      imageUrl,
      audioUrl,
      videoUrl,
      fileUrl,
      contactInfo,
      location,
      timestamp: new Date(), // ✅ sets custom timestamp explicitly
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
router.get('/:roomId/messages', auth, async (req, res) => {
  const { roomId } = req.params;

  try {
    const messages = await Message.find({
      roomId: new mongoose.Types.ObjectId(roomId)
    }).sort({ createdAt: 1 }); // ⬅️ use auto timestamp for correct order

    res.json(messages);
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
