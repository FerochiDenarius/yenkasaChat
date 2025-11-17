// models/community.model.js
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

  members: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  memberCount: {
    type: Number,
    default: 0
  },
  postCount: {
    type: Number,
    default: 0
  },

  isActive: {
    type: Boolean,
    default: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  isApproved: {
    type: Boolean,
    default: false
  },

  moderators: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  rules: [{
    title: String,
    description: String
  }],

  categories: [String],

  location: {
    type: String,
    default: ''
  },

  pinnedPosts: [{
    type: Schema.Types.ObjectId,
    ref: 'Post'
  }],


  // ---------------------------------------------------
  // 🔥 FIELDS ADDED TO MATCH FRONTEND MODEL EXACTLY
  // ---------------------------------------------------

  // Membership status (per user)
  isJoined: { type: Boolean, default: false },
  isMember: { type: Boolean, default: false },
  joinedAt: { type: Date, default: null },
  membershipStatus: { type: String, default: null },

  // Community classification
  communityType: { type: String, default: null },

  // Distance from user
  distance: { type: Number, default: null },

  // User permissions
  canPost: { type: Boolean, default: false },
  canModerate: { type: Boolean, default: false }
  
}, { timestamps: true });

// Indexes
communitySchema.index({ name: 1 });
communitySchema.index({ memberCount: -1 });
communitySchema.index({ isActive: 1 });
communitySchema.index({ isApproved: 1 });
communitySchema.index({ createdBy: 1 });

// Helpers (unchanged)
communitySchema.methods.incrementMemberCount = async function () {
  this.memberCount = (this.memberCount || 0) + 1;
  await this.save();
};

communitySchema.methods.decrementMemberCount = async function () {
  this.memberCount = Math.max((this.memberCount || 0) - 1, 0);
  await this.save();
};

communitySchema.methods.incrementPostCount = async function () {
  this.postCount = (this.postCount || 0) + 1;
  await this.save();
};

module.exports = mongoose.model('Community', communitySchema);
