const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { username: rawRecipientUsername } = req.body; // 1. Get the raw username

  console.log('--- Attempting to create/retrieve chat room ---');
  console.log(`Authenticated User ID (sender): ${userId}`);
  console.log(`Received recipient username (raw) from request body: "${rawRecipientUsername}"`);

  if (!rawRecipientUsername) { // 2. Check the raw username
    console.log('Recipient username not provided in request body.');
    return res.status(400).json({ success: false, message: 'Recipient username is required.' });
  }

  const recipientUsername = rawRecipientUsername.trim(); // 3. TRIM THE USERNAME

  // 4. Check if the trimmed username is empty (e.g., if the input was just spaces)
  if (recipientUsername === "") {
    console.log('Recipient username became empty after trimming.');
    return res.status(400).json({ success: false, message: 'Recipient username is invalid.' });
  }

  console.log(`Querying User collection for username (trimmed, case-insensitive): "${recipientUsername}"`); // Log the trimmed version

  try {
    // 5. Use the TRIMMED username in the RegExp
    const otherUser = await User.findOne({ username: new RegExp(`^${recipientUsername}$`, 'i') });

    if (!otherUser) {
      // Log the trimmed version here as well, as that's what was queried
      console.error(`Recipient NOT FOUND in DB with username: "${recipientUsername}" (using trimmed, case-insensitive query)`);
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    console.log(`Recipient found: ID = ${otherUser._id}, Username = ${otherUser.username}`);

    if (otherUser._id.toString() === userId) {
      console.log('User attempting to create chat room with themselves.');
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

    console.log(`Checking for existing room between ${userId} and ${otherUser._id}`);
    const existingRoom = await ChatRoom.findOne({
      participants: { $all: [new mongoose.Types.ObjectId(userId), otherUser._id] },
    });

    if (existingRoom) {
      console.log(`Existing chat room found: ${existingRoom._id}`);
      return res.json({
        success: true,
        roomId: existingRoom._id,
        message: 'Chat room already exists',
        participant: {
            id: otherUser._id,
            username: otherUser.username,
            avatar: otherUser.avatar || otherUser.profileImage || null // Added fallback to profileImage
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
      participant: {
        id: otherUser._id,
        username: otherUser.username,
        avatar: otherUser.avatar || otherUser.profileImage || null // Added fallback to profileImage
      }
    });

  } catch (err) {
    console.error('❌ Chat room creation error:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to create chat room' });
  }
});

// ... (GET route remains the same, but also consider profileImage for avatar there too)

module.exports = router;
