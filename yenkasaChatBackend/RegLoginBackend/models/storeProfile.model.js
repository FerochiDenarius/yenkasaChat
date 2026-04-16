const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storeProfileSchema = new Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
      index: true
    },
    storeName: {
      type: String,
      default: 'Yenkasa Store',
      trim: true
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true
    },
    announcementTitle: {
      type: String,
      default: '',
      trim: true
    },
    announcementText: {
      type: String,
      default: '',
      trim: true
    },
    announcementEnabled: {
      type: Boolean,
      default: false
    },
    updatedBy: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StoreProfile', storeProfileSchema);
