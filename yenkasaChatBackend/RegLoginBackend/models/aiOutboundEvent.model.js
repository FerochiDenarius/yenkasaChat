const mongoose = require('mongoose');

const aiOutboundEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'retrying', 'delivered'],
      default: 'pending',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastAttemptAt: Date,
    lastDeliveredAt: Date,
    lastErrorMessage: String,
    lastErrorStatus: Number,
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'ai_outbound_events',
  },
);

aiOutboundEventSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports =
  mongoose.models.AIOutboundEvent ||
  mongoose.model('AIOutboundEvent', aiOutboundEventSchema);
