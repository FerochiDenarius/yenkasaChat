const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, text) => {
  const msg = {
    to,
    from: 'no-reply@yenkasa.xyz', // must match verified domain
    subject,
    text,
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent to', to);
  } catch (error) {
    console.error('SendGrid Error:', error.response?.body || error.message);
  }
};

module.exports = sendEmail;
