const fs = require('fs');
const path = require('path');
const express = require('express');

const WEB_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'yenkasa_web');
const WEB_INDEX_PATH = path.join(WEB_PUBLIC_DIR, 'index.html');

function hasBuiltWebApp() {
  try {
    return fs.existsSync(WEB_INDEX_PATH);
  } catch (error) {
    return false;
  }
}

module.exports = function mountYenkasaWeb(app) {
  app.use(
    '/web/assets',
    express.static(path.join(WEB_PUBLIC_DIR, 'assets'), {
      maxAge: '7d',
      index: false
    })
  );

  app.use(
    '/web',
    express.static(WEB_PUBLIC_DIR, {
      index: false,
      maxAge: '1h'
    })
  );

  app.get('/web', (req, res) => {
    if (!hasBuiltWebApp()) {
      return res.status(503).send('Yenkasa web is not built yet.');
    }

    res.sendFile(WEB_INDEX_PATH);
  });

  app.get(/^\/web(?:\/.*)?$/, (req, res, next) => {
    if (!hasBuiltWebApp()) {
      return res.status(503).send('Yenkasa web is not built yet.');
    }

    const requestedPath = String(req.path || '').replace(/^\/web\/?/, '');

    if (requestedPath.includes('.') && !requestedPath.endsWith('.html')) {
      return next();
    }

    res.sendFile(WEB_INDEX_PATH);
  });
};
