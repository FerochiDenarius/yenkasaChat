const mongoose = require('mongoose');

const socialGraphSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    relationshipTypes: { type: [String], default: [] },
    weight: { type: Number, default: 0, index: true },
    mutualCount: { type: Number, default: 0 },
    sharedCommunityIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    lastInteractionAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'social_graph' },
);

socialGraphSchema.index({ userId: 1, relatedUserId: 1 }, { unique: true });

module.exports =
  mongoose.models.SocialGraph || mongoose.model('SocialGraph', socialGraphSchema);
