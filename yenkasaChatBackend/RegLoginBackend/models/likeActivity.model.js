// models/likeActivity.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const likeActivitySchema = new Schema({
  activityId: { type: String, required: true, unique: true, index: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['post', 'comment'], required: true, index: true },
  targetId: { type: Schema.Types.ObjectId, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('LikeActivity', likeActivitySchema);
