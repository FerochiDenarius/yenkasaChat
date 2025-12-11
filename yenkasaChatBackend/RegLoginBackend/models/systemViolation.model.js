const mongoose = require("mongoose");
const { Schema } = mongoose;

const SystemViolationSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",   // or SYSTEM_USER_ID for automated blocks
      required: true
    },

    reason: {
      type: String,
      required: true
    },

    action: {
      type: String,
      enum: ["warning", "system_block", "system_unblock"],
      required: true
    },

    systemBlocked: {
      type: Boolean,
      default: false
    },

    expiresAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemViolation", SystemViolationSchema);
