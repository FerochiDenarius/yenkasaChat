const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true },
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Auto-populate user info for every query
function autoPopulateUser(next) {
  this.populate('user', '_id username profileImage');
  next();
}
commentSchema.pre(/^find/, autoPopulateUser);

module.exports = mongoose.model('Comment', commentSchema);
