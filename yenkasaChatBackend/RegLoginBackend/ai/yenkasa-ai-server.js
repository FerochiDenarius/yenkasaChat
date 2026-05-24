const fs = require('fs');
const path = require('path');
const express = require('express');

const AI_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'yenkasa_ai');
const AI_INDEX_PATH = path.join(AI_PUBLIC_DIR, 'index.html');

function hasBuiltAiApp() {
  try {
    return fs.existsSync(AI_INDEX_PATH);
  } catch (_error) {
    return false;
  }
}

module.exports = function mountYenkasaAi(app) {
  ['/ai', '/yme'].forEach((mountPath) => {
    app.use(
      `${mountPath}/assets`,
      express.static(path.join(AI_PUBLIC_DIR, 'assets'), {
        maxAge: '7d',
        index: false
      })
    );

    app.use(
      mountPath,
      express.static(AI_PUBLIC_DIR, {
        index: false,
        maxAge: '1h'
      })
    );

    app.get(mountPath, (req, res) => {
      if (!hasBuiltAiApp()) {
        return res.status(503).send('YenkasaAI is not built yet.');
      }

      res.sendFile(AI_INDEX_PATH);
    });

    app.get(new RegExp(`^${mountPath}(?:\\/.*)?$`), (req, res, next) => {
      if (!hasBuiltAiApp()) {
        return res.status(503).send('YenkasaAI is not built yet.');
      }

      const requestedPath = String(req.path || '')
        .replace(mountPath, '')
        .replace(/^\/+/, '');

      if (requestedPath.includes('.') && !requestedPath.endsWith('.html')) {
        return next();
      }

      res.sendFile(AI_INDEX_PATH);
    });
  });
};
