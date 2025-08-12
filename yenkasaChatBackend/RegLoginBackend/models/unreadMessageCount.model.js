// models/unreadMessageCount.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const unreadMessageCountSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    count: { type: Number, default: 0, min: 0 },
    lastReadTimestamp: { type: Date } // Optional: to help determine messages sent *after* last read
}, { timestamps: true });

// Compound index for efficient querying
unreadMessageCountSchema.index({ userId: 1, roomId: 1 }, { unique: true });

module.exports = mongoose.model('UnreadMessageCount', unreadMessageCountSchema);