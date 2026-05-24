const path = require('path');

const deepLinkPreviewRoutes = require('../../routes/deeplinkPreview.routes');
const postRoutes = require('../../routes/post.routes');
const socialRoutes = require('../../routes/social.routes');
const viewRoutes = require('../../routes/view.routes');
const deleteAccountPage = require('../../routes/deleteAccount.page');

const API_ROUTE_MOUNTS = [
  ['/api/auth', 'routes/auth'],
  ['/api/reset-password', 'routes/changepwd.routes.js'],
  ['/api/verify', 'routes/verify'],
  ['/api/account', 'routes/account.routes'],
  ['/api/users', 'routes/user.routes'],
  ['/api/user', 'routes/conversationStreak.routes'],
  ['/api/contacts', 'routes/contacts.routes'],
  ['/api/yenkasa-ai', 'src/ai/routes/web'],
  ['/api/ai', 'src/ai/routes'],
  ['/api/yme', 'src/yme/routes'],
  ['/api/messages', 'routes/messages.routes'],
  ['/api/chatrooms', 'routes/chatroom.routes'],
  ['/api/groups', 'routes/group.routes'],
  ['/api/onesignal', 'routes/onesignal'],
  ['/api/profile', 'routes/profile'],
  ['/api/app', 'routes/app.routes'],
  ['/api/app-verification', 'routes/appverification.routes'],
  ['/api/coin-transactions', 'routes/cointransaction.routes'],
  ['/api/wallet', 'routes/wallet.routes'],
  ['/api/leaderboard', 'routes/leaderboard.routes'],
  ['/api/admin', 'routes/adminPayout.routes'],
  ['/api/comments', 'routes/comments.routes'],
  ['/api/feed', 'routes/feed.routes'],
  ['/api/search', 'routes/search.routes'],
  ['/api/communities', 'routes/community.routes'],
  ['/api/roles', 'routes/roles.routes'],
  ['/api/follow', 'routes/follow.routes'],
  ['/api/post-approval', 'routes/postapproval.routes'],
  ['/api/ai-moderation', 'routes/aiModeration.routes'],
  ['/api/notifications', 'routes/notifications.routes'],
  ['/api/updates', 'routes/updates.routes'],
  ['/api/announcements', 'routes/announcement.routes'],
  ['/api/user-privacy', 'routes/userPrivacy.routes'],
  ['/api/metrics', 'routes/metrics.routes'],
  ['/api/live', 'routes/live.routes'],
  ['/api/livestream', 'routes/livestream.routes'],
  ['/api/ads', 'routes/ads.routes'],
  ['/api/email-verification', 'routes/emailVerification.routes'],
  ['/api', 'routes/accountDeletion.routes'],
  ['/api', 'routes/moderation.routes'],
  ['/', 'routes/moderation.page'],
];

function safeMount(app, rootDir, routePath, modulePath) {
  try {
    app.use(routePath, require(path.join(rootDir, modulePath)));
    console.log(`✅ Mounted ${modulePath} at ${routePath}`);
  } catch (err) {
    console.error(`❌ Failed to mount ${modulePath} at ${routePath}: ${err.message}`);
  }
}

function registerApiRoutes(app, rootDir) {
  console.log('server.js: Mounting API routes...');
  API_ROUTE_MOUNTS.forEach(([routePath, modulePath]) => {
    safeMount(app, rootDir, routePath, modulePath);
  });

  app.use('/', deepLinkPreviewRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/social', socialRoutes);
  app.use('/api/views', viewRoutes);
  app.use(deleteAccountPage);

  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/blog/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    next();
  });

  console.log('✅ Finished mounting API routes.');
}

module.exports = registerApiRoutes;
