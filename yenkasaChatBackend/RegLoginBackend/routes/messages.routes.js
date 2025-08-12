const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Assuming your auth middleware populates req.user.id and req.user.username
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/user.model'); // Ensure this User model has 'playerId' (String) and 'username' (String)

// --- Environment Variable Checks (Crucial for OneSignal) ---
const ONE_SIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
// MODIFIED: Changed to match your .env variable name for the REST API Key
const YENKASACHAT_ONE_SIGNAL_KEY = process.env.yenkasachatOneSignalKey; 
const ONE_SIGNAL_ANDROID_CHANNEL_ID = process.env.ONESIGNAL_ANDROID_CHANNEL_ID; // Optional, but recommended

console.log('[MessagesRoute] Initializing...');
if (!ONE_SIGNAL_APP_ID) {
    console.error('[MessagesRoute] CRITICAL ERROR: ONESIGNAL_APP_ID environment variable is not set.');
} else {
    console.log('[MessagesRoute] ONESIGNAL_APP_ID loaded.');
}

// MODIFIED: Updated the check and log to use the new variable name
if (!YENKASACHAT_ONE_SIGNAL_KEY) {
    console.error('[MessagesRoute] CRITICAL ERROR: yenkasachatOneSignalKey environment variable is not set. This is your OneSignal REST API Key.');
} else {
    console.log('[MessagesRoute] yenkasachatOneSignalKey loaded (status).');
}

if (ONE_SIGNAL_ANDROID_CHANNEL_ID) {
    console.log('[MessagesRoute] ONESIGNAL_ANDROID_CHANNEL_ID loaded:', ONE_SIGNAL_ANDROID_CHANNEL_ID);
} else {
    console.warn('[MessagesRoute] ONESIGNAL_ANDROID_CHANNEL_ID environment variable is not set. OneSignal will use a default channel if not specified in API calls.');
}
// --- End Environment Variable Checks ---

// POST a new message to a chat room
router.post('/', auth, async (req, res) => {
    console.log('[MessagesRoute] POST / - Received new message request from user:', req.user.id, '(Username:', req.user.username || 'N/A', ')');
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

    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
        console.warn('[MessagesRoute] POST / - Invalid or missing roomId:', roomId);
        return res.status(400).json({ error: 'Valid roomId is required' });
    }
    console.log(`[MessagesRoute] POST / - Room ID from request: ${roomId}`);

    const hasContent = text || imageUrl || audioUrl || videoUrl || fileUrl || contactInfo || (location?.latitude && location?.longitude);
    if (!hasContent) {
        console.warn('[MessagesRoute] POST / - Message has no content.');
        return res.status(400).json({ error: 'Message must contain some content (text, media, location, etc.)' });
    }

    try {
        console.log(`[MessagesRoute] POST / - Finding chat room with ID: ${roomId}`);
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            console.warn(`[MessagesRoute] POST / - Chat room not found: ${roomId}`);
            return res.status(404).json({ error: 'Chat room not found' });
        }
        console.log(`[MessagesRoute] POST / - Chat room "${chatRoom.name || chatRoom._id}" found. Participants: ${chatRoom.participants.length}`);

        const senderAppUserId = req.user.id.toString(); // Ensure it's a string for comparison
        const senderUsername = req.user.username || 'A user'; // Get sender's username from auth middleware

        const newMessage = new Message({
            roomId: new mongoose.Types.ObjectId(roomId),
            senderId: senderAppUserId,
            text: text ? text.trim().substring(0, 2000) : null, // Max length, ensure null if empty
            imageUrl,
            audioUrl,
            videoUrl,
            fileUrl,
            contactInfo,
            location,
            timestamp: new Date()
        });

        console.log('[MessagesRoute] POST / - 💾 Saving new message to DB...');
        await newMessage.save();
        console.log(`[MessagesRoute] POST / - ✅ Message saved with ID: ${newMessage._id} by sender: ${senderAppUserId} (${senderUsername})`);

        // --- Push Notification Logic ---
        // Ensure critical OneSignal variables are present before proceeding
        if (!ONE_SIGNAL_APP_ID || !YENKASACHAT_ONE_SIGNAL_KEY) {
            console.error('[MessagesRoute] POST / - Critical OneSignal configuration (APP_ID or REST_API_KEY) is missing. Cannot send push notification.');
            // Message is saved, so return 201, but log the issue.
            // Client might not get a real-time update if this happens.
            return res.status(201).json(newMessage); 
        }
        console.log('[MessagesRoute] POST / - Starting push notification logic...');

        const participantAppUserIds = chatRoom.participants.map(p => p.toString());
        const recipientAppUserIds = participantAppUserIds.filter(id => id !== senderAppUserId);

        console.log(`[MessagesRoute] POST / - Chat room participants (App User IDs): [${participantAppUserIds.join(', ')}]`);
        console.log(`[MessagesRoute] POST / - Potential recipients (App User IDs): [${recipientAppUserIds.join(', ')}]`);

        if (recipientAppUserIds.length === 0) {
            console.log('[MessagesRoute] POST / - No other recipients in this chat room. Skipping notifications.');
            return res.status(201).json(newMessage);
        }

        console.log(`[MessagesRoute] POST / - Fetching ${recipientAppUserIds.length} recipient user objects from DB...`);
        const recipientsWithPlayerIds = await User.find(
            { _id: { $in: recipientAppUserIds } },
            'username playerId' // Only select username and playerId fields
        ).lean(); // Use .lean() for faster, plain JS objects if you don't need Mongoose model instances
        
        console.log(`[MessagesRoute] POST / - Found ${recipientsWithPlayerIds.length} recipient user objects with Player ID info.`);

        const validPlayerIdsForNotification = [];
        recipientsWithPlayerIds.forEach(recipient => {
            if (recipient.playerId && recipient.playerId.trim() !== '') {
                validPlayerIdsForNotification.push(recipient.playerId.trim());
                console.log(`[MessagesRoute] POST / - User ${recipient.username || recipient._id} (App ID: ${recipient._id}) has valid Player ID: ${recipient.playerId.trim()}`);
            } else {
                console.log(`[MessagesRoute] POST / - User ${recipient.username || recipient._id} (App ID: ${recipient._id}) does NOT have a valid Player ID. Will not be notified.`);
            }
        });

        if (validPlayerIdsForNotification.length === 0) {
            console.log('[MessagesRoute] POST / - No valid Player IDs found among recipients. Skipping OneSignal call.');
            return res.status(201).json(newMessage);
        }

        console.log(`[MessagesRoute] POST / - 🎯 Player IDs targeted for notification: [${validPlayerIdsForNotification.join(', ')}]`);

        let notificationTitle = `New message in ${chatRoom.name || 'your chat'}`;
        if (chatRoom.isGroupChat === false && chatRoom.participants.length === 2) { // Assuming you have an isGroupChat flag or similar logic
            notificationTitle = `New message from ${senderUsername}`;
        }
        
        let notificationBody = `${senderUsername}: ${text ? (text.length > 50 ? text.substring(0, 47) + "..." : text) : 'Sent you a message'}`;
        if (imageUrl) notificationBody = `${senderUsername} sent an image.`;
        else if (audioUrl) notificationBody = `${senderUsername} sent an audio message.`;
        else if (videoUrl) notificationBody = `${senderUsername} sent a video.`;
        else if (fileUrl) notificationBody = `${senderUsername} sent a file.`;
        else if (contactInfo) notificationBody = `${senderUsername} shared a contact.`;
        else if (location) notificationBody = `${senderUsername} shared a location.`;
        else if (!text) notificationBody = `${senderUsername} sent you a new message.`; // Fallback if text is null but other media isn't primary


        const notificationPayload = {
            app_id: ONE_SIGNAL_APP_ID,
            include_player_ids: validPlayerIdsForNotification,
            headings: { en: notificationTitle },
            contents: { en: notificationBody },
            data: {
                roomId: roomId.toString(),
                senderId: senderAppUserId,
                messageId: newMessage._id.toString(),
                type: 'new_chat_message', // Custom type for your app to identify the notification
                chatRoomName: chatRoom.name || null,
                isGroupChat: chatRoom.isGroupChat === true // Assuming you have an isGroupChat flag
            },
            // small_icon: 'ic_stat_onesignal_default', // Default OneSignal icon, or your custom one
            // large_icon: 'your_large_icon_url', // Optional
            // consider adding buttons or other interactive elements
        };

        if (ONE_SIGNAL_ANDROID_CHANNEL_ID) {
            notificationPayload.android_channel_id = ONE_SIGNAL_ANDROID_CHANNEL_ID;
            console.log(`[MessagesRoute] POST / - Using Android Channel ID: ${ONE_SIGNAL_ANDROID_CHANNEL_ID}`);
        }

        console.log('[MessagesRoute] POST / - 🚀 Preparing to send notification to OneSignal. Payload:', JSON.stringify(notificationPayload, null, 2));

        try {
            const oneSignalResponse = await axios.post('https://onesignal.com/api/v1/notifications', notificationPayload, {
                headers: {
                    'Authorization': `Basic ${YENKASACHAT_ONE_SIGNAL_KEY}`, // Using the modified variable
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[MessagesRoute] POST / - 📨 Notification sent successfully to OneSignal for ${validPlayerIdsForNotification.length} Player IDs. OneSignal Response Status: ${oneSignalResponse.status}`);
            if (oneSignalResponse.data) {
                console.log('[MessagesRoute] POST / - OneSignal Response Data (id, recipients, errors):', { 
                    id: oneSignalResponse.data.id, 
                    recipients: oneSignalResponse.data.recipients,
                    errors: oneSignalResponse.data.errors || null 
                });
            }
        } catch (notificationError) {
            let errorDetails = 'Unknown error during OneSignal request.';
            if (notificationError.response) {
                errorDetails = `Status: ${notificationError.response.status}, Headers: ${JSON.stringify(notificationError.response.headers, null, 2)}, Data: ${JSON.stringify(notificationError.response.data, null, 2)}`;
            } else if (notificationError.request) {
                errorDetails = 'No response received from OneSignal. Request details: ' + notificationError.request;
            } else {
                errorDetails = notificationError.message;
            }
            console.error(`[MessagesRoute] POST / - ⚠️ Failed to send OneSignal notification:`, errorDetails);
            // Message is saved, but notification failed. Still return 201.
            // Consider adding more robust error handling or a retry mechanism for notifications if critical.
        }
        // --- End Push Notification Logic ---

        res.status(201).json(newMessage);

    } catch (err) {
        console.error('[MessagesRoute] POST / - ❌❌❌ SERVER ERROR during message processing:', err.message, err.stack);
        res.status(500).json({ error: 'Server error processing message' });
    }
});


// GET messages for a specific chat room
router.get('/:roomId', auth, async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id; // from auth middleware
    console.log(`[MessagesRoute] GET /${roomId} - Request for messages from user: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        console.warn(`[MessagesRoute] GET /${roomId} - Invalid roomId format.`);
        return res.status(400).json({ error: 'Invalid roomId format' });
    }

    try {
        // Optional: Check if user is part of the room before fetching messages
        const chatRoom = await ChatRoom.findOne({ _id: new mongoose.Types.ObjectId(roomId), participants: userId });
        if (!chatRoom) {
             console.warn(`[MessagesRoute] GET /${roomId} - User ${userId} not authorized for this room or room doesn't exist.`);
             return res.status(403).json({ error: 'Not authorized or room not found' });
        }
        console.log(`[MessagesRoute] GET /${roomId} - User ${userId} authorized. Fetching messages from DB for room.`);

        const messages = await Message.find({
                roomId: new mongoose.Types.ObjectId(roomId)
            })
            .sort({ timestamp: 1 }) // Sort by oldest first
            .populate({
                path: 'senderId',
                select: 'username profileImageUrl _id' // Populate sender details
            })
            .lean(); // Use .lean() for better performance as we are just sending data

        console.log(`[MessagesRoute] GET /${roomId} - Found ${messages.length} messages.`);
        res.json(messages);
    } catch (err) {
        console.error(`[MessagesRoute] GET /${roomId} - ❌ Error fetching messages:`, err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;
