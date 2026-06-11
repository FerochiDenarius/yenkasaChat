const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');

const router = express.Router();
const auth = require('../middleware/auth');
const ChatRoom = require('../models/chatroom.model');
const Contact = require('../models/contact.model');
const Message = require('../models/message.model');
const UnreadMessageCount = require('../models/unreadMessageCount.model');
const User = require('../models/user.model');
const { sendNotification } = require('../services/notification.service');
const { logUploadAudit } = require('../utils/cloudinaryMedia');
const mediaStorage = require('../services/mediaStorage.service');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const uniqueIds = (ids = []) => Array.from(new Set(ids.filter(Boolean).map(id => id.toString())));

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeObjectId(value) {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
}

function uniqueValidObjectIds(values = []) {
  return uniqueIds(values.map(normalizeObjectId)).filter(isValidObjectId);
}

function formatParticipant(user) {
  if (!user?._id) return null;
  return {
    _id: user._id.toString(),
    username: user.username || '',
    profileImage: user.profileImage || '',
    avatar: user.profileImage || '',
    online: Boolean(user.online),
    isOnline: Boolean(user.online),
    lastSeen: user.lastSeen || null
  };
}

const groupImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = Boolean(file?.mimetype?.startsWith('image/'));
    cb(allowed ? null : new Error('Only image uploads are supported'), allowed);
  }
});

async function assertGroupAccess(groupId, userId) {
  if (!isValidObjectId(groupId)) {
    return { status: 400, error: 'Invalid group id' };
  }

  const group = await ChatRoom.findOne({
    _id: groupId,
    roomType: 'group',
    participants: userId
  });

  if (!group) return { status: 404, error: 'Group not found' };
  return { group };
}

function isGroupAdmin(group, userId) {
  const id = userId.toString();
  return group.groupCreatedBy?.toString() === id ||
    group.groupAdmins?.some(adminId => adminId.toString() === id);
}

async function filterContactMemberIds(ownerId, requestedIds) {
  const ids = uniqueIds(requestedIds).filter(isValidObjectId);
  if (!ids.length) return [];

  const contacts = await Contact.find({
    userId: ownerId,
    contactId: { $in: ids.map(toObjectId) }
  }).select('contactId').lean();

  return contacts.map(contact => contact.contactId.toString());
}

async function notifyAddedMembers({ group, addedMemberIds, addedBy }) {
  const recipients = uniqueIds(addedMemberIds).filter(id => id !== addedBy.toString());
  if (!recipients.length) return;

  await Promise.allSettled(
    recipients.map(receiverId => sendNotification({
      type: 'group_added',
      senderId: addedBy,
      receiverId,
      activityId: group._id.toString(),
      targetType: 'group',
      targetId: group._id.toString(),
      targetUrl: `/groups/${group._id.toString()}`,
      message: `You were added to ${group.groupName}`,
      emitSocket: true,
      push: true,
      pushTitle: 'Added to a group',
      pushBody: `You were added to ${group.groupName}`,
      pushData: {
        type: 'group_added',
        groupId: group._id.toString(),
        groupName: group.groupName,
        groupImage: group.groupImage || '',
        roomId: group._id.toString(),
        chatId: group._id.toString(),
        targetType: 'group',
        targetId: group._id.toString(),
        isGroupChat: true
      }
    }))
  );

  if (global.io) {
    recipients.forEach(receiverId => {
      global.io.to(receiverId).emit('groupAdded', {
        groupId: group._id.toString(),
        groupName: group.groupName,
        addedBy: addedBy.toString()
      });
    });
  }
}

async function enrichGroup(group, userId) {
  const memberIds = uniqueValidObjectIds(
    group.groupMembers?.length ? group.groupMembers : group.participants
  );
  const participantIds = uniqueValidObjectIds(
    group.participants?.length ? group.participants : memberIds
  );
  const lookupIds = uniqueIds([...memberIds, ...participantIds]);

  const [lastMessage, unreadCountDoc, users] = await Promise.all([
    Message.findOne({ roomId: group._id })
      .sort({ createdAt: -1 })
      .select('text imageUrl audioUrl videoUrl fileUrl createdAt timestamp senderId')
      .populate('senderId', 'username profileImage _id')
      .lean(),
    UnreadMessageCount.findOne({ userId, roomId: group._id }).select('count').lean(),
    lookupIds.length
      ? User.find({ _id: { $in: lookupIds.map(toObjectId) } })
        .select('username profileImage online lastSeen _id')
        .lean()
      : []
  ]);

  const usersById = new Map(
    users
      .map(formatParticipant)
      .filter(Boolean)
      .map(user => [user._id, user])
  );
  const participants = participantIds.map(id => usersById.get(id)).filter(Boolean);
  const members = memberIds.map(id => usersById.get(id)).filter(Boolean);

  return {
    _id: group._id.toString(),
    roomType: 'group',
    groupName: group.groupName,
    groupBio: group.groupBio,
    groupImage: group.groupImage,
    groupCreatedBy: normalizeObjectId(group.groupCreatedBy),
    groupAdmins: uniqueValidObjectIds(group.groupAdmins || []),
    groupMembers: members,
    participants,
    memberCount: memberIds.length || members.length || participants.length,
    isAnnouncementChannel: Boolean(group.isAnnouncementChannel),
    lastMessage,
    lastMessageTime: lastMessage?.createdAt || lastMessage?.timestamp || group.updatedAt || group.createdAt,
    unreadCount: Number(unreadCountDoc?.count || 0),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
}

function handleGroupImageUpload(req, res, next) {
  groupImageUpload.single('image')(req, res, (err) => {
    if (!err) return next();
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(isTooLarge ? 413 : 400).json({
      success: false,
      message: isTooLarge ? 'Group image is too large' : (err.message || 'Invalid group image')
    });
  });
}

router.post('/upload-image', auth, handleGroupImageUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No group image uploaded' });
  }

  try {
    const result = await mediaStorage.upload(req.file, {
      folder: 'communities',
      type: 'image',
      area: 'group_image',
      cloudinary: {
        transformation: [
          { width: 512, height: 512, crop: 'fill', gravity: 'auto' }
        ]
      }
    });
    logUploadAudit({ area: 'group_image', file: req.file, result });
    res.json({
      success: true,
      imageUrl: result.secure_url,
      url: result.secure_url,
      publicId: result.public_id
    });
  } catch (err) {
    console.error('[GroupRoutes] image upload failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to upload group image' });
  }
});

router.patch('/:groupId/profile', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const access = await assertGroupAccess(req.params.groupId, userId);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });
    if (!isGroupAdmin(access.group, userId)) {
      return res.status(403).json({ success: false, message: 'Only group admins can update group profile' });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'groupName') || Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const groupName = String(req.body.groupName || req.body.name || '').trim();
      if (!groupName) return res.status(400).json({ success: false, message: 'Group name is required' });
      updates.groupName = groupName.substring(0, 80);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'groupBio') || Object.prototype.hasOwnProperty.call(req.body, 'bio')) {
      updates.groupBio = String(req.body.groupBio || req.body.bio || '').trim().substring(0, 240);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'groupImage') || Object.prototype.hasOwnProperty.call(req.body, 'image')) {
      updates.groupImage = String(req.body.groupImage || req.body.image || '').trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No group profile changes provided' });
    }

    Object.assign(access.group, updates);
    await access.group.save();

    res.json({
      success: true,
      group: await enrichGroup(access.group, userId)
    });
  } catch (err) {
    console.error('[GroupRoutes] update profile failed:', err);
    res.status(500).json({ success: false, message: 'Failed to update group profile' });
  }
});

router.post('/create', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const groupName = String(req.body.groupName || req.body.name || '').trim();
    const groupBio = String(req.body.groupBio || req.body.bio || '').trim();
    const groupImage = String(req.body.groupImage || req.body.image || '').trim();
    const requestedMemberIds = req.body.memberIds || req.body.members || [];

    if (!groupName) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    const contactMemberIds = await filterContactMemberIds(userId, requestedMemberIds);
    const allMemberIds = uniqueIds([userId, ...contactMemberIds]);

    if (allMemberIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one existing contact to create a group'
      });
    }

    const group = await ChatRoom.create({
      roomType: 'group',
      participants: allMemberIds.map(toObjectId),
      groupMembers: allMemberIds.map(toObjectId),
      groupName: groupName.substring(0, 80),
      groupBio: groupBio.substring(0, 240),
      groupImage,
      groupCreatedBy: userId,
      groupAdmins: [toObjectId(userId)]
    });

    await notifyAddedMembers({ group, addedMemberIds: contactMemberIds, addedBy: userId });

    res.status(201).json({
      success: true,
      group: await enrichGroup(group, userId)
    });
  } catch (err) {
    console.error('[GroupRoutes] create failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create group' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const limit = Math.min(Number(req.query.limit || 30), 50);
    const page = Math.max(Number(req.query.page || 1), 1);
    const groups = await ChatRoom.find({
      roomType: 'group',
      participants: userId
    })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      groups: await Promise.all(groups.map(group => enrichGroup(group, userId))),
      page,
      hasMore: groups.length === limit
    });
  } catch (err) {
    console.error('[GroupRoutes] list failed:', err);
    res.status(500).json({ success: false, message: 'Failed to load groups' });
  }
});

router.get('/:groupId', auth, async (req, res) => {
  try {
    const access = await assertGroupAccess(req.params.groupId, req.user.id);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });

    await access.group.populate('groupMembers', 'username profileImage online lastSeen _id');
    res.json({ success: true, group: await enrichGroup(access.group.toObject(), req.user.id) });
  } catch (err) {
    console.error('[GroupRoutes] get failed:', err);
    res.status(500).json({ success: false, message: 'Failed to load group' });
  }
});

router.post('/:groupId/add-members', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const access = await assertGroupAccess(req.params.groupId, userId);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });
    if (!isGroupAdmin(access.group, userId)) return res.status(403).json({ success: false, message: 'Only group admins can add members' });

    const contactMemberIds = await filterContactMemberIds(userId, req.body.memberIds || []);
    const existingIds = uniqueIds(access.group.participants);
    const newIds = contactMemberIds.filter(id => !existingIds.includes(id));

    if (!newIds.length) {
      return res.json({ success: true, group: await enrichGroup(access.group, userId), message: 'No new members to add' });
    }

    newIds.forEach(id => {
      access.group.participants.push(toObjectId(id));
      access.group.groupMembers.push(toObjectId(id));
    });
    await access.group.save();
    await notifyAddedMembers({ group: access.group, addedMemberIds: newIds, addedBy: userId });

    res.json({ success: true, group: await enrichGroup(access.group, userId) });
  } catch (err) {
    console.error('[GroupRoutes] add-members failed:', err);
    res.status(500).json({ success: false, message: 'Failed to add members' });
  }
});

router.post('/:groupId/remove-member', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const memberId = req.body.memberId?.toString();
    const access = await assertGroupAccess(req.params.groupId, userId);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });
    if (!isGroupAdmin(access.group, userId)) return res.status(403).json({ success: false, message: 'Only group admins can remove members' });
    if (!memberId || memberId === access.group.groupCreatedBy?.toString()) {
      return res.status(400).json({ success: false, message: 'This member cannot be removed' });
    }

    access.group.participants = access.group.participants.filter(id => id.toString() !== memberId);
    access.group.groupMembers = access.group.groupMembers.filter(id => id.toString() !== memberId);
    access.group.groupAdmins = access.group.groupAdmins.filter(id => id.toString() !== memberId);
    await access.group.save();
    res.json({ success: true, group: await enrichGroup(access.group, userId) });
  } catch (err) {
    console.error('[GroupRoutes] remove-member failed:', err);
    res.status(500).json({ success: false, message: 'Failed to remove member' });
  }
});

router.post('/:groupId/promote-admin', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const memberId = req.body.memberId?.toString();
    const access = await assertGroupAccess(req.params.groupId, userId);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });
    if (!isGroupAdmin(access.group, userId)) return res.status(403).json({ success: false, message: 'Only group admins can promote admins' });
    if (!memberId || !access.group.participants.some(id => id.toString() === memberId)) {
      return res.status(400).json({ success: false, message: 'Member not found in group' });
    }

    if (!access.group.groupAdmins.some(id => id.toString() === memberId)) {
      access.group.groupAdmins.push(toObjectId(memberId));
      await access.group.save();
    }
    res.json({ success: true, group: await enrichGroup(access.group, userId) });
  } catch (err) {
    console.error('[GroupRoutes] promote-admin failed:', err);
    res.status(500).json({ success: false, message: 'Failed to promote admin' });
  }
});

router.post('/:groupId/leave', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const access = await assertGroupAccess(req.params.groupId, userId);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });
    if (access.group.groupCreatedBy?.toString() === userId) {
      return res.status(400).json({ success: false, message: 'Creator must delete group or transfer ownership first' });
    }

    access.group.participants = access.group.participants.filter(id => id.toString() !== userId);
    access.group.groupMembers = access.group.groupMembers.filter(id => id.toString() !== userId);
    access.group.groupAdmins = access.group.groupAdmins.filter(id => id.toString() !== userId);
    await access.group.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[GroupRoutes] leave failed:', err);
    res.status(500).json({ success: false, message: 'Failed to leave group' });
  }
});

router.delete('/:groupId', auth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const access = await assertGroupAccess(req.params.groupId, userId);
    if (access.error) return res.status(access.status).json({ success: false, message: access.error });
    if (!isGroupAdmin(access.group, userId)) return res.status(403).json({ success: false, message: 'Only group admins can delete group' });

    await ChatRoom.deleteOne({ _id: access.group._id, roomType: 'group' });
    res.json({ success: true });
  } catch (err) {
    console.error('[GroupRoutes] delete failed:', err);
    res.status(500).json({ success: false, message: 'Failed to delete group' });
  }
});

module.exports = router;
