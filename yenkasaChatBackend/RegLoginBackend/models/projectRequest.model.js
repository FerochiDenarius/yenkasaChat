const mongoose = require('mongoose');

const PROJECT_REQUEST_STATUSES = [
  'New',
  'In Review',
  'Proposal Sent',
  'Approved',
  'In Progress',
  'Rejected',
  'Completed',
];

const PROJECT_REQUEST_TYPES = [
  'Website',
  'Mobile App',
  'AI Solution',
  'Software Development',
  'UI/UX Design',
];

const fileSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    provider: { type: String, default: '' },
    bucket: { type: String, default: '' },
    key: { type: String, default: '' },
    url: { type: String, required: true },
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: PROJECT_REQUEST_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const projectRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, unique: true, index: true, required: true },
    requestCategory: { type: String, enum: PROJECT_REQUEST_TYPES, default: 'Website', index: true },
    status: { type: String, enum: PROJECT_REQUEST_STATUSES, default: 'New', index: true },

    contact: {
      fullName: { type: String, required: true, trim: true },
      companyName: { type: String, trim: true, default: '' },
      phoneNumber: { type: String, required: true, trim: true },
      whatsappNumber: { type: String, trim: true, default: '' },
      email: { type: String, required: true, lowercase: true, trim: true },
      businessLocation: { type: String, trim: true, default: '' },
      preferredContactMethod: { type: String, trim: true, default: '' },
      bestTimeToContact: { type: String, trim: true, default: '' },
    },

    business: {
      description: { type: String, required: true, trim: true },
      industryType: { type: String, trim: true, default: '' },
      targetAudience: { type: String, trim: true, default: '' },
    },

    requirements: {
      websiteType: { type: String, required: true, trim: true },
      projectType: { type: String, trim: true, default: '' },
      pagesRequired: [{ type: String, trim: true }],
      featuresRequired: [{ type: String, trim: true }],
      platformsRequired: [{ type: String, trim: true }],
    },

    branding: {
      preferredColors: { type: String, trim: true, default: '' },
      referenceWebsites: { type: String, trim: true, default: '' },
    },

    project: {
      budgetRange: { type: String, trim: true, default: '' },
      desiredCompletionDate: { type: Date, default: null },
      additionalNotes: { type: String, trim: true, default: '' },
    },

    files: [fileSchema],
    statusHistory: [statusHistorySchema],
    source: {
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      referrer: { type: String, default: '' },
    },
    emailNotifications: {
      companyNotifiedAt: { type: Date, default: null },
      clientConfirmedAt: { type: Date, default: null },
      lastError: { type: String, default: '' },
    },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

projectRequestSchema.index({ status: 1, submittedAt: -1 });
projectRequestSchema.index({ requestCategory: 1, submittedAt: -1 });
projectRequestSchema.index({ 'requirements.websiteType': 1, submittedAt: -1 });
projectRequestSchema.index({
  requestId: 'text',
  'contact.fullName': 'text',
  'contact.companyName': 'text',
  'contact.email': 'text',
  'contact.phoneNumber': 'text',
  'contact.whatsappNumber': 'text',
  'requirements.websiteType': 'text',
  'requirements.projectType': 'text',
});

module.exports = mongoose.model('ProjectRequest', projectRequestSchema);
module.exports.PROJECT_REQUEST_STATUSES = PROJECT_REQUEST_STATUSES;
module.exports.PROJECT_REQUEST_TYPES = PROJECT_REQUEST_TYPES;
