console.log('✅ yenkasa-store-server loaded');

const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const upload = multer();
const API_BASE = process.env.TRICIABALES_API_BASE || 'http://134.209.182.39:8080';

function maskEmail(email) {
  const raw = String(email || '').trim();
  const [name, domain] = raw.split('@');

  if (!name || !domain) {
    return raw || '-';
  }

  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

function getAuthorizationHeader(req) {
  return req.headers.authorization || req.get?.('Authorization') || '';
}

function forwardHeaders(req, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const authorization = getAuthorizationHeader(req);

  if (authorization) {
    headers.Authorization = authorization;
  }

  return headers;
}

function appendOptionalProductFields(form, body) {
  [
    'categoryType',
    'brand',
    'color',
    'material',
    'condition',
    'length',
    'model',
    'year',
    'metadataJson'
  ].forEach(field => {
    if (body?.[field] !== undefined && body[field] !== null && String(body[field]).trim() !== '') {
      form.append(field, body[field]);
    }
  });
}

module.exports = function (app) {

  // USER REGISTER
  app.post(
    '/triciabales-api/api/users/register',
    upload.single('idImage'),
    async (req, res) => {
      const email = req.body?.email;
      console.log(`[Yenkasa Store] Register request received for ${maskEmail(email)}`);

      try {
        const form = new FormData();

        [
          'name',
          'email',
          'phone',
          'address',
          'role',
          'referralCode',
          'password',
          'dateOfBirth',
          'dob',
          'idType',
          'idNumber',
          'shopName',
          'shopAddress',
          'shopLocation',
          'proofOfOperation'
        ].forEach(field => {
          if (req.body?.[field] !== undefined && req.body[field] !== null) {
            form.append(field, req.body[field]);
          }
        });

        if (req.file) {
          form.append('idImage', req.file.buffer, req.file.originalname);
        }

        const response = await axios.post(
          `${API_BASE}/api/users/register`,
          form,
          {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          }
        );

        console.log(
          `[Yenkasa Store] Register success for ${maskEmail(email)} status=${response.status} actionUrl=${response.data?.actionUrl ? 'yes' : 'no'}`
        );
        res.json(response.data);

      } catch (err) {
        console.error(
          `[Yenkasa Store] REGISTER ERROR for ${maskEmail(email)}:`,
          err.response?.status,
          err.response?.data || err.message
        );

        res.status(err.response?.status || 500).json(
          err.response?.data || { error: err.message }
        );
      }
    }
  );

  // USER LOGIN
  app.post('/triciabales-api/api/users/login', async (req, res) => {
    const email = req.body?.email;
    console.log(`[Yenkasa Store] Login request received for ${maskEmail(email)}`);

    try {
      const response = await axios.post(
        `${API_BASE}/api/users/login`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[Yenkasa Store] Login success for ${maskEmail(email)} role=${response.data?.user?.role || '-'}`);
      res.json(response.data);

    } catch (err) {
      console.error(
        `[Yenkasa Store] USER LOGIN ERROR for ${maskEmail(email)}:`,
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.get('/triciabales-api/api/users/verify-email', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/users/verify-email`,
        {
          params: {
            token: req.query.token
          }
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'VERIFY EMAIL ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/users/password-reset/request', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/users/password-reset/request`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'PASSWORD RESET REQUEST ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/users/resend-verification', async (req, res) => {
    const email = req.body?.email;
    console.log(`[Yenkasa Store] Resend verification request received for ${maskEmail(email)}`);

    try {
      const response = await axios.post(
        `${API_BASE}/api/users/resend-verification`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(
        `[Yenkasa Store] Resend verification completed for ${maskEmail(email)} status=${response.status} actionUrl=${response.data?.actionUrl ? 'yes' : 'no'}`
      );
      res.json(response.data);
    } catch (err) {
      console.error(
        `[Yenkasa Store] RESEND VERIFICATION ERROR for ${maskEmail(email)}:`,
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/users/password-reset/confirm', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/users/password-reset/confirm`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'PASSWORD RESET CONFIRM ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/users/logout', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/users/logout`,
        {},
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'USER LOGOUT ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.get('/triciabales-api/api/users/me', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/users/me`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'USER PROFILE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.put(
    '/triciabales-api/api/users/me',
    upload.single('profileImage'),
    async (req, res) => {
      try {
        const authorization = getAuthorizationHeader(req);

        if (!authorization) {
          return res.status(401).json({
            error: 'Authentication token is missing'
          });
        }

        const form = new FormData();

        ['name', 'email', 'phone', 'address', 'password'].forEach(field => {
          if (req.body[field] != null) {
            form.append(field, req.body[field]);
          }
        });

        if (req.file) {
          form.append('profileImage', req.file.buffer, req.file.originalname);
        }

        const response = await axios.put(
          `${API_BASE}/api/users/me`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: authorization
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          }
        );

        res.json(response.data);
      } catch (err) {
        console.error(
          'USER PROFILE UPDATE ERROR:',
          err.response?.status,
          err.response?.data || err.message
        );

        res.status(err.response?.status || 500).json(
          err.response?.data || { error: err.message }
        );
      }
    }
  );

  app.get('/triciabales-api/api/users', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/users`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'USERS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.get('/triciabales-api/api/users/sellers', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/users/sellers`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'SELLERS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.put('/triciabales-api/api/users/:id/status', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/users/${req.params.id}/status`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'USER STATUS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.delete('/triciabales-api/api/users/:id', async (req, res) => {
    try {
      const response = await axios.delete(
        `${API_BASE}/api/users/${req.params.id}`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.status(response.status).json(response.data);
    } catch (err) {
      console.error(
        'USER DELETE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // SELLER PAYOUT DETAILS
  app.put('/triciabales-api/api/seller/payout-details', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/seller/payout-details`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'PAYOUT DETAILS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // LOGIN
  app.post('/triciabales-api/api/auth/login', async (req, res) => {
    try {
      console.log('LOGIN BODY:', req.body);

      const response = await axios.post(
        `${API_BASE}/api/auth/login`,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'LOGIN ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // GET BALES
  app.get('/triciabales-api/api/triciabales', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/triciabales`
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'BALES ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // UPLOAD BALE
  app.post(
    '/triciabales-api/api/triciabales/upload',
    upload.fields([
      { name: 'image', maxCount: 20 },
      { name: 'video', maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const authorization = getAuthorizationHeader(req);

        if (!authorization) {
          return res.status(401).json({
            error: 'Authentication token is missing'
          });
        }

        const form = new FormData();

        form.append('name', req.body.name);
        form.append('price', req.body.price);
        form.append('weight', req.body.weight);
        form.append('category', req.body.category);
        form.append('description', req.body.description);
        form.append('status', req.body.status);
        form.append('type', req.body.type || 'bale');
        appendOptionalProductFields(form, req.body);
        if (req.body.sellerId) {
          form.append('sellerId', req.body.sellerId);
        }
        if (req.body.sellerName) {
          form.append('sellerName', req.body.sellerName);
        }

        (req.files?.image || []).forEach(file => {
          form.append('image', file.buffer, file.originalname);
        });

        if (req.files?.video?.[0]) {
          form.append(
            'video',
            req.files.video[0].buffer,
            req.files.video[0].originalname
          );
        }

        const response = await axios.post(
          `${API_BASE}/api/triciabales/upload`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: authorization
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          }
        );

        res.json(response.data);

      } catch (err) {
        console.error(
          'UPLOAD ERROR:',
          err.response?.status,
          err.response?.data || err.message
        );

        res.status(err.response?.status || 500).json(
          err.response?.data || { error: err.message }
        );
      }
    }
  );

  app.post(
    '/triciabales-api/api/triciabales/upload/video-only',
    upload.fields([
      { name: 'video', maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const authorization = getAuthorizationHeader(req);

        if (!authorization) {
          return res.status(401).json({
            error: 'Authentication token is missing'
          });
        }

        const form = new FormData();

        form.append('name', req.body.name);
        form.append('price', req.body.price);
        form.append('weight', req.body.weight);
        form.append('category', req.body.category);
        form.append('description', req.body.description);
        form.append('status', req.body.status);
        form.append('type', req.body.type || 'product_video');
        appendOptionalProductFields(form, req.body);
        if (req.body.sellerId) {
          form.append('sellerId', req.body.sellerId);
        }
        if (req.body.sellerName) {
          form.append('sellerName', req.body.sellerName);
        }

        if (req.files?.video?.[0]) {
          form.append(
            'video',
            req.files.video[0].buffer,
            req.files.video[0].originalname
          );
        }

        const response = await axios.post(
          `${API_BASE}/api/triciabales/upload/video-only`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: authorization
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          }
        );

        res.json(response.data);

      } catch (err) {
        console.error(
          'VIDEO UPLOAD ERROR:',
          err.response?.status,
          err.response?.data || err.message
        );

        res.status(err.response?.status || 500).json(
          err.response?.data || { error: err.message }
        );
      }
    }
  );

  // CHANGE STATUS
  app.put('/triciabales-api/api/triciabales/:id/status', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/triciabales/${req.params.id}/status`,
        {},
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'STATUS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.put('/triciabales-api/api/triciabales/:id', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/triciabales/${req.params.id}`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'UPDATE BALE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.put(
    '/triciabales-api/api/triciabales/:id/media',
    upload.fields([
      { name: 'image', maxCount: 20 }
    ]),
    async (req, res) => {
      try {
        const authorization = getAuthorizationHeader(req);

        if (!authorization) {
          return res.status(401).json({
            error: 'Authentication token is missing'
          });
        }

        const form = new FormData();

        const retainedImageUrls = Array.isArray(req.body.retainedImageUrls)
          ? req.body.retainedImageUrls
          : req.body.retainedImageUrls
            ? [req.body.retainedImageUrls]
            : [];

        retainedImageUrls.forEach(url => {
          if (url) {
            form.append('retainedImageUrls', url);
          }
        });

        (req.files?.image || []).forEach(file => {
          form.append('image', file.buffer, file.originalname);
        });

        const response = await axios.put(
          `${API_BASE}/api/triciabales/${req.params.id}/media`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: authorization
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          }
        );

        res.json(response.data);

      } catch (err) {
        console.error(
          'UPDATE BALE MEDIA ERROR:',
          err.response?.status,
          err.response?.data || err.message
        );

        res.status(err.response?.status || 500).json(
          err.response?.data || { error: err.message }
        );
      }
    }
  );

  // DELETE BALE
  app.delete('/triciabales-api/api/triciabales/:id', async (req, res) => {
    try {
      const response = await axios.delete(
        `${API_BASE}/api/triciabales/${req.params.id}`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.status(response.status).json(response.data);

    } catch (err) {
      console.error(
        'DELETE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // CHECKOUT
  app.post('/triciabales-api/api/orders/checkout', async (req, res) => {
    try {
      console.log('CHECKOUT BODY:', req.body);

      const response = await axios.post(
        `${API_BASE}/api/orders/checkout`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'CHECKOUT ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // ALL ORDERS
  app.get('/triciabales-api/api/orders', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/orders`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'ORDERS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // PAYSTACK INITIALIZE
  app.post('/triciabales-api/api/paystack/initialize', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/paystack/initialize`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'PAYSTACK INIT ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // PAYSTACK VERIFY
  app.get('/triciabales-api/api/paystack/verify', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/paystack/verify`,
        {
          params: {
            reference: req.query.reference
          },
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'PAYSTACK VERIFY ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // PAYSTACK WEBHOOK
  app.post('/triciabales-api/api/paystack/webhook', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/paystack/webhook`,
        req.rawBody || JSON.stringify(req.body || {}),
        {
          headers: {
            'Content-Type': 'application/json',
            'x-paystack-signature': req.get('x-paystack-signature') || ''
          },
          transformRequest: [(data) => {
            if (typeof data === 'string') return data;
            return JSON.stringify(data);
          }]
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'PAYSTACK WEBHOOK ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // NOTIFICATIONS
  app.get('/triciabales-api/api/notifications/me', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/notifications/me`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'NOTIFICATIONS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.put('/triciabales-api/api/notifications/:id/read', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/notifications/${req.params.id}/read`,
        {},
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'NOTIFICATION READ ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.delete('/triciabales-api/api/notifications/:id', async (req, res) => {
    try {
      const response = await axios.delete(
        `${API_BASE}/api/notifications/${req.params.id}`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.status(response.status).json(response.data);
    } catch (err) {
      console.error(
        'NOTIFICATION DELETE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // UBER DIRECT DELIVERY CONFIG
  app.get('/triciabales-api/api/deliveries/uber/config', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/deliveries/uber/config`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'UBER CONFIG ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/deliveries/uber/orders/:orderId/quote', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/deliveries/uber/orders/${req.params.orderId}/quote`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'UBER QUOTE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/deliveries/uber/orders/:orderId/create', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/deliveries/uber/orders/${req.params.orderId}/create`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'UBER CREATE DELIVERY ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.get('/triciabales-api/api/deliveries/uber/orders/:orderId/status', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/deliveries/uber/orders/${req.params.orderId}/status`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'UBER DELIVERY STATUS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/deliveries/uber/webhook', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/deliveries/uber/webhook`,
        req.rawBody || JSON.stringify(req.body || {}),
        {
          headers: {
            'Content-Type': 'application/json',
            'x-uber-signature': req.get('x-uber-signature') || ''
          },
          transformRequest: [(data) => {
            if (typeof data === 'string') return data;
            return JSON.stringify(data);
          }]
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'UBER WEBHOOK ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // USER ORDER HISTORY
  app.get('/triciabales-api/api/orders/user/:userId', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/orders/user/${req.params.userId}`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'USER ORDERS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // SELLER ORDER HISTORY
  app.get('/triciabales-api/api/orders/seller/:sellerId', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/orders/seller/${req.params.sellerId}`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'SELLER ORDERS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // ORDER STATUS UPDATE
  app.put('/triciabales-api/api/orders/:id/status', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/orders/${req.params.id}/status`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'ORDER STATUS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // DELETE UNPAID ORDER
  app.delete('/triciabales-api/api/orders/:id', async (req, res) => {
    try {
      const response = await axios.delete(
        `${API_BASE}/api/orders/${req.params.id}`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.status(response.status).json(response.data);
    } catch (err) {
      console.error(
        'ORDER DELETE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // BUYER ORDER CONFIRMATION
  app.put('/triciabales-api/api/orders/:id/confirm-received', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/orders/${req.params.id}/confirm-received`,
        {},
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'ORDER CONFIRM ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.get('/triciabales-api/api/triciabales/seller/:sellerId', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/triciabales/seller/${req.params.sellerId}`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'SELLER BALES ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });
};
