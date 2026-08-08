console.log('✅ yenkasa-store-server loaded');

const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const StoreProfile = require('../models/storeProfile.model');
const { logUploadAudit } = require('../utils/cloudinaryMedia');
const mediaStorage = require('../services/mediaStorage.service');

const upload = multer();
const API_BASE = process.env.TRICIABALES_API_BASE || 'http://134.209.182.39:8080';
const STORE_API_TIMEOUT_MS = Number(process.env.TRICIABALES_API_TIMEOUT_MS || 10000);
const STORE_PROFILE_DEFAULTS = {
  key: 'default',
  storeName: 'Yenkasa Store',
  logoUrl: '/store/assets/images/YenkasaStoreLogo.png',
  announcementTitle: '',
  announcementText: '',
  announcementEnabled: false
};

function normalizeStoreLogoUrl(logoUrl = '') {
  const value = String(logoUrl || '').trim();

  if (!value) {
    return STORE_PROFILE_DEFAULTS.logoUrl;
  }

  if (value.includes('storage.googleapis.com/yenkasa-media/')) {
    return STORE_PROFILE_DEFAULTS.logoUrl;
  }

  return value;
}

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

function clientForwardHeaders(req, extraHeaders = {}) {
  const headers = forwardHeaders(req, extraHeaders);
  const existingForwardedFor = req.headers['x-forwarded-for'];
  const clientIp = Array.isArray(existingForwardedFor)
    ? existingForwardedFor[0]
    : existingForwardedFor || req.ip || req.socket?.remoteAddress || '';

  if (clientIp) {
    headers['X-Forwarded-For'] = clientIp;
  }

  if (req.headers['user-agent']) {
    headers['User-Agent'] = req.headers['user-agent'];
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

function serializeStoreProfile(profile) {
  const source = profile || STORE_PROFILE_DEFAULTS;

  return {
    storeName: source.storeName || STORE_PROFILE_DEFAULTS.storeName,
    logoUrl: normalizeStoreLogoUrl(source.logoUrl),
    announcementTitle: source.announcementTitle || '',
    announcementText: source.announcementText || '',
    announcementEnabled: Boolean(source.announcementEnabled),
    updatedAt: source.updatedAt || null
  };
}

function getRoleName(user) {
  const rawRole = user?.role?.role || user?.roleName || user?.role;
  return String(rawRole || '').toUpperCase();
}

async function assertSuperAdmin(req) {
  const authorization = getAuthorizationHeader(req);

  if (!authorization) {
    const err = new Error('Authentication token is missing');
    err.status = 401;
    throw err;
  }

  const response = await axios.get(`${API_BASE}/api/users/me`, {
    headers: {
      Authorization: authorization
    }
  });

  const user = response.data?.user || response.data;

  if (getRoleName(user) !== 'SUPER_ADMIN') {
    const err = new Error('Super admin access is required');
    err.status = 403;
    throw err;
  }

  return user;
}

async function saveStoreLogo(file) {
  if (!file) {
    return '';
  }

  const result = await mediaStorage.uploadToCloudinary(file, {
    folder: 'store',
    type: 'image',
    area: 'store_logo',
    prefix: 'logo',
    cloudinary: {
      overwrite: true,
      quality: 'auto:good',
      fetch_format: 'auto'
    }
  });
  logUploadAudit({ area: 'store_logo', file, result });

  return result.secure_url;
}

module.exports = function (app) {

  app.get('/triciabales-api/api/store-profile', async (req, res) => {
    try {
      const profile = await StoreProfile.findOne({ key: 'default' }).lean();
      res.json(serializeStoreProfile(profile));
    } catch (err) {
      console.error('STORE PROFILE LOAD ERROR:', err.message);
      res.json(serializeStoreProfile(null));
    }
  });

  app.put(
    '/triciabales-api/api/store-profile',
    upload.single('logo'),
    async (req, res) => {
      try {
        const user = await assertSuperAdmin(req);
        const update = {
          storeName: String(req.body?.storeName || STORE_PROFILE_DEFAULTS.storeName).trim(),
          announcementTitle: String(req.body?.announcementTitle || '').trim(),
          announcementText: String(req.body?.announcementText || '').trim(),
          announcementEnabled: String(req.body?.announcementEnabled || '') === 'true',
          updatedBy: user.id || user._id || user.email || ''
        };

        if (req.file) {
          update.logoUrl = await saveStoreLogo(req.file);
        }

        const profile = await StoreProfile.findOneAndUpdate(
          { key: 'default' },
          {
            $set: update,
            $setOnInsert: { key: 'default' }
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        ).lean();

        res.json({
          message: 'Store profile updated',
          profile: serializeStoreProfile(profile)
        });
      } catch (err) {
        console.error(
          'STORE PROFILE UPDATE ERROR:',
          err.response?.status || err.status,
          err.response?.data || err.message
        );

        res.status(err.response?.status || err.status || 500).json(
          err.response?.data || { error: err.message }
        );
      }
    }
  );

  app.get('/triciabales-api/api/refunds', async (req, res) => {
    try {
      const response = await axios.get(`${API_BASE}/api/refunds`, {
        headers: forwardHeaders(req)
      });

      res.json(response.data);
    } catch (err) {
      console.error(
        'REFUNDS LOAD ERROR:',
        err.response?.status || err.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || err.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/orders/:id/refund', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/orders/${req.params.id}/refund`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.status(response.status).json(response.data);
    } catch (err) {
      console.error(
        'REFUND REQUEST ERROR:',
        err.response?.status || err.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || err.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.put('/triciabales-api/api/refunds/:id/status', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/refunds/${req.params.id}/status`,
        req.body,
        {
          headers: forwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.status(response.status).json(response.data);
    } catch (err) {
      console.error(
        'REFUND STATUS ERROR:',
        err.response?.status || err.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || err.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  app.post('/triciabales-api/api/support/contact', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/support/contact`,
        req.body,
        {
          headers: clientForwardHeaders(req, {
            'Content-Type': 'application/json'
          })
        }
      );

      res.status(response.status).json(response.data);
    } catch (err) {
      console.error(
        'SUPPORT CONTACT ERROR:',
        err.response?.status || err.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || err.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

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
          headers: forwardHeaders(req),
          params: req.query
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
          headers: forwardHeaders(req),
          params: req.query
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

  async function proxyUserDirectory(req, res, backendPath, label) {
    try {
      const response = await axios.get(
        `${API_BASE}${backendPath}`,
        {
          headers: forwardHeaders(req),
          params: req.query
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        `${label} ERROR:`,
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  }

  app.get('/triciabales-api/api/sellers', (req, res) => {
    proxyUserDirectory(req, res, '/api/sellers', 'SELLERS ALIAS');
  });

  app.get('/triciabales-api/api/admin/users', (req, res) => {
    proxyUserDirectory(req, res, '/api/admin/users', 'ADMIN USERS ALIAS');
  });

  app.get('/triciabales-api/api/admin/sellers', (req, res) => {
    proxyUserDirectory(req, res, '/api/admin/sellers', 'ADMIN SELLERS ALIAS');
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

  app.put('/triciabales-api/api/users/:id/seller-approval', async (req, res) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/users/${req.params.id}/seller-approval`,
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
        'SELLER APPROVAL ERROR:',
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
        `${API_BASE}/api/triciabales`,
        { timeout: STORE_API_TIMEOUT_MS }
      );

      res.json(response.data);

    } catch (err) {
      console.error(
        'BALES ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      const status = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' ? 504 : 500;

      res.status(err.response?.status || status).json(
        err.response?.data || { error: err.message, upstream: API_BASE }
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

  // DELIVERY ESTIMATE
  app.post('/triciabales-api/api/delivery/estimate', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/delivery/estimate`,
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
        'DELIVERY ESTIMATE ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // DELIVERY PLACE SUGGESTIONS
  app.get('/triciabales-api/api/delivery/places', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/delivery/places`,
        {
          params: {
            input: req.query.input
          },
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'DELIVERY PLACES ERROR:',
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

  // PAYSTACK BANKS
  app.get('/triciabales-api/api/paystack/banks', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/paystack/banks`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'PAYSTACK BANKS ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // PAYSTACK STATUS
  app.get('/triciabales-api/api/paystack/status', async (req, res) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/paystack/status`,
        {
          headers: forwardHeaders(req)
        }
      );

      res.json(response.data);
    } catch (err) {
      console.error(
        'PAYSTACK STATUS ERROR:',
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
