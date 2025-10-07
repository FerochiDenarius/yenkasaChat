// messages.routes.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');

// Middleware
const auth = require('../middleware/auth'); // Assuming your auth middleware populates req.user (with id, username)

// Models
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');
const User = require('../models/user.model'); // Ensure this User model has 'playerId' (String) and 'username' (String)
const UnreadMessageCount = require('../models/unreadMessageCount.model');
const unreadCountService = require('../services/unreadCount.service'); // For unread counts

// --- Environment Variable Checks (Crucial for OneSignal) ---
const ONE_SIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const YENKASACHAT_ONE_SIGNAL_KEY = process.env.yenkasachatOneSignalKey; // Your OneSignal REST API Key
const ONE_SIGNAL_ANDROID_CHANNEL_ID = process.env.ONESIGNAL_ANDROID_CHANNEL_ID;

console.log('[MessagesRoute] Initializing...');
if (!ONE_SIGNAL_APP_ID) {
    console.error('[MessagesRoute] CRITICAL ERROR: ONESIGNAL_APP_ID environment variable is not set.');
} else {
    console.log('[MessagesRoute] ONESIGNAL_APP_ID loaded.');
}

if (!YENKASACHAT_ONE_SIGNAL_KEY) {
    console.error('[MessagesRoute] CRITICAL ERROR: yenkasachatOneSignalKey environment variable is not set. This is your OneSignal REST API Key.');
} else {
    console.log('[MessagesRoute] yenkasachatOneSignalKey loaded.');
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
        location,
        repliedTo // ✅ 1. Get repliedTo from request
    } = req.body;

        // --- START: Update Player ID if provided in the request ---
    if (req.body.playerId) {
        try {
            const updatedUser = await User.findByIdAndUpdate(
                req.user.id,
                { playerId: req.body.playerId.trim() },
                { new: true }
            );
            if (updatedUser) {
                console.log(`[MessagesRoute] POST / - ✅ Player ID updated for user ${updatedUser.username} (${updatedUser._id}): ${updatedUser.playerId}`);
            }
        } catch (err) {
            console.error(`[MessagesRoute] POST / - ⚠️ Failed to update Player ID for user ${req.user.id}:`, err.message);
        }
    }
    // --- END: Update Player ID ---


    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
        console.warn('[MessagesRoute] POST / - Invalid or missing roomId:', roomId);
        return res.status(400).json({ error: 'Valid roomId is required' });
    }
    const roomObjectId = new mongoose.Types.ObjectId(roomId); // Use this for queries
    console.log(`[MessagesRoute] POST / - Room ID from request: ${roomObjectId.toString()}`);

    const hasContent = text || imageUrl || audioUrl || videoUrl || fileUrl || contactInfo || (location?.latitude && location?.longitude);
    if (!hasContent) {
        console.warn('[MessagesRoute] POST / - Message has no content.');
        return res.status(400).json({ error: 'Message must contain some content (text, media, location, etc.)' });
    }

    try {
        console.log(`[MessagesRoute] POST / - Finding chat room with ID: ${roomObjectId.toString()}`);
        const chatRoom = await ChatRoom.findById(roomObjectId);
        if (!chatRoom) {
            console.warn(`[MessagesRoute] POST / - Chat room not found: ${roomObjectId.toString()}`);
            return res.status(404).json({ error: 'Chat room not found' });
        }
        console.log(`[MessagesRoute] POST / - Chat room "${chatRoom.name || chatRoom._id}" found. Participants: ${chatRoom.participants.length}`);

        const senderAppUserId = req.user.id.toString(); // Ensure it's a string for comparison
        const senderUsername = req.user.username || 'A user'; // Get sender's username from auth middleware

        const newMessage = new Message({
            roomId: roomObjectId,
            senderId: senderAppUserId,
            text: text ? text.trim().substring(0, 2000) : null, // Max length, ensure null if empty
            imageUrl,
            audioUrl,
            videoUrl,
            fileUrl,
            contactInfo,
            location,
            timestamp: new Date(),
            replyTo: repliedTo && mongoose.Types.ObjectId.isValid(repliedTo) ? repliedTo : null // ✅ 2. Save repliedTo ID
        });


        console.log('[MessagesRoute] POST / - 💾 Saving new message to DB...');
        await newMessage.save();
        console.log(`[MessagesRoute] POST / - ✅ Message saved with ID: ${newMessage._id} by sender: ${senderAppUserId} (${senderUsername}) in room ${newMessage.roomId}`);

        // --- Determine Recipients ---
        const participantAppUserIds = chatRoom.participants.map(p => p.toString()); // Assuming participants are stored as ObjectIds or strings
        const recipientAppUserIds = participantAppUserIds.filter(id => id !== senderAppUserId);
        console.log(`[MessagesRoute] POST / - Potential recipients (App User IDs): [${recipientAppUserIds.join(', ')}] for room ${newMessage.roomId}`);


      // --- START: INCREMENT UNREAD MESSAGE COUNTS (using service) ---
        if (recipientAppUserIds.length > 0) {
            console.log(`[MessagesRoute] POST / - Updating unread counts for ${recipientAppUserIds.length} recipients in room ${newMessage.roomId} using service...`);
            for (const recipientId of recipientAppUserIds) {
                const unreadResult = await unreadCountService.incrementUnreadCount(recipientId, newMessage.roomId);
                if (unreadResult.success) {
                    console.log(`[MessagesRoute] POST / - Service incremented unread count for user ${recipientId} in room ${newMessage.roomId}. New count: ${unreadResult.data.count}`);
                } else {
                    console.error(`[MessagesRoute] POST / - Service error updating unread count for user ${recipientId} in room ${newMessage.roomId}: ${unreadResult.error}`);
                }
            }
        } else {
            console.log(`[MessagesRoute] POST / - No other recipients in this chat room to update unread counts for (room ${newMessage.roomId}).`);
        }
        // --- END: INCREMENT UNREAD MESSAGE COUNTS ---
 
        // --- START: Push Notification Logic ---
        if (!ONE_SIGNAL_APP_ID || !YENKASACHAT_ONE_SIGNAL_KEY) {
            console.error('[MessagesRoute] POST / - Critical OneSignal configuration (APP_ID or REST_API_KEY) is missing. Cannot send push notification.');
        } else if (recipientAppUserIds.length > 0) {
            console.log('[MessagesRoute] POST / - Starting push notification logic for room ' + newMessage.roomId);
            console.log(`[MessagesRoute] POST / - Fetching ${recipientAppUserIds.length} recipient user objects from DB for Player IDs...`);

            const recipientsForPush = await User.find(
                { _id: { $in: recipientAppUserIds.map(id => new mongoose.Types.ObjectId(id)) } }, // Ensure ObjectIds for query
                'username playerId'
            ).lean();
            
            console.log(`[MessagesRoute] POST / - Found ${recipientsForPush.length} recipient user objects with Player ID info.`);
            const validPlayerIdsForNotification = [];
            recipientsForPush.forEach(recipient => {
                if (recipient.playerId && recipient.playerId.trim() !== '') {
                    validPlayerIdsForNotification.push(recipient.playerId.trim());
                    console.log(`[MessagesRoute] POST / - User ${recipient.username || recipient._id} (App ID: ${recipient._id}) has valid Player ID: ${recipient.playerId.trim()}`);
                } else {
                    console.log(`[MessagesRoute] POST / - User ${recipient.username || recipient._id} (App ID: ${recipient._id}) does NOT have a valid Player ID. Will not be notified.`);
                }
            });

            if (validPlayerIdsForNotification.length > 0) {
                console.log(`[MessagesRoute] POST / - 🎯 Player IDs targeted for notification: [${validPlayerIdsForNotification.join(', ')}]`);

                let notificationTitle = `New message in ${chatRoom.name || 'your chat'}`;
                if (chatRoom.isGroupChat === false && chatRoom.participants.length === 2) {
                    notificationTitle = `New message from ${senderUsername}`;
                }
                
                let notificationBody = `${senderUsername}: ${text ? (text.length > 50 ? text.substring(0, 47) + "..." : text) : 'Sent you a message'}`;
                if (imageUrl) notificationBody = `${senderUsername} sent an image.`;
                else if (audioUrl) notificationBody = `${senderUsername} sent an audio message.`;
                else if (videoUrl) notificationBody = `${senderUsername} sent a video.`;
                else if (fileUrl) notificationBody = `${senderUsername} sent a file.`;
                else if (contactInfo) notificationBody = `${senderUsername} shared a contact.`;
                else if (location) notificationBody = `${senderUsername} shared a location.`;
                else if (!text) notificationBody = `${senderUsername} sent you a new message.`;

                const notificationPayload = {
                    app_id: ONE_SIGNAL_APP_ID,
                    include_player_ids: validPlayerIdsForNotification,
                    headings: { en: notificationTitle },
                    contents: { en: notificationBody },
                    data: {
                        roomId: newMessage.roomId.toString(),
                        senderId: senderAppUserId,
                        messageId: newMessage._id.toString(),
                        type: 'new_chat_message',
                        chatRoomName: chatRoom.name || null,
                        isGroupChat: chatRoom.isGroupChat === true
                    },
                };

                if (ONE_SIGNAL_ANDROID_CHANNEL_ID) {
                    notificationPayload.android_channel_id = ONE_SIGNAL_ANDROID_CHANNEL_ID;
                }

                console.log('[MessagesRoute] POST / - 🚀 Preparing to send notification to OneSignal. Payload:', JSON.stringify(notificationPayload, null, 2));
                try {
                    const oneSignalResponse = await axios.post('https://onesignal.com/api/v1/notifications', notificationPayload, {
                        headers: {
                            'Authorization': `Basic ${YENKASACHAT_ONE_SIGNAL_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log(`[MessagesRoute] POST / - 📨 Notification sent successfully to OneSignal for ${validPlayerIdsForNotification.length} Player IDs. OneSignal Response Status: ${oneSignalResponse.status}`);
                    if (oneSignalResponse.data) {
                        console.log('[MessagesRoute] POST / - OneSignal Response Data:', { 
                            id: oneSignalResponse.data.id, 
                            recipients: oneSignalResponse.data.recipients,
                            errors: oneSignalResponse.data.errors || null 
                        });
                    }
                } catch (notificationError) {
                    let errorDetails = 'Unknown error during OneSignal request.';
                     if (notificationError.response) {
                        errorDetails = `Status: ${notificationError.response.status}, Data: ${JSON.stringify(notificationError.response.data, null, 2)}`;
                    } else if (notificationError.request) {
                        errorDetails = 'No response received from OneSignal. Request details: ' + notificationError.request;
                    } else {
                        errorDetails = notificationError.message;
                    }
                    console.error(`[MessagesRoute] POST / - ⚠️ Failed to send OneSignal notification:`, errorDetails);
                }
            } else {
                console.log('[MessagesRoute] POST / - No valid Player IDs found among recipients. Skipping OneSignal call for room ' + newMessage.roomId);
            }
        } else if (recipientAppUserIds.length === 0) {
            console.log('[MessagesRoute] POST / - No other recipients in this chat room. Skipping notifications for room ' + newMessage.roomId);
        }
        // --- END Push Notification Logic ---

        // ✅ 3. Populate all fields for the response, including the new replyTo field
        const populatedMessage = await Message.findById(newMessage._id)
            .populate({ path: 'senderId', select: 'username profileImageUrl _id' })
            .populate({
                path: 'replyTo',
                populate: {
                    path: 'senderId',
                    select: 'username _id'
                }
            })
            .lean();

        res.status(201).json(populatedMessage || newMessage); // Send populated message if available

    } catch (err) {
        console.error('[MessagesRoute] POST / - ❌❌❌ SERVER ERROR during message processing:', err.message, err.stack);
        res.status(500).json({ error: 'Server error processing message' });
    }
});

// GET messages for a specific chat room
router.get('/:roomId', auth, async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id; // from auth middleware
    console.log(`[MessagesRoute] GET /${roomId} - Request for messages by user: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        console.warn(`[MessagesRoute] GET /${roomId} - Invalid roomId format.`);
        return res.status(400).json({ error: 'Invalid roomId format' });
    }
    const roomObjectId = new mongoose.Types.ObjectId(roomId);

    try {
        const chatRoom = await ChatRoom.findOne({ _id: roomObjectId, participants: userId }); // Check if user is part of the room
        if (!chatRoom) {
             console.warn(`[MessagesRoute] GET /${roomId} - User ${userId} not authorized for this room or room doesn't exist.`);
             return res.status(403).json({ error: 'Not authorized or room not found' });
        }
        console.log(`[MessagesRoute] GET /${roomId} - User ${userId} authorized. Fetching messages from DB.`);

        const messages = await Message.find({ roomId: roomObjectId })
            .sort({ timestamp: 1 }) // Sort by oldest first
            .populate({
                path: 'senderId',
                select: 'username profileImageUrl _id' // Populate sender details
            })
            .populate({ // ✅ 4. Populate replyTo field when fetching all messages
                path: 'replyTo',
                populate: {
                    path: 'senderId',
                    select: 'username _id'
                }
            })
            .lean();

        console.log(`[MessagesRoute] GET /${roomId} - Found ${messages.length} messages.`);
        res.json(messages);
    } catch (err) {
        console.error(`[MessagesRoute] GET /${roomId} - ❌ Error fetching messages:`, err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Mark messages in a room as read for the current user
router.post('/:roomId/mark-as-read', auth, async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id; // From auth middleware

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        console.warn(`[MessagesRoute] POST /${roomId}/mark-as-read - Invalid roomId format: ${roomId}`);
        return res.status(400).json({ message: 'Invalid room ID format' });
    }
    const roomObjectId = new mongoose.Types.ObjectId(roomId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    console.log(`[MessagesRoute] POST /${roomObjectId.toString()}/mark-as-read - User ${userObjectId.toString()} attempting to mark room as read.`);

    try {
        const unreadCountEntry = await UnreadMessageCount.findOne({
            userId: userObjectId,
            roomId: roomObjectId
        });

        if (unreadCountEntry) {
            if (unreadCountEntry.count > 0) {
                unreadCountEntry.count = 0;
                await unreadCountEntry.save();
                console.log(`[MessagesRoute] POST /${roomObjectId.toString()}/mark-as-read - User ${userObjectId.toString()} marked room as read. Count reset.`);
                res.status(200).json({ message: 'Room marked as read', roomId: roomObjectId.toString(), userId: userObjectId.toString(), newCount: 0 });
            } else {
                console.log(`[MessagesRoute] POST /${roomObjectId.toString()}/mark-as-read - Room already marked as read for user ${userObjectId.toString()} (count was 0).`);
                res.status(200).json({ message: 'Room already marked as read', roomId: roomObjectId.toString(), userId: userObjectId.toString(), newCount: 0 });
            }
        } else {
            await UnreadMessageCount.updateOne(
                { userId: userObjectId, roomId: roomObjectId },
                { $set: { count: 0 } },
                { upsert: true }
            );
            console.log(`[MessagesRoute] POST /${roomObjectId.toString()}/mark-as-read - No prior unread count entry; new entry created/ensured with count 0 for user ${userObjectId.toString()}.`);
            res.status(200).json({ message: 'Room read status updated (no prior unread messages or entry created/reset).', roomId: roomObjectId.toString(), userId: userObjectId.toString(), newCount: 0 });
        }
    } catch (error) {
        console.error(`[MessagesRoute] POST /${roomObjectId.toString()}/mark-as-read - ❌ Error:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to mark room as read' });
    }
});

module.exports = router;
