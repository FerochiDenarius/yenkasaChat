const router = require('express').Router(); // ✅ Fix: declare router
const Contact = require('../models/contact.model');
const User = require('../models/user.model');
const ChatRoom = require('../models/chatroom.model');
const Message = require('../models/message.model');
const authMiddleware = require('../middleware/auth'); // Ensure this path is correct
const { ensureContactExists, syncChatParticipantsAsContacts } = require('../services/contact.service');

function participantKeyFor(userA, userB) {
    return [userA.toString(), userB.toString()].sort().join(':');
}

// ✅ Add contact route
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        const userId = req.user.id; // ✅ Use 'id' from JWT payload

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const contactUser = await User.findOne({ username });
        if (!contactUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (contactUser._id.toString() === userId) {
            return res.status(400).json({ error: 'You cannot add yourself' });
        }

        const participantKey = participantKeyFor(userId, contactUser._id);
        const existingRoom = await ChatRoom.findOne({
            roomType: { $ne: 'group' },
            $or: [
                { participantKey },
                { participants: { $size: 2, $all: [userId, contactUser._id] } }
            ]
        });

        if (!existingRoom) {
            return res.status(409).json({
                error: 'Start a chat first. Contacts are created after a conversation exists.'
            });
        }

        const [contact] = await syncChatParticipantsAsContacts(req.user, contactUser, {
            lastInteractionAt: existingRoom.updatedAt || new Date()
        });
        res.status(201).json(contact);
    } catch (err) {
        console.error("❌ Contact save error:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add to yenkasaChatBackend/RegLoginBackend/routes/contacts.routes.js

router.delete('/:contactId', authMiddleware, async (req, res) => {
    try {
        const existingContact = await Contact.findOne({
            _id: req.params.contactId,
            userId: req.user.id
        });

        if (!existingContact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.status(200).json({
            message: 'Conversation contacts are permanent after first interaction.'
        });
    } catch (err) {
        console.error("❌ Delete contact error:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});
// ✅ Get all contacts for the authenticated user
// Fix the GET route in contacts.routes.js
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const contactDocs = await Contact.find({ userId })
            .sort({ lastInteractionAt: -1, updatedAt: -1 })
            .populate('contactId', 'username location profileImage avatar online lastSeen _id')
            .lean();

        const validContacts = contactDocs.filter(contact => contact.contactId);
        const roomKeys = validContacts.map(contact => participantKeyFor(userId, contact.contactId._id));
        const rooms = await ChatRoom.find({
            roomType: { $ne: 'group' },
            participantKey: { $in: roomKeys }
        })
            .select('_id participantKey participants updatedAt createdAt')
            .lean();

        const roomsByKey = new Map(rooms.map(room => [room.participantKey, room]));
        const roomIds = rooms.map(room => room._id);
        const latestMessages = await Message.aggregate([
            { $match: { roomId: { $in: roomIds } } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$roomId', latest: { $first: '$$ROOT' } } },
            { $project: { _id: 1, createdAt: '$latest.createdAt', timestamp: '$latest.timestamp' } }
        ]);

        const latestByRoomId = new Map(latestMessages.map(item => [item._id.toString(), item]));

        const contacts = validContacts.map(contact => {
            const contactUser = contact.contactId;
            const key = participantKeyFor(userId, contactUser._id);
            const room = roomsByKey.get(key);
            const latestMessage = room ? latestByRoomId.get(room._id.toString()) : null;
            const lastMessageTime = latestMessage?.createdAt || latestMessage?.timestamp || room?.updatedAt || contact.lastInteractionAt || contact.updatedAt || contact.createdAt;
            return {
            id: contact._id.toString(),
            userId: contact.userId.toString(),
            contactId: contactUser._id.toString(),
            username: contactUser.username || contact.contactUsername,
            location: contactUser.location || '',
            profileImage: contactUser.profileImage || contactUser.avatar || contact.profilePicUrl || '',
            online: Boolean(contactUser.online),
            isOnline: Boolean(contactUser.online),
            lastSeen: contactUser.lastSeen || null,
            lastMessageTime,
            roomId: room?._id || null
        };
        }).sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));

        res.json(contacts);
    } catch (err) {
        console.error("❌ Failed to load contacts:", err.message);
        res.status(500).json({ error: 'Server error while loading contacts' });
    }
});


module.exports = router;
