const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const shareActivitySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sharedAt: { type: Date, default: Date.now },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' }
}, { timestamps: true });

shareActivitySchema.index({ userId: 1, postId: 1 }, { unique: true });

module.exports =
  mongoose.models.ShareActivity ||
  mongoose.model('ShareActivity', shareActivitySchema);
