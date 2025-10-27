const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  locationTag: { type: String },
  coverImage: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  verifiedPosters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  rules: { 
    type: [String], 
    default: ["No pornographic content", "No hate speech"] 
  },
}, { timestamps: true });

module.exports = mongoose.model("Community", communitySchema);
