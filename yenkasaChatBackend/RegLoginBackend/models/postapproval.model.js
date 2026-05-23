//postapproval.model
const mongoose = require("mongoose");

const PostApprovalSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true,
    unique: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  caption: { type: String },
  textBackgroundColor: { type: String, default: "" },
  imageUrl: { type: String },
  imageUrls: [{ type: String }],
  videoUrl: { type: String },
  audioUrl: { type: String },

  submittedAt: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  aiModeration: {
    type: Object,
    default: null
  },

  notifiedAdmins: { type: Boolean, default: false }
});

module.exports = mongoose.model("PostApproval", PostApprovalSchema);
