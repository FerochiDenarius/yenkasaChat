const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storeRefundSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    amount: {
      type: Number,
      default: 0
    },
    reason: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED'],
      default: 'REQUESTED',
      index: true
    },
    requestedBy: {
      type: String,
      default: '',
      trim: true
    },
    reviewedBy: {
      type: String,
      default: '',
      trim: true
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    processedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StoreRefund', storeRefundSchema);
