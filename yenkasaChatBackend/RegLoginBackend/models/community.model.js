// models/community.model.js - UPDATED WITH MEMBER ASSOCIATION & CREATOR TRACKING
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const communitySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },

  // 👥 Members association
  members: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  ],

  // Community stats
  memberCount: {
    type: Number,
    default: 0
  },
  postCount: {
    type: Number,
    default: 0
  },

  // Community settings
  isActive: {
    type: Boolean,
    default: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },

  // Creator tracking
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow system-created communities
  },

  // Approval system
  isApproved: {
    type: Boolean,
    default: false // Admin must approve user-created communities
  },

  // Moderation
  moderators: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Rules and guidelines
  rules: [{
    title: String,
    description: String
  }],

  // Categories/Tags
  categories: [String],

  // Location (empty for interest-based communities)
  location: {
    type: String,
    default: ''
  },

  // Featured posts
  pinnedPosts: [{
    type: Schema.Types.ObjectId,
    ref: 'Post'
  }]
}, { timestamps: true });


// 📦 Indexes for faster queries
communitySchema.index({ name: 1 });
communitySchema.index({ memberCount: -1 });
communitySchema.index({ isActive: 1 });
communitySchema.index({ isApproved: 1 });
communitySchema.index({ createdBy: 1 });


// 🔹 Helper methods
communitySchema.methods.incrementMemberCount = async function() {
  this.memberCount = (this.memberCount || 0) + 1;
  await this.save();
};

communitySchema.methods.decrementMemberCount = async function() {
  this.memberCount = Math.max((this.memberCount || 0) - 1, 0);
  await this.save();
};

communitySchema.methods.incrementPostCount = async function() {
  this.postCount = (this.postCount || 0) + 1;
  await this.save();
};


// ✅ Export model
const Community = mongoose.model('Community', communitySchema);
module.exports = Community;
