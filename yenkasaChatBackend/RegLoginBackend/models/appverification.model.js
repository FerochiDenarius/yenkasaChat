// models/appverification.model.js - PHASED VERIFICATION SYSTEM
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const appVerificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Current verification phase (1-6)
  currentPhase: {
    type: Number,
    default: 1,
    min: 1,
    max: 6
  },
  
  // Phase start date
  phaseStartDate: {
    type: Date,
    default: Date.now
  },
  
  // Phase end date (30 days from start)
  phaseEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  
  // Verification banner status
  hasVerifiedBanner: {
    type: Boolean,
    default: false
  },
  
  // Progress metrics
  metrics: {
    // Account age in days
    accountAge: {
      type: Number,
      default: 0
    },
    
    // Total comments made
    totalComments: {
      type: Number,
      default: 0
    },
    
    // Total followers
    totalFollowers: {
      type: Number,
      default: 0
    },
    
    // Maximum likes received on a single post
    maxLikesOnPost: {
      type: Number,
      default: 0
    },
    
    // Daily login count (for current phase)
    dailyLogins: {
      type: Number,
      default: 0
    },
    
    // Ads viewed count (for current phase)
    adsViewed: {
      type: Number,
      default: 0
    }
  },
  
  // Phase history
  phaseHistory: [{
    phase: Number,
    achievedAt: Date,
    bannerAwarded: Boolean
  }],
  
  // Last login date (to track daily logins)
  lastLoginDate: {
    type: Date,
    default: null
  },
  
  // Verification status
  isActivelyVerifying: {
    type: Boolean,
    default: true
  }
  
}, { timestamps: true });

// Calculate phase multiplier
appVerificationSchema.methods.getPhaseMultiplier = function() {
  const multipliers = {
    1: 1.0,
    2: 1.5,
    3: 3.0,
    4: 4.5,
    5: 6.0,
    6: 7.5
  };
  return multipliers[this.currentPhase] || 1.0;
};

// Get requirements for current phase
appVerificationSchema.methods.getCurrentRequirements = function() {
  const baseRequirements = {
    accountAge: 21, // 3 weeks in days
    comments: 30,
    followers: 100,
    maxLikes: 30,
    dailyLogins: 30,
    adsViewed: 100
  };
  
  const multiplier = this.getPhaseMultiplier();
  
  return {
    accountAge: baseRequirements.accountAge,
    comments: Math.floor(baseRequirements.comments * multiplier),
    followers: Math.floor(baseRequirements.followers * multiplier),
    maxLikes: Math.floor(baseRequirements.maxLikes * multiplier),
    dailyLogins: Math.floor(baseRequirements.dailyLogins * multiplier),
    adsViewed: Math.floor(baseRequirements.adsViewed * multiplier)
  };
};

// Check if all requirements are met
appVerificationSchema.methods.checkRequirementsMet = function() {
  const requirements = this.getCurrentRequirements();
  const metrics = this.metrics;
  
  return {
    accountAge: metrics.accountAge >= requirements.accountAge,
    comments: metrics.totalComments >= requirements.comments,
    followers: metrics.totalFollowers >= requirements.followers,
    maxLikes: metrics.maxLikesOnPost >= requirements.maxLikes,
    dailyLogins: metrics.dailyLogins >= requirements.dailyLogins,
    adsViewed: metrics.adsViewed >= requirements.adsViewed,
    allMet: 
      metrics.accountAge >= requirements.accountAge &&
      metrics.totalComments >= requirements.comments &&
      metrics.totalFollowers >= requirements.followers &&
      metrics.maxLikesOnPost >= requirements.maxLikes &&
      metrics.dailyLogins >= requirements.dailyLogins &&
      metrics.adsViewed >= requirements.adsViewed
  };
};

// Advance to next phase
appVerificationSchema.methods.advancePhase = async function() {
  if (this.currentPhase < 6) {
    // Record achievement
    this.phaseHistory.push({
      phase: this.currentPhase,
      achievedAt: new Date(),
      bannerAwarded: true
    });
    
    // Move to next phase
    this.currentPhase += 1;
    this.hasVerifiedBanner = true;
    this.phaseStartDate = new Date();
    this.phaseEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // Reset monthly metrics
    this.metrics.dailyLogins = 0;
    this.metrics.adsViewed = 0;
    
    await this.save();
    return true;
  }
  return false; // Already at max phase
};

// Track daily login
appVerificationSchema.methods.trackLogin = async function() {
  const today = new Date().setHours(0, 0, 0, 0);
  const lastLogin = this.lastLoginDate ? this.lastLoginDate.setHours(0, 0, 0, 0) : null;
  
  // Only count if it's a different day
  if (!lastLogin || today !== lastLogin) {
    this.metrics.dailyLogins += 1;
    this.lastLoginDate = new Date();
    await this.save();
    return true;
  }
  return false;
};

// Track ad view
appVerificationSchema.methods.trackAdView = async function() {
  this.metrics.adsViewed += 1;
  await this.save();
};

// Update account age
appVerificationSchema.methods.updateAccountAge = async function(userCreatedAt) {
  const now = new Date();
  const created = new Date(userCreatedAt);
  const ageInDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  this.metrics.accountAge = ageInDays;
  await this.save();
};

const AppVerification = mongoose.model('AppVerification', appVerificationSchema);
module.exports = AppVerification;