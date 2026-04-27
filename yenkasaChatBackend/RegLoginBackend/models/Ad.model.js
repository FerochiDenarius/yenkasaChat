const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdSchema = new Schema({
  title: String,
  adType: { type: String, enum: ['google','sponsor','internal'], default: 'internal' },
  imageUrl: String,
  videoUrl: String,
  thumbnailUrl: String,
  ctaText: String,
  ctaUrl: String,
  sponsorName: String,
  sponsorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rewardYKC: { type: Number, default: 5 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  submittedByRole: { type: String, default: '' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  meta: Schema.Types.Mixed
});

module.exports = mongoose.model('Ad', AdSchema);
