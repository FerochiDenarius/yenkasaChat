const mongoose = require('mongoose');

const liveDuelSchema = new mongoose.Schema(
  {
    duelId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    metricType: {
      type: String,
      enum: ['comment', 'view', 'like'],
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      default: null,
      index: true,
    },
    endTime: {
      type: Date,
      default: null,
      index: true,
    },
    userAScore: {
      type: Number,
      default: 0,
    },
    userBScore: {
      type: Number,
      default: 0,
    },
    userAStartMetric: {
      type: Number,
      default: 0,
    },
    userBStartMetric: {
      type: Number,
      default: 0,
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'declined'],
      default: 'pending',
      index: true,
    },
    rewardGranted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

liveDuelSchema.index({ userA: 1, status: 1, createdAt: -1 });
liveDuelSchema.index({ userB: 1, status: 1, createdAt: -1 });
liveDuelSchema.index({ userA: 1, userB: 1, createdAt: -1 });

module.exports =
  mongoose.models.LiveDuel ||
  mongoose.model('LiveDuel', liveDuelSchema);
