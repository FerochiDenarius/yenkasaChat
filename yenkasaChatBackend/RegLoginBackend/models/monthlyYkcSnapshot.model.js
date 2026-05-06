const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const monthlyYkcSnapshotSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  month: { type: String, required: true, index: true },
  ykcEarnedThisMonth: { type: Number, default: 0 },
  ykcBalance: { type: Number, default: 0 },
  totalQualifiedViews: { type: Number, default: 0 },
  totalWatchTime: { type: Number, default: 0 },
  totalMonetizableOpportunities: { type: Number, default: 0 }
}, { timestamps: true });

monthlyYkcSnapshotSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports =
  mongoose.models.MonthlyYkcSnapshot ||
  mongoose.model('MonthlyYkcSnapshot', monthlyYkcSnapshotSchema);
