const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// ✅ Prevent model overwrite error in dev or hot reload
module.exports = mongoose.models.ChatRoom || mongoose.model('ChatRoom', chatRoomSchema);
