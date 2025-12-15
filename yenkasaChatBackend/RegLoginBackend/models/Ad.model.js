const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdSchema = new Schema({
  title: String,
  adType: { type: String, enum: ['google','sponsor','internal'], default: 'internal' },
  imageUrl: String,
  videoUrl: String,
  sponsorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rewardYKC: { type: Number, default: 5 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  meta: Schema.Types.Mixed
});

module.exports = mongoose.model('Ad', AdSchema);
