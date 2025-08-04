
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Assuming this middleware correctly sets req.user
const mongoose = require('mongoose');
const Message = require('../models/message.model');
const ChatRoom = require('../models/chatroom.model');

// CORRECTED IMPORT:
// This line now correctly imports the sendPushNotification function
// from your utils/onesignal.js file.
const { sendPushNotification } = require('../utils/onesignal'); 

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

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
        return res.status(400).json({ error: 'Invalid roomId format' });
    }
    
    // Ensure req.user and req.user.id are available from the 'auth' middleware
    if (!req.user || !req.user.id) {
        console.error('[MessageRoute] User information not found in request after auth middleware.');
        return res.status(401).json({ error: 'User authentication failed or user ID missing.' });
    }

    const hasContent =
        (text && text.trim()) ||
        (imageUrl && imageUrl.trim()) ||
        (audioUrl && audioUrl.trim()) ||
        (videoUrl && videoUrl.trim()) ||
        (fileUrl && fileUrl.trim()) ||
        contactInfo || // Assuming contactInfo is an object and its presence is enough
        (location && typeof location.latitude === 'number' && typeof location.longitude === 'number');

    if (!hasContent) {
        return res.status(400).json({
            error: 'Message must contain text, image, audio, video, file, contact, or location'
        });
    }

    try {
        const chatRoom = await ChatRoom.findById(roomId).populate('members.user', 'username playerId'); // Populate to get username & playerId
        if (!chatRoom) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        // Verify the sender is a member of the chat room
        const isMember = chatRoom.members.some(member => member.user._id.toString() === req.user.id.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'User is not a member of this chat room' });
        }

        const newMessage = new Message({
            roomId: new mongoose.Types.ObjectId(roomId),
            senderId: new mongoose.Types.ObjectId(req.user.id), // Ensure senderId is an ObjectId
            text: text ? text.trim().substring(0, 1000) : undefined, // Max length and undefined if not present
            imageUrl: imageUrl || undefined,
            audioUrl: audioUrl || undefined,
            videoUrl: videoUrl || undefined,
            fileUrl: fileUrl || undefined,
            contactInfo: contactInfo || undefined,
            location: location || undefined,
            timestamp: new Date()
        });

        console.log(`[MessageRoute] Attempting to save message for room ${roomId} by sender ${req.user.id}:`, { text: newMessage.text, imageUrl: newMessage.imageUrl });
        await newMessage.save();
        console.log(`[MessageRoute] Message ${newMessage._id} saved successfully.`);

        // Update chat room's lastMessage and lastMessageTimestamp
        chatRoom.lastMessage = newMessage.text 
            ? (newMessage.text.length > 30 ? newMessage.text.substring(0, 27) + "..." : newMessage.text)
            : "Media message"; // Or a more descriptive placeholder
        chatRoom.lastMessageTimestamp = newMessage.timestamp;
        await chatRoom.save();


        // ================================
        // 🔔 Notify other chat members
        // ================================
        const senderInfo = chatRoom.members.find(m => m.user._id.toString() === req.user.id.toString())?.user;
        const senderUsername = senderInfo?.username || 'Someone';

        // Filter recipients: other members who have a playerId and are not the sender
        const recipients = chatRoom.members.filter(
            member => member.user._id.toString() !== req.user.id.toString() && member.user.playerId
        );

        if (recipients.length > 0) {
            const playerIds = recipients.map(member => member.user.playerId);
            const notificationTitle = chatRoom.name 
                ? `New message in ${chatRoom.name}` 
                : `${senderUsername} sent you a message`;

            let notificationBody = `${senderUsername}: ${newMessage.text ? (newMessage.text.length > 50 ? newMessage.text.substring(0, 47) + '...' : newMessage.text) : 'sent a message'}`;

            if (newMessage.imageUrl) notificationBody = `${senderUsername} sent an image.`;
            else if (newMessage.audioUrl) notificationBody = `${senderUsername} sent an audio message.`;
            else if (newMessage.videoUrl) notificationBody = `${senderUsername} sent a video.`;
            else if (newMessage.fileUrl) notificationBody = `${senderUsername} sent a file.`;
            else if (newMessage.contactInfo) notificationBody = `${senderUsername} shared a contact.`;
            else if (newMessage.location) notificationBody = `${senderUsername} shared a location.`;


            const notificationData = {
                roomId: roomId.toString(),
                messageId: newMessage._id.toString(),
                senderId: req.user.id.toString(),
                // You might want to add other relevant info like chatRoomName, senderUsername etc.
                // based on what your client needs to handle the notification.
            };

            try {
                console.log(`[MessageRoute] Attempting to send notification to Player IDs: ${playerIds.join(', ')}`);
                const result = await sendPushNotification({
                    playerId: playerIds,
                    title: notificationTitle,
                    body: notificationBody,
                    data: notificationData,
                    // Optional: Add android_channel_id if you use notification channels
                    // android_channel_id: 'your_message_channel_id_here' 
                });

                console.log(`[MessageRoute] Notification sent for message ${newMessage._id}. OneSignal Response ID:`, result.id || 'N/A', "Recipients:", result.recipients || 'N/A');
            } catch (notificationError) {
                console.error(`[MessageRoute] Error sending notification for message ${newMessage._id}:`, notificationError.message);
                // Log more details if available from the error object (e.g., from Axios error)
                if (notificationError.response && notificationError.response.data) {
                    console.error('[MessageRoute] OneSignal error response data:', notificationError.response.data);
                }
            }
        } else {
            console.log(`[MessageRoute] No other recipients with player IDs found for notification for message ${newMessage._id}. ChatRoom members:`, chatRoom.members.length);
        }

        res.status(201).json(newMessage);
    } catch (err) {
        console.error(`❌ Error in POST /api/messages for room ${roomId}:`, err.message);
        console.error(err.stack); // Log the full stack trace for better debugging
        res.status(500).json({ error: 'Server error while sending message' });
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
     // Ensure req.user and req.user.id are available from the 'auth' middleware
    if (!req.user || !req.user.id) {
        console.error('[MessageRoute GET] User information not found in request after auth middleware.');
        return res.status(401).json({ error: 'User authentication failed or user ID missing.' });
    }

    try {
        // Optional: Check if the user is a member of the room before fetching messages
        const chatRoom = await ChatRoom.findOne({ _id: new mongoose.Types.ObjectId(roomId), 'members.user': new mongoose.Types.ObjectId(req.user.id) });
        if (!chatRoom) {
             return res.status(403).json({ error: 'Access denied: You are not a member of this chat room or room does not exist.' });
        }

        const messages = await Message.find({
            roomId: new mongoose.Types.ObjectId(roomId)
        })
        .populate('senderId', 'username _id') // Populate sender's username and ID
        .sort({ timestamp: 1 }); // Sort by timestamp ascending (older first)

        res.json(messages);
    } catch (err) {
        console.error(`❌ Error fetching messages for roomId ${roomId}:`, err.message);
        console.error(err.stack);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;
