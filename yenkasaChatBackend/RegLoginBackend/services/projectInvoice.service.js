const mediaStorage = require('./mediaStorage.service');

function money(value, currency = 'GHS') {
  return `${currency} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function text(value) {
  return String(value || '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/[()\\]/g, '\\$&');
}

function wrap(value, length = 86) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > length) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function pdfEscapeStream(lines) {
  let y = 660;
  const chunks = [
    '0.02 0.16 0.13 rg 0 704 612 88 re f',
    '0.94 0.98 0.96 rg 50 722 52 52 re f',
    '0.02 0.16 0.13 rg 55 727 42 42 re f',
    'BT 1 1 1 rg /F1 13 Tf 1 0 0 1 62 745 Tm (YSO) Tj ET',
    'BT 1 1 1 rg /F1 20 Tf 1 0 0 1 116 754 Tm (YENKASA SOFT-O-TECH) Tj ET',
    'BT 0.86 0.94 0.9 rg /F1 10 Tf 1 0 0 1 116 735 Tm (Professional software project invoice and request estimate) Tj ET',
    '0.88 0.92 0.9 rg 50 690 512 1 re f',
  ];
  for (const entry of lines) {
    const font = entry.font || 10;
    const leading = entry.leading || 14;
    if (entry.pageBreak) {
      continue;
    }
    const isHeading = font >= 13;
    chunks.push(`BT ${isHeading ? '0.02 0.16 0.13' : '0.05 0.07 0.09'} rg /F1 ${font} Tf 1 0 0 1 50 ${y} Tm (${text(entry.text)}) Tj ET`);
    if (isHeading) chunks.push(`0.88 0.92 0.9 rg 50 ${y - 5} 512 0.8 re f`);
    y -= leading;
    if (y < 50) break;
  }
  chunks.push('0.88 0.92 0.9 rg 50 42 512 1 re f');
  chunks.push('BT 0.35 0.4 0.38 rg /F1 8 Tf 1 0 0 1 50 28 Tm (Yenkasa Soft-O-Tech | www.yenkasa.xyz | Thank you for choosing us.) Tj ET');
  return chunks.join('\n');
}

function buildInvoiceLines(request, estimate) {
  const contact = request.contact || {};
  const project = request.project || {};
  const req = request.requirements || {};
  const business = request.business || {};
  const invoiceNumber = `INV-${request.requestId}`;
  const date = new Date();
  const dueDate = new Date(date.getTime() + 14 * 24 * 60 * 60 * 1000);
  const lines = [
    { text: 'YENKASA APP DEVELOPMENT INVOICE', font: 18, leading: 24 },
    { text: 'Yenkasa Soft-O-Tech - Building Digital Solutions For Businesses & Brands', font: 10, leading: 20 },
    { text: 'INVOICE DETAILS', font: 13, leading: 18 },
    { text: `Invoice Number: ${invoiceNumber}` },
    { text: `Invoice Date: ${date.toISOString().slice(0, 10)}` },
    { text: `Due Date: ${dueDate.toISOString().slice(0, 10)}` },
    { text: `Currency: ${estimate.currency || 'GHS'}`, leading: 20 },
    { text: 'CLIENT INFORMATION', font: 13, leading: 18 },
    { text: `Client Name: ${contact.fullName || ''}` },
    { text: `Company Name: ${contact.companyName || ''}` },
    { text: `Phone Number: ${contact.phoneNumber || ''}` },
    { text: `Email Address: ${contact.email || ''}` },
    { text: `Address: ${contact.businessLocation || ''}`, leading: 20 },
    { text: 'PROJECT INFORMATION', font: 13, leading: 18 },
    { text: `Project Title: ${req.projectType || req.websiteType || request.requestCategory || 'Project'}` },
    ...wrap(`Project Description: ${business.description || project.additionalNotes || ''}`, 82).map((line) => ({ text: line })),
    { text: 'APPLICATION DEVELOPMENT COST BREAKDOWN', font: 13, leading: 18 },
    { text: 'Description | Billing Type | Qty | Unit Price | Total' },
    ...((estimate.lineItems || []).length ? estimate.lineItems : [{ description: 'Project pricing pending admin review', billingType: 'One-Time', quantity: 1, unitPrice: 0, total: 0 }]).flatMap((item) => wrap(`${item.description} | ${item.billingType} | ${item.quantity} | ${money(item.unitPrice, estimate.currency)} | ${money(item.total, estimate.currency)}`, 92).map((line) => ({ text: line }))),
    { text: 'TOTALS', font: 13, leading: 18 },
    { text: `Subtotal: ${money(estimate.subtotal, estimate.currency)}` },
    { text: `Discount: ${money(estimate.discount, estimate.currency)}` },
    { text: `Tax / VAT: ${money(estimate.tax, estimate.currency)}` },
    { text: `Grand Total: ${money(estimate.grandTotal, estimate.currency)}`, font: 12, leading: 20 },
    { text: 'PAYMENT TERMS', font: 13, leading: 18 },
    { text: 'Payment terms will be confirmed after proposal approval.' },
    { text: 'PAYMENT METHODS', font: 13, leading: 18 },
    { text: 'Mobile Money: __________________' },
    { text: 'Bank Transfer: __________________' },
    { text: 'Paystack: __________________' },
    { text: 'Cash Payment: __________________', leading: 20 },
    { text: 'NOTES / TERMS & CONDITIONS', font: 13, leading: 18 },
    { text: 'Third-party services may require separate subscription payments.' },
    { text: 'Hosting and maintenance services are renewable based on agreed plan.' },
    { text: 'Source code ownership transfers upon full payment completion.' },
    { text: 'Additional features requested after project approval may attract extra charges.' },
    { text: 'Delayed payments may affect deployment and maintenance services.', leading: 20 },
    { text: 'SIGNATURES', font: 13, leading: 18 },
    { text: 'Developer Signature: __________________      Client Signature: __________________' },
    { text: 'Thank You For Choosing Yenkasa Soft-O-Tech', font: 12 },
  ];
  return lines;
}

function buildPdfBuffer(lines) {
  const stream = pdfEscapeStream(lines);
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}

async function generateAndUploadInvoice(request, estimate) {
  const buffer = buildPdfBuffer(buildInvoiceLines(request, estimate));
  const file = {
    buffer,
    originalname: `${request.requestId}-invoice.pdf`,
    mimetype: 'application/pdf',
    size: buffer.length,
  };
  const result = await mediaStorage.upload(file, {
    folder: 'project-invoices',
    prefix: request.requestId,
    type: 'file',
    area: 'softotech-project-invoice',
  });
  return {
    invoiceNumber: `INV-${request.requestId}`,
    url: result.secure_url || result.url,
    provider: result.provider || '',
    bucket: result.bucket || '',
    key: result.key || result.public_id || '',
    amount: estimate.grandTotal,
    currency: estimate.currency || 'GHS',
    generatedAt: new Date(),
  };
}

module.exports = {
  buildPdfBuffer,
  generateAndUploadInvoice,
  money,
};
