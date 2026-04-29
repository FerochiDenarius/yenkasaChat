const mongoose = require("mongoose");

const UserPrivacySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },

    // everyone | community_members | requires_approval | nobody
    privacyLevel: { type: String, default: "everyone" },

    // USERS YOU HAVE BLOCKED
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // USERS YOU HAVE APPROVED TO MESSAGE YOU WHEN PRIVACY REQUIRES APPROVAL
    approvedMessageUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // USERS YOU HIDE (mute from feed)
    hiddenUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // COMMUNITIES WHOSE MEMBERS YOU BLOCK FROM SEEING YOUR POSTS
    blockedCommunities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],

    // COMMUNITY VISIBILITY SETTINGS (THIS IS THE IMPORTANT PART)
    visibilitySettings: [
        {
            communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
            blockUsers: { type: Boolean, default: false },        // Block community members
            exceptFollowers: { type: Boolean, default: false }    // Allow followers
        }
    ]
});

module.exports = mongoose.model("UserPrivacy", UserPrivacySchema);
