const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const upload = multer();

module.exports = function (app) {

  // LOGIN
  app.post('/triciabales-api/api/auth/login', async (req, res) => {
    try {
      console.log('LOGIN BODY:', req.body);

      const response = await axios.post(
        'http://134.209.182.39:8080/api/auth/login',
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
        'http://134.209.182.39:8080/api/triciabales'
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
          'http://134.209.182.39:8080/api/triciabales/upload',
          form,
          {
            headers: form.getHeaders(),
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
        `http://134.209.182.39:8080/api/triciabales/${req.params.id}/status`
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
        `http://134.209.182.39:8080/api/triciabales/${req.params.id}`
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
        'http://134.209.182.39:8080/api/orders/checkout',
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
        'CHECKOUT ERROR:',
        err.response?.status,
        err.response?.data || err.message
      );

      res.status(err.response?.status || 500).json(
        err.response?.data || { error: err.message }
      );
    }
  });
};
