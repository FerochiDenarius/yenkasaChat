const mongoose = require("mongoose");

const DeleteRequestSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reason: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "processed", "rejected"],
      default: "pending",
      index: true,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: "",
    },

    ipAddress: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeleteRequest", DeleteRequestSchema);
