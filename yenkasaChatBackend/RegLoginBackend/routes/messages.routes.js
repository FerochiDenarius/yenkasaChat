const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/user.model'); // Ensure this User model has 'playerId'

// Log environment variables (for debugging only, remove/comment out in production)
console.log('[MessagesRoute] ONESIGNAL_APP_ID:', process.env.ONESIGNAL_APP_ID);
const apiKeyLoaded = process.env.ONESIGNAL_REST_API_KEY ? "Loaded" : "NOT LOADED";
console.log('[MessagesRoute] ONESIGNAL_REST_API_KEY:', apiKeyLoaded);

router.post('/', auth, async (req, res) => {
    console.log('[MessagesRoute] POST / - Received new message request');
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
        console.warn('[MessagesRoute] POST / - roomId is missing');
        return res.status(400).json({ error: 'roomId is required in the body for sending a message' });
    }
    console.log(`[MessagesRoute] POST / - roomId: ${roomId}`);

    const hasContent =
        text ||
        imageUrl ||
        audioUrl ||
        videoUrl ||
        fileUrl ||
        contactInfo ||
        (location?.latitude && location?.longitude);

    if (!hasContent) {
        console.warn('[MessagesRoute] POST / - Message has no content');
        return res.status(400).json({
            error: 'Message must contain text, image, audio, video, file, contact, or location'
        });
    }

    try {
        console.log(`[MessagesRoute] POST / - Attempting to find chat room with ID: ${roomId}`);
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            console.warn(`[MessagesRoute] POST / - Chat room not found with ID: ${roomId}`);
            return res.status(404).json({ error: 'Chat room not found' });
        }
        console.log(`[MessagesRoute] POST / - Chat room found: ${chatRoom.name || chatRoom._id}`);

        // Assuming req.user from auth middleware contains the sender's full user object or at least username
        const senderUsername = req.user.username || 'Someone'; 

        const newMessage = new Message({
            roomId: new mongoose.Types.ObjectId(roomId),
            senderId: req.user.id, // MongoDB _id of the sender
            text: text?.trim().substring(0, 1000),
            imageUrl,
            audioUrl,
            videoUrl,
            fileUrl,
            contactInfo,
            location,
            timestamp: new Date()
        });

        console.log('[MessagesRoute] POST / - 💾 Preparing to save message:', JSON.stringify(newMessage));
        await newMessage.save();
        console.log(`[MessagesRoute] POST / - ✅ Message saved with ID: ${newMessage._id}`);

        const participants = chatRoom.participants.map(p => p.toString());
        const recipientUserIds = participants.filter(id => id !== req.user.id);

        console.log(`[MessagesRoute] POST / - 🔔 Sender App User ID: ${req.user.id}`);
        console.log(`[MessagesRoute] POST / - 📬 Identified recipient App User IDs: ${JSON.stringify(recipientUserIds)}`);

        if (recipientUserIds.length === 0) {
            console.log('[MessagesRoute] POST / - No other recipients in the chat room to notify.');
            return res.status(201).json(newMessage); // Message saved, but no one else to notify
        }

        const recipients = await User.find({ _id: { $in: recipientUserIds } });
        console.log(`[MessagesRoute] POST / - 🧑‍🤝‍🧑 Fetched ${recipients.length} recipient user objects from DB.`);

        for (const recipient of recipients) {
            console.log(`[MessagesRoute] POST / - Processing recipient: ${recipient.username} (App User ID: ${recipient._id})`);
            
            // ✅ CHANGED: Check for 'playerId' instead of 'oneSignalPlayerId'
            if (recipient.playerId && recipient.playerId.length > 0) { 
                console.log(`[MessagesRoute] POST / - User ${recipient.username} has Player ID: ${recipient.playerId}. Preparing notification.`);

                const payload = {
                    app_id: process.env.ONESIGNAL_APP_ID,
                    // ✅ CHANGED: Use 'playerId' here
                    include_player_ids: [recipient.playerId], 
                    headings: { en: `New message from ${senderUsername}` }, 
                    contents: { en: text || 'You received a new message' },
                    data: {
                        roomId,
                        senderId: req.user.id,
                        type: 'message',
                        // Add any other data your app needs when it receives the notification
                    },
                    // Optional:
                    // android_channel_id: process.env.ONESIGNAL_ANDROID_CHANNEL_ID, // Ensure this env var exists if you use it
                };
                console.log(`[MessagesRoute] POST / - Notification payload for ${recipient.username}: ${JSON.stringify(payload)}`);

                try {
                    // ✅ CHANGED: Logging uses 'playerId'
                    console.log(`[MessagesRoute] POST / - 🚀 Attempting to send notification to OneSignal for Player ID: ${recipient.playerId}`);
                    const oneSignalResponse = await axios.post('https://onesignal.com/api/v1/notifications', payload, {
                        headers: {
                            Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    // ✅ CHANGED: Logging uses 'playerId'
                    console.log(`[MessagesRoute] POST / - 📨 Notification sent successfully to ${recipient.username} (Player ID: ${recipient.playerId}). OneSignal Response Status: ${oneSignalResponse.status}`);
                    // console.log('[MessagesRoute] POST / - OneSignal Response Data:', oneSignalResponse.data); // Can be verbose
                } catch (notificationErr) {
                    let errorDetails = notificationErr.message;
                    if (notificationErr.response) {
                        errorDetails = `Status: ${notificationErr.response.status}, Data: ${JSON.stringify(notificationErr.response.data)}`;
                    }
                     // ✅ CHANGED: Logging uses 'playerId'
                    console.warn(`[MessagesRoute] POST / - ⚠️ Failed to send OneSignal notification to ${recipient.username} (Player ID: ${recipient.playerId}):`, errorDetails);
                }
            } else {
                 // ✅ CHANGED: Logging is now about 'Player ID'
                console.log(`[MessagesRoute] POST / - User ${recipient.username} (App User ID: ${recipient._id}) does NOT have a valid Player ID. Skipping notification.`);
            }
        }
        res.status(201).json(newMessage);
    } catch (err) {
        console.error('[MessagesRoute] POST / - ❌❌❌ Major error during message processing:', err.message, err.stack);
        res.status(500).json({ error: 'Server error saving message' });
    }
});


// ... (your GET route can remain the same or add similar logging if needed) ...
router.get('/:roomId', auth, async (req, res) => { 
    console.log(`[MessagesRoute] GET /${req.params.roomId} - Received request for messages`);
    const { roomId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        console.warn(`[MessagesRoute] GET /${roomId} - Invalid roomId format`);
        return res.status(400).json({ error: 'Invalid roomId format' });
    }

    try {
        console.log(`[MessagesRoute] GET /${roomId} - Fetching messages from DB`);
        const messages = await Message.find({
            roomId: new mongoose.Types.ObjectId(roomId)
        }).sort({ timestamp: 1 });

        console.log(`[MessagesRoute] GET /${roomId} - Found ${messages.length} messages.`);
        res.json(messages);
    } catch (err) {
        console.error(`[MessagesRoute] GET /${roomId} - ❌ Error fetching messages:`, err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;

