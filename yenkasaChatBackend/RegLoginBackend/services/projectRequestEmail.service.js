const nodemailer = require('nodemailer');

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function createTransporter() {
  if (!hasSmtpConfig()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function notifyAddress() {
  return process.env.WEBSITE_REQUEST_NOTIFY_EMAIL ||
    process.env.SOFTOTECH_EMAIL ||
    process.env.COMPANY_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER;
}

function fromAddress() {
  return process.env.EMAIL_FROM || `"Yenkasa Soft-O-Tech" <${process.env.EMAIL_USER}>`;
}

function formatDate(value) {
  if (!value) return 'Not provided';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return date.toISOString().slice(0, 10);
}

function requestSummary(request) {
  return [
    `Request ID: ${request.requestId}`,
    `Status: ${request.status}`,
    `Category: ${request.requestCategory || 'Website'}`,
    `Client: ${request.contact.fullName}`,
    `Company: ${request.contact.companyName || 'Not provided'}`,
    `Email: ${request.contact.email}`,
    `Phone: ${request.contact.phoneNumber}`,
    `Location: ${request.contact.businessLocation || 'Not provided'}`,
    `Project Type: ${request.requirements.projectType || request.requirements.websiteType}`,
    `Budget: ${request.project.budgetRange || 'Not provided'}`,
    `Desired Completion: ${formatDate(request.project.desiredCompletionDate)}`,
    `Pages/Screens: ${(request.requirements.pagesRequired || []).join(', ') || 'Not provided'}`,
    `Platforms: ${(request.requirements.platformsRequired || []).join(', ') || 'Not provided'}`,
    `Features: ${(request.requirements.featuresRequired || []).join(', ') || 'Not provided'}`,
  ].join('\n');
}

async function sendProjectRequestEmails(request, options = {}) {
  const transporter = createTransporter();
  if (!transporter) {
    return { companySent: false, clientSent: false, error: 'SMTP is not configured.' };
  }

  const companyTo = notifyAddress();
  const summary = requestSummary(request);
  const results = { companySent: false, clientSent: false, error: '' };
  const emailNotifications = { ...(request.emailNotifications || {}) };
  const persist = async () => {
    if (typeof options.onUpdate === 'function') {
      await options.onUpdate(emailNotifications).catch(() => {});
    } else if (typeof request.save === 'function') {
      request.emailNotifications = emailNotifications;
      await request.save().catch(() => {});
    }
  };

  try {
    if (companyTo) {
      await transporter.sendMail({
        from: fromAddress(),
        to: companyTo,
        replyTo: request.contact.email,
        subject: `New Yenkasa Soft-O-Tech Project Request ${request.requestId}`,
        text: `A new project request was submitted.\n\n${summary}`,
      });
      emailNotifications.companyNotifiedAt = new Date();
      results.companySent = true;
    }

    await transporter.sendMail({
      from: fromAddress(),
      to: request.contact.email,
      subject: `We received your project request ${request.requestId}`,
      text: [
        `Hello ${request.contact.fullName},`,
        '',
        'Thank you for contacting Yenkasa Soft-O-Tech. We received your project request.',
        '',
        `Your Request ID is ${request.requestId}.`,
        '',
        'Our team will review your requirements and contact you with the next steps.',
        '',
        'Yenkasa Soft-O-Tech',
      ].join('\n'),
    });
    emailNotifications.clientConfirmedAt = new Date();
    results.clientSent = true;

    await persist();
  } catch (error) {
    emailNotifications.lastError = error.message;
    await persist();
    results.error = error.message;
  }

  return results;
}

module.exports = {
  sendProjectRequestEmails,
};
