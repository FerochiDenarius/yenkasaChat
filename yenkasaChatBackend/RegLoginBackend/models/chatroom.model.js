const mongoose = require('mongoose');

// Update yenkasaChatBackend/RegLoginBackend/models/chatroom.model.js
const chatRoomSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    participantKey: { type: String, unique: true, sparse: true, index: true },
    lastMessage: { type: String, default: null },
    roomType: {
      type: String,
      enum: ['private', 'group'],
      default: 'private',
      index: true
    },
    groupName: {
      type: String,
      default: null
    },
    groupBio: {
      type: String,
      default: ''
    },
    groupImage: {
      type: String,
      default: ''
    },
    groupCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    groupAdmins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    groupMembers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    isAnnouncementChannel: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

chatRoomSchema.pre('validate', function setParticipantKey(next) {
  if (this.roomType === 'group') {
    this.participantKey = undefined;
    if (!Array.isArray(this.groupMembers) || this.groupMembers.length === 0) {
      this.groupMembers = this.participants || [];
    }
    return next();
  }

  if (Array.isArray(this.participants) && this.participants.length === 2) {
    this.participantKey = this.participants
      .map(participantId => participantId.toString())
      .sort()
      .join(':');
  }
  next();
});

chatRoomSchema.index({ roomType: 1, participants: 1, updatedAt: -1 });
chatRoomSchema.index({ roomType: 1, groupMembers: 1, updatedAt: -1 });

// ✅ Prevent model overwrite error in dev or hot reload
module.exports = mongoose.models.ChatRoom || mongoose.model('ChatRoom', chatRoomSchema);
