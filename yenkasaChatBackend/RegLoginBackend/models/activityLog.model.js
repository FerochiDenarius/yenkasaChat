const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const activityLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  postId: { type: Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
  action: { type: String, required: true, index: true },
  coinsAwarded: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: true },
  watchDuration: { type: Number, default: 0 },
  qualifiedView: { type: Boolean, default: false, index: true },
  monetizableOpportunity: { type: Boolean, default: false, index: true },
  suspicious: { type: Boolean, default: false },
  ipAddress: { type: String, default: '' },
  deviceId: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true, collection: 'activity_logs' });

activityLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, qualifiedView: 1, timestamp: -1 });
activityLogSchema.index({ suspicious: 1, timestamp: -1 });
activityLogSchema.index({ deviceId: 1, timestamp: -1 });
activityLogSchema.index({ ipAddress: 1, timestamp: -1 });

module.exports =
  mongoose.models.ActivityLog ||
  mongoose.model('ActivityLog', activityLogSchema);
