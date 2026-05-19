const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const monetizationEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  creatorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  adId: { type: String, trim: true, default: '', index: true },
  postId: { type: String, trim: true, default: '', index: true },
  eventType: { type: String, trim: true, required: true, index: true },
  placement: { type: String, trim: true, default: '', index: true },
  platform: { type: String, enum: ['android', 'web'], default: 'android', index: true },
  country: { type: String, trim: true, default: 'Ghana', index: true },
  durationMs: { type: Number, default: 0, min: 0 },
  skipped: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  rewarded: { type: Boolean, default: false },
  monetizedSession: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true, collection: 'monetization_events' });

monetizationEventSchema.index({ createdAt: -1, placement: 1 });
monetizationEventSchema.index({ creatorUserId: 1, createdAt: -1 });

module.exports =
  mongoose.models.MonetizationEvent ||
  mongoose.model('MonetizationEvent', monetizationEventSchema);
