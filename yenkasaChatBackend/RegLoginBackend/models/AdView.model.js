const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdViewSchema = new Schema({
  adId: { type: Schema.Types.ObjectId, ref: 'Ad' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  watchedAt: { type: Date, default: Date.now },
  durationMs: Number,
  fullyWatched: { type: Boolean, default: false },
  rewarded: { type: Boolean, default: false }, // ensures idempotent reward
  verificationCounted: { type: Boolean, default: false },
  deviceInfo: Schema.Types.Mixed
});

module.exports = mongoose.model('AdView', AdViewSchema);
