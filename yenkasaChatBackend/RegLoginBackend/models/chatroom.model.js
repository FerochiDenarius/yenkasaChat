const mongoose = require('mongoose');

// Update yenkasaChatBackend/RegLoginBackend/models/chatroom.model.js
const chatRoomSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    participantKey: { type: String, unique: true, sparse: true, index: true },
    lastMessage: { type: String, default: null }
  },
  { timestamps: true }
);

chatRoomSchema.pre('validate', function setParticipantKey(next) {
  if (Array.isArray(this.participants) && this.participants.length === 2) {
    this.participantKey = this.participants
      .map(participantId => participantId.toString())
      .sort()
      .join(':');
  }
  next();
});


// ✅ Prevent model overwrite error in dev or hot reload
module.exports = mongoose.models.ChatRoom || mongoose.model('ChatRoom', chatRoomSchema);
