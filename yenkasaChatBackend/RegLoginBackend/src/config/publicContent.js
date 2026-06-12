const express = require('express');
const fs = require('fs');
const path = require('path');

function servePolicy(rootDir, fileName) {
  return (req, res) => {
    res.sendFile(path.join(rootDir, 'public', fileName));
  };
}

function registerPolicyPages(app, rootDir) {
  app.get('/privacy-policy', servePolicy(rootDir, 'privacy-policy.html'));
  app.get('/privacy-policy.html', servePolicy(rootDir, 'privacy-policy.html'));
  app.get('/user-agreement', servePolicy(rootDir, 'user-agreement.html'));
  app.get('/user-agreement.html', servePolicy(rootDir, 'user-agreement.html'));
  app.get('/community-guidelines', servePolicy(rootDir, 'community-guidelines.html'));
  app.get('/community-guidelines.html', servePolicy(rootDir, 'community-guidelines.html'));
  app.get('/moderation-policy', servePolicy(rootDir, 'moderation-policy.html'));
  app.get('/moderation-policy.html', servePolicy(rootDir, 'moderation-policy.html'));
  app.get('/safety-policy', servePolicy(rootDir, 'safety-policy.html'));
  app.get('/safety-policy.html', servePolicy(rootDir, 'safety-policy.html'));
  app.get('/ads-disclosure', servePolicy(rootDir, 'ads-disclosure.html'));
  app.get('/ads-disclosure.html', servePolicy(rootDir, 'ads-disclosure.html'));
  app.get('/delete-data', servePolicy(rootDir, 'delete-data.html'));
  app.get('/delete-data.html', servePolicy(rootDir, 'delete-data.html'));
  app.get('/data-deletion', servePolicy(rootDir, 'delete-data.html'));
  app.get('/data-deletion.html', servePolicy(rootDir, 'delete-data.html'));
  app.get('/account-data-deletion', servePolicy(rootDir, 'delete-data.html'));
  app.get('/account-data-deletion.html', servePolicy(rootDir, 'delete-data.html'));
}

function registerPublicContent(app, rootDir) {
  registerPolicyPages(app, rootDir);

  app.get('/yme-inspector', (req, res) => {
    res.redirect(302, '/yme');
  });
  app.get('/yme-inspector/', (req, res) => {
    res.redirect(302, '/yme');
  });

  app.get('/app-ads.txt', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'app-ads.txt'));
  });

  app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'images', 'yc.png'));
  });

  app.get('/ecosystem', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'ecosystem.html'));
  });
  app.get('/yenkasa-app', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'yenkasa-app.html'));
  });
  app.get('/yenkasa-store', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'yenkasa-store.html'));
  });
  app.get('/yenkasa-ai', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'yenkasa-ai.html'));
  });
  app.get('/portfolio-admin', (req, res) => {
    res.sendFile(path.join(rootDir, 'public', 'admin.html'));
  });

  app.get('/.well-known/assetlinks.json', (req, res) => {
    const filePath = path.join(rootDir, 'public', '.well-known', 'assetlinks.json');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return res.status(err.code === 'ENOENT' ? 404 : 500).send(err.message);
      }
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(data);
    });
  });

  app.use('/reset-password', express.static(path.join(rootDir, 'public/reset-password')));
  app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(rootDir, 'public/reset-password', 'index.html'));
  });

  app.use(express.static(path.join(rootDir, 'public')));
  console.log('server.js: Static file serving configured for /public.');

  app.get('/download-app', (req, res) => {
    const apkPath = path.join(rootDir, 'public', 'yenkasa.0.3.1.apk');
    res.download(apkPath, 'Yenkasa-0.3.1.apk', (err) => {
      if (err) {
        console.error('APK download failed:', err.message);
        if (!res.headersSent) {
          res.status(404).send('APK file not found');
        }
      }
    });
  });
}

module.exports = registerPublicContent;
