const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const listEndpoints = require('express-list-endpoints');

const StoreProfile = require('../models/storeProfile.model');
const { cloudinaryMediaResponseOptimizer } = require('../utils/cloudinaryMedia');
const redirectMiddleware = require('./middleware/redirectMiddleware');
const mp4Headers = require('./middleware/mp4Headers');
const multerError = require('./middleware/multerError');
const errorHandler = require('./middleware/errorHandler');
const createStoreService = require('./services/store/store.service');
const createBlogService = require('./services/blog/blog.service');

const app = express();
const rootDir = path.resolve(__dirname, '..');

app.set('trust proxy', true);
app.use(redirectMiddleware);

const corsOptions = {
  origin(origin, callback) {
    callback(null, origin || true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(
  express.json({
    verify: (req, res, buf) => {
      const requestPath = String(req.originalUrl || '').split('?')[0];
      if (requestPath === '/triciabales-api/api/paystack/webhook') {
        req.rawBody = buf.toString('utf8');
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cloudinaryMediaResponseOptimizer);
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

require('../store/yenkasa-store-server')(app);
require('../web/yenkasa-web-server')(app);
require('../ai/yenkasa-ai-server')(app);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://www.yenkasa.xyz',
          'https://res.cloudinary.com',
          'https://images.unsplash.com',
        ],
        mediaSrc: ["'self'", 'blob:', 'https://www.yenkasa.xyz', 'https://res.cloudinary.com'],
      },
    },
  }),
);

app.use(compression());
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));

function safeMount(routePath, modulePath) {
  try {
    app.use(routePath, require(path.join(rootDir, modulePath)));
    console.log(`✅ Mounted ${modulePath} at ${routePath}`);
  } catch (err) {
    console.error(`❌ Failed to mount ${modulePath} at ${routePath}: ${err.message}`);
  }
}

console.log('server.js: Mounting API routes...');
safeMount('/api/auth', 'routes/auth');
safeMount('/api/reset-password', 'routes/changepwd.routes.js');
safeMount('/api/verify', 'routes/verify');
safeMount('/api/account', 'routes/account.routes');
safeMount('/api/users', 'routes/user.routes');
safeMount('/api/user', 'routes/conversationStreak.routes');
safeMount('/api/contacts', 'routes/contacts.routes');
safeMount('/api/messages', 'routes/messages.routes');
safeMount('/api/chatrooms', 'routes/chatroom.routes');
safeMount('/api/groups', 'routes/group.routes');
safeMount('/api/onesignal', 'routes/onesignal');
safeMount('/api/profile', 'routes/profile');
safeMount('/api/app', 'routes/app.routes');
safeMount('/api/app-verification', 'routes/appverification.routes');
safeMount('/api/coin-transactions', 'routes/cointransaction.routes');
safeMount('/api/wallet', 'routes/wallet.routes');
safeMount('/api/leaderboard', 'routes/leaderboard.routes');
safeMount('/api/admin', 'routes/adminPayout.routes');
safeMount('/api/comments', 'routes/comments.routes');
safeMount('/api/feed', 'routes/feed.routes');
safeMount('/api/search', 'routes/search.routes');
safeMount('/api/communities', 'routes/community.routes');
safeMount('/api/roles', 'routes/roles.routes');
safeMount('/api/follow', 'routes/follow.routes');
safeMount('/api/post-approval', 'routes/postapproval.routes');
safeMount('/api/notifications', 'routes/notifications.routes');
safeMount('/api/updates', 'routes/updates.routes');
safeMount('/api/announcements', 'routes/announcement.routes');
safeMount('/api/user-privacy', 'routes/userPrivacy.routes');
safeMount('/api/metrics', 'routes/metrics.routes');
safeMount('/api/live', 'routes/live.routes');
safeMount('/api/livestream', 'routes/livestream.routes');
safeMount('/api/ads', 'routes/ads.routes');
safeMount('/api/email-verification', 'routes/emailVerification.routes');
safeMount('/api', 'routes/accountDeletion.routes');
safeMount('/api', 'routes/moderation.routes');
safeMount('/', 'routes/moderation.page');

app.use(multerError);

console.log('✅ Finished mounting API routes.');
console.log('=== Registered endpoints ===');
console.log(listEndpoints(app));
console.log('=== End registered endpoints ===');

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

app.use(mp4Headers);

function servePolicy(fileName) {
  return (req, res) => {
    res.sendFile(path.join(rootDir, 'public', fileName));
  };
}

app.get('/privacy-policy', servePolicy('privacy-policy.html'));
app.get('/privacy-policy.html', servePolicy('privacy-policy.html'));
app.get('/user-agreement', servePolicy('user-agreement.html'));
app.get('/user-agreement.html', servePolicy('user-agreement.html'));
app.get('/community-guidelines', servePolicy('community-guidelines.html'));
app.get('/community-guidelines.html', servePolicy('community-guidelines.html'));
app.get('/moderation-policy', servePolicy('moderation-policy.html'));
app.get('/moderation-policy.html', servePolicy('moderation-policy.html'));
app.get('/safety-policy', servePolicy('safety-policy.html'));
app.get('/safety-policy.html', servePolicy('safety-policy.html'));
app.get('/ads-disclosure', servePolicy('ads-disclosure.html'));
app.get('/ads-disclosure.html', servePolicy('ads-disclosure.html'));
app.get('/delete-data', servePolicy('delete-data.html'));
app.get('/delete-data.html', servePolicy('delete-data.html'));
app.get('/data-deletion', servePolicy('delete-data.html'));
app.get('/data-deletion.html', servePolicy('delete-data.html'));
app.get('/account-data-deletion', servePolicy('delete-data.html'));
app.get('/account-data-deletion.html', servePolicy('delete-data.html'));

app.get('/app-ads.txt', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'app-ads.txt'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'images', 'yc.png'));
});

const deepLinkPreviewRoutes = require('../routes/deeplinkPreview.routes');
app.use('/', deepLinkPreviewRoutes);

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

const postRoutes = require('../routes/post.routes');
app.use('/api/posts', postRoutes);
const socialRoutes = require('../routes/social.routes');
app.use('/api/social', socialRoutes);
const viewRoutes = require('../routes/view.routes');
app.use('/api/views', viewRoutes);
const deleteAccountPage = require('../routes/deleteAccount.page');
app.use(deleteAccountPage);

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/blog/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  next();
});

const storeService = createStoreService(rootDir, StoreProfile);
storeService.registerStoreRoutes(app);

const blogService = createBlogService(rootDir);
blogService.registerBlogRoutes(app);

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

app.use(errorHandler);

module.exports = app;
