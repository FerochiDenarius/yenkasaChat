const router = require('express').Router(); // ✅ Fix: declare router
const Contact = require('../models/contact.model');
const User = require('../models/user.model');
const ChatRoom = require('../models/chatroom.model');
const Message = require('../models/message.model');
const UnreadMessageCount = require('../models/unreadMessageCount.model');
const mongoose = require('mongoose');
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
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const privateRooms = await ChatRoom.find({
            roomType: { $ne: 'group' },
            participants: userObjectId
        })
            .select('_id participantKey participants updatedAt createdAt')
            .sort({ updatedAt: -1 })
            .lean();

        const roomIds = privateRooms.map(room => room._id);
        const latestMessages = roomIds.length
            ? await Message.aggregate([
                { $match: { roomId: { $in: roomIds } } },
                { $sort: { createdAt: -1, timestamp: -1 } },
                { $group: { _id: '$roomId', latest: { $first: '$$ROOT' } } },
                {
                    $project: {
                        _id: 1,
                        createdAt: '$latest.createdAt',
                        timestamp: '$latest.timestamp'
                    }
                }
            ])
            : [];
        const latestByRoomId = new Map(latestMessages.map(item => [item._id.toString(), item]));

        const unreadCounts = roomIds.length
            ? await UnreadMessageCount.find({
                userId,
                roomId: { $in: roomIds }
            }).select('roomId count').lean()
            : [];
        const unreadByRoomId = new Map(unreadCounts.map(item => [item.roomId.toString(), Number(item.count || 0)]));

        const roomContactIds = privateRooms
            .flatMap(room => room.participants || [])
            .map(participantId => participantId.toString())
            .filter(participantId => participantId !== userId);

        const contactDocs = await Contact.find({ userId })
            .sort({ lastInteractionAt: -1, updatedAt: -1 })
            .populate('contactId', 'username location profileImage avatar online lastSeen verified _id')
            .lean();

        const contactDocIds = contactDocs
            .map(contact => contact.contactId?._id || contact.contactId)
            .filter(Boolean)
            .map(id => id.toString());

        const allContactIds = Array.from(new Set([...roomContactIds, ...contactDocIds]))
            .filter(isContactId => mongoose.Types.ObjectId.isValid(isContactId));

        const contactUsers = allContactIds.length
            ? await User.find({ _id: { $in: allContactIds.map(id => new mongoose.Types.ObjectId(id)) } })
                .select('username location profileImage avatar online lastSeen verified _id')
                .lean()
            : [];
        const usersById = new Map(contactUsers.map(user => [user._id.toString(), user]));

        const roomsByContactId = new Map();
        privateRooms.forEach(room => {
            const otherId = (room.participants || [])
                .map(participantId => participantId.toString())
                .find(participantId => participantId !== userId);
            if (!otherId) return;
            const existingRoom = roomsByContactId.get(otherId);
            const existingTime = existingRoom ? new Date(existingRoom.updatedAt || existingRoom.createdAt || 0).getTime() : 0;
            const roomTime = new Date(room.updatedAt || room.createdAt || 0).getTime();
            if (!existingRoom || roomTime > existingTime) {
                roomsByContactId.set(otherId, room);
            }
        });

        const missingRoomContacts = roomContactIds
            .filter(contactId => !contactDocIds.includes(contactId))
            .map(contactId => usersById.get(contactId))
            .filter(Boolean);

        if (missingRoomContacts.length) {
            await Promise.allSettled(missingRoomContacts.map(contactUser => {
                const room = roomsByContactId.get(contactUser._id.toString());
                const latestMessage = room ? latestByRoomId.get(room._id.toString()) : null;
                return ensureContactExists(userId, contactUser, {
                    lastInteractionAt: latestMessage?.createdAt || latestMessage?.timestamp || room?.updatedAt || room?.createdAt || new Date()
                });
            }));
        }

        const freshContactDocs = await Contact.find({ userId })
            .sort({ lastInteractionAt: -1, updatedAt: -1 })
            .populate('contactId', 'username location profileImage avatar online lastSeen verified _id')
            .lean();

        const contactsByUserId = new Map();

        freshContactDocs.forEach(contact => {
            const populatedUser = contact.contactId && typeof contact.contactId === 'object'
                ? contact.contactId
                : null;
            const contactUserId = (populatedUser?._id || contact.contactId)?.toString();
            if (!contactUserId || contactUserId === userId) return;

            const contactUser = populatedUser || usersById.get(contactUserId);
            const room = roomsByContactId.get(contactUserId);
            const latestMessage = room ? latestByRoomId.get(room._id.toString()) : null;
            const lastInteraction = latestMessage?.createdAt ||
                latestMessage?.timestamp ||
                room?.updatedAt ||
                contact.lastInteractionAt ||
                contact.updatedAt ||
                contact.createdAt;

            contactsByUserId.set(contactUserId, {
                _id: contactUserId,
                id: contact._id.toString(),
                userId: contact.userId.toString(),
                contactId: contactUserId,
                username: contactUser?.username || contact.contactUsername || '',
                location: contactUser?.location || '',
                profileImage: contactUser?.profileImage || contactUser?.avatar || contact.profilePicUrl || '',
                profilePicture: contactUser?.profileImage || contactUser?.avatar || contact.profilePicUrl || '',
                verified: Boolean(contactUser?.verified),
                online: Boolean(contactUser?.online),
                isOnline: Boolean(contactUser?.online),
                lastSeen: contactUser?.lastSeen || null,
                lastInteraction,
                lastMessageTime: lastInteraction,
                unreadCount: room ? unreadByRoomId.get(room._id.toString()) || 0 : 0,
                roomId: room?._id?.toString() || null
            });
        });

        privateRooms.forEach(room => {
            const otherId = (room.participants || [])
                .map(participantId => participantId.toString())
                .find(participantId => participantId !== userId);
            if (!otherId || contactsByUserId.has(otherId)) return;
            const contactUser = usersById.get(otherId);
            if (!contactUser) return;
            const latestMessage = latestByRoomId.get(room._id.toString());
            const lastInteraction = latestMessage?.createdAt || latestMessage?.timestamp || room.updatedAt || room.createdAt;
            contactsByUserId.set(otherId, {
                _id: otherId,
                id: otherId,
                userId,
                contactId: otherId,
                username: contactUser.username || '',
                location: contactUser.location || '',
                profileImage: contactUser.profileImage || contactUser.avatar || '',
                profilePicture: contactUser.profileImage || contactUser.avatar || '',
                verified: Boolean(contactUser.verified),
                online: Boolean(contactUser.online),
                isOnline: Boolean(contactUser.online),
                lastSeen: contactUser.lastSeen || null,
                lastInteraction,
                lastMessageTime: lastInteraction,
                unreadCount: unreadByRoomId.get(room._id.toString()) || 0,
                roomId: room._id.toString()
            });
        });

        const contacts = Array.from(contactsByUserId.values())
            .filter(contact => contact.username)
            .sort((a, b) => new Date(b.lastInteraction || b.lastMessageTime || 0) - new Date(a.lastInteraction || a.lastMessageTime || 0));

        res.json(contacts);
    } catch (err) {
        console.error("❌ Failed to load contacts:", err.message);
        res.status(500).json({ error: 'Server error while loading contacts' });
    }
});


module.exports = router;
