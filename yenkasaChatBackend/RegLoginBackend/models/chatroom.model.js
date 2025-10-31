const mongoose = require('mongoose');

// Update yenkasaChatBackend/RegLoginBackend/models/chatroom.model.js
const chatRoomSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: String, default: null }
  },
  { timestamps: true }
);


// ✅ Prevent model overwrite error in dev or hot reload
module.exports = mongoose.models.ChatRoom || mongoose.model('ChatRoom', chatRoomSchema);
