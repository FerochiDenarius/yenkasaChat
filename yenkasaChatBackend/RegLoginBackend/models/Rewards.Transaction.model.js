const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RewardTxSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['AD_REWARD', 'AD_CLICK_REWARD', 'SPONSOR_CREDIT', 'ADMIN_ADJUST'] },
  amount: Number,
  adId: { type: Schema.Types.ObjectId, ref: 'Ad', default: null },
  createdAt: { type: Date, default: Date.now },
  meta: Schema.Types.Mixed
});

module.exports = mongoose.model('RewardTransaction', RewardTxSchema);
