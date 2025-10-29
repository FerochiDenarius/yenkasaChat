// models/community.model.js - UPDATED WITH CREATOR TRACKING
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

// Indexes for faster queries
communitySchema.index({ name: 1 });
communitySchema.index({ memberCount: -1 });
communitySchema.index({ isActive: 1 });
communitySchema.index({ isApproved: 1 });
communitySchema.index({ createdBy: 1 });

// Method to increment member count
communitySchema.methods.incrementMemberCount = async function() {
  this.memberCount += 1;
  await this.save();
};

// Method to decrement member count
communitySchema.methods.decrementMemberCount = async function() {
  this.memberCount = Math.max(0, this.memberCount - 1);
  await this.save();
};

// Method to increment post count
communitySchema.methods.incrementPostCount = async function() {
  this.postCount += 1;
  await this.save();
};

const Community = mongoose.model('Community', communitySchema);
module.exports = Community;