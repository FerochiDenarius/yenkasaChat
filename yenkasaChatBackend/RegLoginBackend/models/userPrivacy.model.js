const mongoose = require("mongoose");

const UserPrivacySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },

    // everyone | requires_approval | nobody
    privacyLevel: { type: String, default: "everyone" },

    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedCommunities: [{ type: String }], // community IDs
    hiddenUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});

module.exports = mongoose.model("UserPrivacy", UserPrivacySchema);
