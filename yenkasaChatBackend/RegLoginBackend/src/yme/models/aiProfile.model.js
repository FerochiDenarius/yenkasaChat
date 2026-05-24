const mongoose = require('mongoose');

const aiProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    preferredTones: { type: [String], default: [] },
    responseStyles: { type: [String], default: [] },
    preferredLanguages: { type: [String], default: [] },
    topicPreferences: { type: [String], default: [] },
    behavioralTraits: { type: mongoose.Schema.Types.Mixed, default: {} },
    safetyFlags: { type: [String], default: [] },
    memoryPolicy: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'ai_profiles' },
);

module.exports =
  mongoose.models.AIProfile || mongoose.model('AIProfile', aiProfileSchema);
