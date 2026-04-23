const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FollowSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // 🔖 Optional meta info
    status: {
      type: String,
      enum: ['active', 'unfollowed'],
      default: 'active'
    },
    followedAt: {
      type: Date,
      default: Date.now
    },
    unfollowedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// 🚫 Prevent duplicate follow pairs
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

// ✅ Static methods for reusability
FollowSchema.statics = {
  async getFollowersCount(userId) {
    return this.countDocuments({ following: userId, status: 'active' });
  },

  async getFollowingCount(userId) {
    return this.countDocuments({ follower: userId, status: 'active' });
  },

  async getFollowers(userId, limit = 50, skip = 0) {
    return this.find({ following: userId, status: 'active' })
      .populate('follower', 'username profileImage bio verified roleName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },

  async getFollowing(userId, limit = 50, skip = 0) {
    return this.find({ follower: userId, status: 'active' })
      .populate('following', 'username profileImage bio verified roleName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }
};

module.exports = mongoose.model('Follow', FollowSchema);
