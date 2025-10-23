const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String },
  mediaType: { type: String, enum: ['text', 'image', 'video', 'audio'], required: true },
  mediaUrl: { type: String },
  thumbnailUrl: { type: String },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for user info (optional, you can also populate normally)
postSchema.virtual('userInfo', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true, // single user
});

// Middleware to always populate userInfo on find queries
function autoPopulateUser(next) {
  this.populate('user', '_id username profileImage'); // populate actual user
  next();
}

postSchema.pre('find', autoPopulateUser);
postSchema.pre('findOne', autoPopulateUser);
postSchema.pre('findById', autoPopulateUser);

module.exports = mongoose.model('Post', postSchema);
