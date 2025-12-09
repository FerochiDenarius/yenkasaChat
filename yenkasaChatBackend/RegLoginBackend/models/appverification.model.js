// models/appverification.model.js - VERIFIED & MATCHED TO ANDROID MODEL
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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

      // ACTIVITY METRICS
      totalPostCount: { type: Number, default: 0 },
      totalViewsCount: { type: Number, default: 0 },
      totalLikesCount: { type: Number, default: 0 },
      totalCommentsMade: { type: Number, default: 0 }
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
  const base = {
    accountAge: 21,
    comments: 30,
    followers: 100,
    maxLikes: 30,
    dailyLogins: 30,
    adsViewed: 100
  };

  const m = this.getPhaseMultiplier();

  return {
    accountAge: base.accountAge,
    comments: Math.floor(base.comments * m),
    followers: Math.floor(base.followers * m),
    maxLikes: Math.floor(base.maxLikes * m),
    dailyLogins: Math.floor(base.dailyLogins * m),
    adsViewed: Math.floor(base.adsViewed * m)
  };
};

appVerificationSchema.methods.checkRequirementsMet = function () {
  const req = this.getCurrentRequirements();
  const m = this.metrics;

  return {
    accountAge: m.accountAge >= req.accountAge,
    comments: m.totalComments >= req.comments,
    followers: m.totalFollowers >= req.followers,
    maxLikes: m.maxLikesOnPost >= req.maxLikes,
    dailyLogins: m.dailyLogins >= req.dailyLogins,
    adsViewed: m.adsViewed >= req.adsViewed,
    allMet:
      m.accountAge >= req.accountAge &&
      m.totalComments >= req.comments &&
      m.totalFollowers >= req.followers &&
      m.maxLikesOnPost >= req.maxLikes &&
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

module.exports = mongoose.model("AppVerification", appVerificationSchema);
