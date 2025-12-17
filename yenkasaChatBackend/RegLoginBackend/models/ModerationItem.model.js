const mongoose = require("mongoose");

const ModerationItemSchema = new mongoose.Schema(
  {
    /* -------------------------------------------------
     * TYPE OF MODERATION ACTION
     * ------------------------------------------------- */
    type: {
      type: String,
      enum: [
        // Account & data
        "account_deletion",
        "partial_data_deletion",

        // User generated content
        "post_report",
        "comment_report",
        "user_report",

        // System / automated
        "system_flag"
      ],
      required: true,
      index: true
    },

    /* -------------------------------------------------
     * TARGETS (OPTIONAL, DEPENDS ON TYPE)
     * ------------------------------------------------- */

    // User being acted on (account deletion, user report, etc.)
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    // Post involved (post report, post moderation)
    targetPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true
    },

    // Comment involved (comment report)
    targetCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },

    /* -------------------------------------------------
     * REQUESTOR / REPORTER
     * ------------------------------------------------- */

    // Who initiated this (user who reported / requested)
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Email used (for public deletion/data requests)
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true
    },

    /* -------------------------------------------------
     * CONTENT
     * ------------------------------------------------- */
    reason: {
      type: String,
      default: ""
    },

    /* -------------------------------------------------
     * STATUS & HANDLING
     * ------------------------------------------------- */
    status: {
      type: String,
      enum: [
        "pending",     // waiting for review
        "approved",    // approved (e.g. delete confirmed)
        "rejected",    // rejected (invalid request)
        "resolved"     // action completed
      ],
      default: "pending",
      index: true
    },

    // Who handled it (admin/mod/dev)
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    handledAt: {
      type: Date,
      default: null
    },

    /* -------------------------------------------------
     * METADATA (FLEXIBLE, SAFE)
     * ------------------------------------------------- */
    metadata: {
      type: Object,
      default: {}
    },

    /* -------------------------------------------------
     * SYSTEM INFO
     * ------------------------------------------------- */
    createdBy: {
      type: String,
      enum: ["user", "system"],
      default: "user"
    },

    ipAddress: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ModerationItem", ModerationItemSchema);
