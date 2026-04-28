// models/appverification.model.js - VERIFIED & MATCHED TO ANDROID MODEL
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {
  PRELAUNCH_LABEL,
  RANKING_LAUNCH_DATE,
  RANK_REQUIREMENTS
} = require('../config/ranking.config');

// ------------------------------
// PHASE HISTORY ITEM (MATCH FRONTEND)
// ------------------------------
const PhaseHistorySchema = new Schema({
  phase: { type: Number, required: true },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  completed: { type: Boolean, default: false }
});

// ------------------------------
// MAIN SCHEMA
// ------------------------------
const appVerificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    currentPhase: {
      type: Number,
      default: 1,
      min: 1,
      max: 6
    },

    phaseStartDate: {
      type: Date,
      default: Date.now
    },

    phaseEndDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },

    hasVerifiedBanner: {
      type: Boolean,
      default: false
    },

    // ------------------------------
    // METRICS - MATCH ANDROID EXACTLY
    // ------------------------------

    
    metrics: {
      // CORE
      accountAge: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalFollowers: { type: Number, default: 0 },
      maxLikesOnPost: { type: Number, default: 0 },
      dailyLogins: { type: Number, default: 0 },
      adsViewed: { type: Number, default: 0 },

      // RECEIVED METRICS (ANDROID EXPECTS THESE)
      postsCreated: { type: Number, default: 0 },
      totalViewsReceived: { type: Number, default: 0 },
      totalRepliesReceived: { type: Number, default: 0 },
      totalLikesReceived: { type: Number, default: 0 },
      totalCommentsReceived: { type: Number, default: 0 },
      commentLikesReceived: { type: Number, default: 0 },
      totalShares: { type: Number, default: 0 },

      // SOCIAL
      totalFollowing: { type: Number, default: 0 },

// ACTIVITY METRICS - GIVEN BY USER
totalPostCount: { type: Number, default: 0 },
totalViewsCount: { type: Number, default: 0 },
totalLikesCount: { type: Number, default: 0 },
totalCommentsMade: { type: Number, default: 0 },
postsLiked: { type: Number, default: 0 },
repliesMade: { type: Number, default: 0 },
totalViewsMade: { type: Number, default: 0 },
sharesMade: { type: Number, default: 0 },

// COMMUNITY SUPPORT METRICS
profilesVisited: { type: Number, default: 0 },
communitiesJoined: { type: Number, default: 0 },
communitiesEngaged: { type: Number, default: 0 },

// TRUST / REVIEW METRICS
reportsMade: { type: Number, default: 0 },
validReports: { type: Number, default: 0 }

    },

    // ------------------------------
    // PHASE HISTORY (MATCH ANDROID)
    // ------------------------------
    phaseHistory: [PhaseHistorySchema],

    lastLoginDate: {
      type: Date,
      default: null
    },

    isActivelyVerifying: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// ------------------------------
// METHODS
// ------------------------------
appVerificationSchema.methods.getPhaseMultiplier = function () {
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

appVerificationSchema.methods.getCurrentRequirements = function () {
  const rankKey = this.getRankKeyForPhase();
  return RANK_REQUIREMENTS[rankKey] || RANK_REQUIREMENTS.verified;
};

appVerificationSchema.methods.getRankKeyForPhase = function () {
  if (this.currentPhase >= 3) return 'moderator';
  if (this.currentPhase === 2) return 'admin';
  return 'verified';
};

appVerificationSchema.methods.getNextRankKeyForPhase = function () {
  if (this.currentPhase >= 3) return 'moderator';
  if (this.currentPhase === 2) return 'moderator';
  return 'admin';
};

appVerificationSchema.methods.getRankingPeriodLabel = function () {
  return new Date() < RANKING_LAUNCH_DATE ? PRELAUNCH_LABEL : 'Official ranking period';
};

appVerificationSchema.methods.checkRequirementsMet = function () {
  const req = this.getCurrentRequirements();
  const m = this.metrics;

  return {
    accountAge: m.accountAge >= req.accountAge,
    comments: m.totalCommentsMade >= (req.totalCommentsMade || req.comments || 0),
    followers: m.totalFollowing >= (req.totalFollowing || req.followers || 0),
    maxLikes: m.postsLiked >= (req.postsLiked || req.maxLikes || 0),
    dailyLogins: m.dailyLogins >= req.dailyLogins,
    adsViewed: m.adsViewed >= req.adsViewed,
    allMet:
      m.accountAge >= req.accountAge &&
      m.totalCommentsMade >= (req.totalCommentsMade || req.comments || 0) &&
      m.totalFollowing >= (req.totalFollowing || req.followers || 0) &&
      m.postsLiked >= (req.postsLiked || req.maxLikes || 0) &&
      m.dailyLogins >= req.dailyLogins &&
      m.adsViewed >= req.adsViewed
  };
};

appVerificationSchema.methods.trackLogin = async function () {
  const today = new Date().setHours(0, 0, 0, 0);
  const last = this.lastLoginDate ? this.lastLoginDate.setHours(0, 0, 0, 0) : null;

  if (!last || today !== last) {
    this.metrics.dailyLogins += 1;
    this.lastLoginDate = new Date();
    await this.save();
    return true;
  }
  return false;
};

appVerificationSchema.methods.trackAdView = async function () {
  this.metrics.adsViewed += 1;
  await this.save();
};

appVerificationSchema.methods.updateAccountAge = async function (createdAt) {
  const age = Math.floor((Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
  this.metrics.accountAge = age;
  await this.save();
};

appVerificationSchema.methods.advancePhase = async function () {
  const now = new Date();
  const currentPhase = this.currentPhase;

  this.phaseHistory.push({
    phase: currentPhase,
    startedAt: this.phaseStartDate || null,
    endedAt: now,
    completed: true
  });

  this.currentPhase = Math.min(currentPhase + 1, 6);
  this.phaseStartDate = now;
  this.phaseEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  this.hasVerifiedBanner = this.currentPhase >= 6;

  await this.save();
  return this;
};

appVerificationSchema.methods.checkPhaseAdvancement = async function () {
  const progress = this.checkRequirementsMet();
  const now = new Date();

  if (!progress.allMet) {
    return {
      advanced: false,
      reason: "requirements_not_met",
      currentPhase: this.currentPhase,
      progress
    };
  }

  if (now < this.phaseEndDate) {
    return {
      advanced: false,
      reason: "phase_time_remaining",
      currentPhase: this.currentPhase,
      daysRemaining: Math.ceil((this.phaseEndDate - now) / (1000 * 60 * 60 * 24)),
      progress
    };
  }

  if (this.currentPhase >= 6) {
    this.hasVerifiedBanner = true;
    await this.save();
    return {
      advanced: false,
      reason: "max_phase_reached",
      currentPhase: this.currentPhase,
      hasVerifiedBanner: this.hasVerifiedBanner,
      progress
    };
  }

  await this.advancePhase();

  return {
    advanced: true,
    currentPhase: this.currentPhase,
    hasVerifiedBanner: this.hasVerifiedBanner,
    nextRequirements: this.getCurrentRequirements()
  };
};

module.exports = mongoose.model("AppVerification", appVerificationSchema);
