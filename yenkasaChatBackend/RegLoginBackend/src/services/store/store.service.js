const path = require('path');
const fs = require('fs');
const axios = require('axios');

function createStoreService(rootDir, StoreProfile) {
  const storePublicDir = path.join(rootDir, 'public', 'triciabales_frontend');
  const storeLandingDir = path.join(storePublicDir, 'landingFile');
  const storeLogoPath = path.join(storePublicDir, 'images', 'YenkasaStoreLogo.png');
  const storePageAliases = new Map(
    Object.entries({
      '': 'index.html',
      home: 'index.html',
      cart: 'cart.html',
      orders: 'my-orders.html',
      'my-orders': 'my-orders.html',
      register: 'register.html',
      'buyer-login': 'buyer-login.html',
      'seller-login': 'seller-login.html',
      'seller-dashboard': 'seller-dashboard.html',
      notifications: 'notifications.html',
      'admin-login': 'login.html',
      admin: 'admin.html',
      'super-admin': 'super-admin.html',
      dashboard: 'dashboard.html',
      address: 'address.html',
      delivery: 'delivery.html',
      payment: 'payment.html',
      'thank-you': 'thank-you.html',
      'forgot-password': 'forgot-password.html',
      'reset-password': 'reset-password.html',
      'verify-email': 'verify-email.html',
      'paystack-callback': 'paystack-callback.html',
      privacy: 'privacy.html',
    }),
  );
  const storeFileToAlias = new Map(
    Object.entries({
      'index.html': '',
      'cart.html': 'cart',
      'my-orders.html': 'orders',
      'register.html': 'register',
      'buyer-login.html': 'buyer-login',
      'seller-login.html': 'seller-login',
      'seller-dashboard.html': 'seller-dashboard',
      'notifications.html': 'notifications',
      'login.html': 'admin-login',
      'admin.html': 'admin',
      'super-admin.html': 'super-admin',
      'dashboard.html': 'dashboard',
      'address.html': 'address',
      'delivery.html': 'delivery',
      'payment.html': 'payment',
      'thank-you.html': 'thank-you',
      'forgot-password.html': 'forgot-password',
      'reset-password.html': 'reset-password',
      'verify-email.html': 'verify-email',
      'paystack-callback.html': 'paystack-callback',
      'privacy.html': 'privacy',
    }),
  );

  function getQueryString(req) {
    const index = req.originalUrl.indexOf('?');
    return index === -1 ? '' : req.originalUrl.slice(index);
  }

  function storePathForAlias(alias) {
    return alias ? `/store/${alias}` : '/store';
  }

  function serveStorePage(fileName) {
    return (req, res) => {
      res.sendFile(path.join(storeLandingDir, fileName));
    };
  }

  function isGitLfsPointer(buffer) {
    return buffer
      .slice(0, 48)
      .toString('utf8')
      .startsWith('version https://git-lfs.github.com/spec/v1');
  }

  async function loadStoreLogoBuffer() {
    const localLogo = await fs.promises.readFile(storeLogoPath);

    if (!isGitLfsPointer(localLogo)) {
      return localLogo;
    }

    const remoteLogoUrl = process.env.YENKASA_STORE_LOGO_URL || process.env.STORE_LOGO_URL;

    if (!remoteLogoUrl) {
      throw new Error(
        'Yenkasa Store logo file is a Git LFS pointer. Deploy the real PNG or set YENKASA_STORE_LOGO_URL.',
      );
    }

    const response = await axios.get(remoteLogoUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const remoteLogo = Buffer.from(response.data);

    if (isGitLfsPointer(remoteLogo)) {
      throw new Error('Remote Yenkasa Store logo URL returned a Git LFS pointer instead of a PNG.');
    }

    return remoteLogo;
  }

  function registerStoreRoutes(app) {
    app.get(
      [
        '/store/assets/images/YenkasaStoreLogo.png',
        '/store-assets/images/YenkasaStoreLogo.png',
        '/triciabales_frontend/images/YenkasaStoreLogo.png',
      ],
      async (req, res, next) => {
        try {
          const profile = await StoreProfile.findOne({ key: 'default' }).lean();
          const configuredLogoUrl = profile?.logoUrl || '';

          if (
            configuredLogoUrl &&
            !configuredLogoUrl.includes('/store/assets/images/YenkasaStoreLogo.png') &&
            !configuredLogoUrl.includes('/triciabales_frontend/images/YenkasaStoreLogo.png')
          ) {
            return res.redirect(302, configuredLogoUrl);
          }

          const logo = await loadStoreLogoBuffer();

          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', logo.length);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.send(logo);
        } catch (err) {
          console.error('Yenkasa Store logo error:', err.message);
          return next(err);
        }
      },
    );

    app.use('/store/assets', require('express').static(storePublicDir));
    app.use('/store-assets', require('express').static(storePublicDir));
    app.use('/uploads', require('express').static(path.join(rootDir, 'uploads')));

    app.get('/store', serveStorePage('index.html'));
    app.get('/privacy', serveStorePage('privacy.html'));
    app.get('/store/paystack/callback', serveStorePage('paystack-callback.html'));
    app.get('/store/:page', (req, res, next) => {
      const fileName = storePageAliases.get(req.params.page);
      if (!fileName) return next();
      return res.sendFile(path.join(storeLandingDir, fileName));
    });

    app.get('/triciabales_frontend/landingFile', (req, res) => {
      res.redirect(301, `/store${getQueryString(req)}`);
    });
    app.get('/triciabales_frontend/landingFile/', (req, res) => {
      res.redirect(301, `/store${getQueryString(req)}`);
    });
    app.get('/triciabales_frontend/landingFile/:page', (req, res, next) => {
      const page = req.params.page;
      if (!page.endsWith('.html')) {
        const fileName = storePageAliases.get(page);
        if (!fileName) return next();
        return res.sendFile(path.join(storeLandingDir, fileName));
      }

      const alias = storeFileToAlias.get(page);
      if (!alias && page !== 'index.html') return next();
      return res.redirect(301, `${storePathForAlias(alias)}${getQueryString(req)}`);
    });
  }

  return {
    registerStoreRoutes,
  };
}

module.exports = createStoreService;
