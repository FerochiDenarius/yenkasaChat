console.log('✅ yenkasa-store-server loaded');

const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const upload = multer();
const API_BASE = 'http://134.209.182.39:8080';

function forwardHeaders(req, extraHeaders = {}) {
  const headers = { ...extraHeaders };

  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  return headers;
}

module.exports = function (app) {

  // USER REGISTER
  app.post('/triciabales-api/api/users/register', async (req, res) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/users/register`,
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
        'REGISTER ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });

  // USER LOGIN
  app.post('/triciabales-api/api/users/login', async (req, res) => {
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

      res.json(response.data);

    } catch (err) {
      console.error(
        'USER LOGIN ERROR:',
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
        const form = new FormData();

        form.append('name', req.body.name);
        form.append('price', req.body.price);
        form.append('weight', req.body.weight);
        form.append('category', req.body.category);
        form.append('description', req.body.description);
        form.append('status', req.body.status);
        form.append('type', req.body.type || 'bale');
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
            headers: forwardHeaders(req, form.getHeaders()),
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
};
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
