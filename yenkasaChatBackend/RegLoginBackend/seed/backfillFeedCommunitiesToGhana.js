// Backfill legacy feed-visible communities that were created before country scoping.
require("dotenv").config();
const mongoose = require("mongoose");
const Community = require("../models/community.model");
const Post = require("../models/post.model");

async function backfillFeedCommunitiesToGhana() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in .env");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const feedCommunityIds = await Post.find({
    isActive: true,
    status: "approved",
    communityId: { $exists: true, $ne: null }
  }).distinct("communityId");

  const result = await Community.updateMany(
    {
      _id: { $in: feedCommunityIds },
      isActive: true,
      isApproved: true,
      $or: [
        { country: { $exists: false } },
        { country: null },
        { country: "" }
      ]
    },
    { $set: { country: "Ghana" } }
  );

  console.log("Feed-visible communities checked:", feedCommunityIds.length);
  console.log("Communities moved into Ghana:", result.modifiedCount || 0);
}

backfillFeedCommunitiesToGhana()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Backfill failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
