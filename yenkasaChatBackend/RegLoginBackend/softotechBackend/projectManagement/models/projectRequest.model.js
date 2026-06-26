const mongoose = require('mongoose');

const PROJECT_REQUEST_STATUSES = [
  'Submitted',
  'Under Review',
  'Quotation Pending',
  'Quotation Sent',
  'Approved',
  'Rejected',
  'Converted To Project',
  'In Progress',
  'Completed',
];

const PROJECT_REQUEST_TYPES = [
  'Website Development',
  'Mobile App Development',
  'Desktop Application',
  'AI Solution',
  'E-Commerce Platform',
  'School Management System',
  'Hospital Management System',
  'Inventory System',
  'ERP System',
  'Social Media Platform',
  'Livestream Platform',
  'Fintech Solution',
  'Custom Software',
  'Other',
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
    requestCategory: { type: String, enum: PROJECT_REQUEST_TYPES, default: 'Website Development', index: true },
    status: { type: String, enum: PROJECT_REQUEST_STATUSES, default: 'Submitted', index: true },

    contact: {
      fullName: { type: String, required: true, trim: true },
      companyName: { type: String, trim: true, default: '' },
      businessRegistrationNumber: { type: String, trim: true, default: '' },
      phoneNumber: { type: String, required: true, trim: true },
      whatsappNumber: { type: String, trim: true, default: '' },
      email: { type: String, required: true, lowercase: true, trim: true },
      country: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      businessAddress: { type: String, trim: true, default: '' },
      website: { type: String, trim: true, default: '' },
      businessLocation: { type: String, trim: true, default: '' },
      preferredContactMethod: { type: String, trim: true, default: '' },
      bestTimeToContact: { type: String, trim: true, default: '' },
    },

    business: {
      description: { type: String, required: true, trim: true },
      industryType: { type: String, trim: true, default: '' },
      targetAudience: { type: String, trim: true, default: '' },
    },

    overview: {
      projectName: { type: String, trim: true, default: '' },
      projectCategory: { type: String, trim: true, default: '' },
      projectDescription: { type: String, trim: true, default: '' },
    },

    objectives: {
      problemToSolve: { type: String, trim: true, default: '' },
      businessGoals: { type: String, trim: true, default: '' },
      targetUsers: { type: String, trim: true, default: '' },
      expectedUsers: { type: Number, default: 0 },
      expectedMonthlyTraffic: { type: Number, default: 0 },
    },

    requirements: {
      websiteType: { type: String, required: true, trim: true },
      projectType: { type: String, trim: true, default: '' },
      pagesRequired: [{ type: String, trim: true }],
      featuresRequired: [{ type: String, trim: true }],
      platformsRequired: [{ type: String, trim: true }],
      customFeatures: { type: String, trim: true, default: '' },
    },

    branding: {
      hasLogo: { type: String, trim: true, default: '' },
      hasBrandColors: { type: String, trim: true, default: '' },
      hasUiDesigns: { type: String, trim: true, default: '' },
      needsUiUx: { type: String, trim: true, default: '' },
      preferredColors: { type: String, trim: true, default: '' },
      referenceWebsites: { type: String, trim: true, default: '' },
    },

    integrations: [{ type: String, trim: true }],

    infrastructure: {
      ownsDomain: { type: String, trim: true, default: '' },
      needsDomainRegistration: { type: String, trim: true, default: '' },
      needsHosting: { type: String, trim: true, default: '' },
      needsEmailSetup: { type: String, trim: true, default: '' },
      needsCloudDeployment: { type: String, trim: true, default: '' },
      hostingOptions: [{ type: String, trim: true }],
    },

    timeline: {
      desiredStartDate: { type: Date, default: null },
      desiredCompletionDate: { type: Date, default: null },
      timelineFlexible: { type: String, trim: true, default: '' },
      priority: { type: String, trim: true, default: '' },
    },

    project: {
      budgetCurrency: { type: String, trim: true, uppercase: true, default: 'GHS' },
      budgetRange: { type: String, trim: true, default: '' },
      minimumBudget: { type: Number, default: 0 },
      maximumBudget: { type: Number, default: 0 },
      desiredCompletionDate: { type: Date, default: null },
      additionalNotes: { type: String, trim: true, default: '' },
    },

    maintenance: {
      plan: { type: String, trim: true, default: '' },
      supportServices: [{ type: String, trim: true }],
    },

    review: { type: mongoose.Schema.Types.Mixed, default: {} },

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
