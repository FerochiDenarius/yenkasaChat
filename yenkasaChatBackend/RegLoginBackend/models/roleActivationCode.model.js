const mongoose = require('mongoose');
const { Schema } = mongoose;

const roleActivationCodeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    roleKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    roleCategory: {
      type: String,
      enum: ['staff', 'public'],
      required: true,
      index: true
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    usedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

roleActivationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });

module.exports = mongoose.model('RoleActivationCode', roleActivationCodeSchema);
