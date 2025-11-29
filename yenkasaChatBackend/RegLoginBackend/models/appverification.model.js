// models/appverification.model.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const appVerificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // ------------------------------
    // VERIFICATION PHASE SYSTEM
    // ------------------------------
    currentPhase: { type: Number, default: 1, min: 1, max: 6 },

    phaseStartDate: { type: Date, default: Date.now },
    phaseEndDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },

    hasVerifiedBanner: { type: Boolean, default: false },

    // ------------------------------
    // PHASE METRICS (Existing)
    // ------------------------------
    metrics: {
      // Existing
      accountAge: { type: Number, default: 0 }, // days
      totalComments: { type: Number, default: 0 }, // user-made comments
      totalFollowers: { type: Number, default: 0 },
      maxLikesOnPost: { type: Number, default: 0 },
      dailyLogins: { type: Number, default: 0 },
      adsViewed: { type: Number, default: 0 },

      // ------------------------------
      // NEW — STORED PERFORMANCE METRICS
      // ------------------------------

      // Posts created
      postsCreated: { type: Number, default: 0 },

      // Total likes received (sum across all posts)
      totalLikesReceived: { type: Number, default: 0 },

      // Total views received on posts
      totalViewsReceived: { type: Number, default: 0 },

      // Total comments received on posts
      totalCommentsReceived: { type: Number, default: 0 },

      // Total replies received (comments on comments)
      totalRepliesReceived: { type: Number, default: 0 },

      // Likes received on comments
      commentLikesReceived: { type: Number, default: 0 },

      // Post shares (future expansion)
      totalShares: { type: Number, default: 0 },
    },

    // ------------------------------
    // HISTORY
    // ------------------------------
    phaseHistory: [
      {
        phase: Number,
        achievedAt: Date,
        bannerAwarded: Boolean,
      },
    ],

    // ------------------------------
    // LOGIN + VERIFICATION STATUS
    // ------------------------------
    lastLoginDate: { type: Date, default: null },
    isActivelyVerifying: { type: Boolean, default: true },
  },

  { timestamps: true }
);



// ========================================================================
// EXISTING METHODS (unchanged but now act on expanded metrics)
// ========================================================================

// PHASE MULTIPLIER
appVerificationSchema.methods.getPhaseMultiplier = function () {
  const multipliers = {
    1: 1.0,
    2: 1.5,
    3: 3.0,
    4: 4.5,
    5: 6.0,
    6: 7.5,
  };
  return multipliers[this.currentPhase] || 1.0;
};

// REQUIREMENTS
appVerificationSchema.methods.getCurrentRequirements = function () {
  const base = {
    accountAge: 21,
    comments: 30,
    followers: 100,
    maxLikes: 30,
    dailyLogins: 30,
    adsViewed: 100,
  };

  const mult = this.getPhaseMultiplier();

  return {
    accountAge: base.accountAge,
    comments: Math.floor(base.comments * mult),
    followers: Math.floor(base.followers * mult),
    maxLikes: Math.floor(base.maxLikes * mult),
    dailyLogins: Math.floor(base.dailyLogins * mult),
    adsViewed: Math.floor(base.adsViewed * mult),
  };
};

// CHECK REQUIREMENTS
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
      m.adsViewed >= req.adsViewed,
  };
};

// ADVANCE PHASE
appVerificationSchema.methods.advancePhase = async function () {
  if (this.currentPhase < 6) {
    this.phaseHistory.push({
      phase: this.currentPhase,
      achievedAt: new Date(),
      bannerAwarded: true,
    });

    this.currentPhase += 1;
    this.hasVerifiedBanner = true;
    this.phaseStartDate = new Date();
    this.phaseEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Reset only phase-specific metrics
    this.metrics.dailyLogins = 0;
    this.metrics.adsViewed = 0;

    await this.save();
    return true;
  }
  return false;
};

// TRACK LOGIN
appVerificationSchema.methods.trackLogin = async function () {
  const today = new Date().setHours(0, 0, 0, 0);
  const lastLogin = this.lastLoginDate
    ? this.lastLoginDate.setHours(0, 0, 0, 0)
    : null;

  if (!lastLogin || today !== lastLogin) {
    this.metrics.dailyLogins += 1;
    this.lastLoginDate = new Date();
    await this.save();
    return true;
  }
  return false;
};

// TRACK AD
appVerificationSchema.methods.trackAdView = async function () {
  this.metrics.adsViewed += 1;
  await this.save();
};

// UPDATE ACCOUNT AGE
appVerificationSchema.methods.updateAccountAge = async function (createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  this.metrics.accountAge = Math.floor(
    (now - created) / (1000 * 60 * 60 * 24)
  );
  await this.save();
};

module.exports = mongoose.model("AppVerification", appVerificationSchema);
