const express = require('express');
const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const listEndpoints = require('express-list-endpoints');

const StoreProfile = require('../models/storeProfile.model');
const { cloudinaryMediaResponseOptimizer } = require('../utils/cloudinaryMedia');
const redirectMiddleware = require('./middleware/redirectMiddleware');
const softotechPortalProxy = require('./middleware/softotechPortalProxy');
const mp4Headers = require('./middleware/mp4Headers');
const multerError = require('./middleware/multerError');
const errorHandler = require('./middleware/errorHandler');
const registerApiRoutes = require('./config/apiRoutes');
const registerPublicContent = require('./config/publicContent');
const createStoreService = require('./services/store/store.service');
const createBlogService = require('./services/blog/blog.service');
const { validateYmeRuntime } = require('./yme/bootstrap/validateYmeRuntime');

const app = express();
const rootDir = path.resolve(__dirname, '..');

app.set('trust proxy', true);
app.use(redirectMiddleware);
app.use(softotechPortalProxy);

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

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

validateYmeRuntime();
console.log('[YME] normalizeText loaded successfully');

require('../store/yenkasa-store-server')(app);
require('../web/yenkasa-web-server')(app);
require('../ai/yenkasa-ai-server')(app);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://www.yenkasa.xyz',
          'https://res.cloudinary.com',
          'https://storage.googleapis.com',
          'https://images.unsplash.com',
        ],
        mediaSrc: ["'self'", 'blob:', 'https://www.yenkasa.xyz', 'https://res.cloudinary.com', 'https://storage.googleapis.com'],
      },
    },
  }),
);

app.use(compression());
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));

registerApiRoutes(app, rootDir);
console.log('=== Registered endpoints ===');
console.log(listEndpoints(app));
console.log('=== End registered endpoints ===');

app.use(multerError);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

app.use(mp4Headers);

const storeService = createStoreService(rootDir, StoreProfile);
storeService.registerStoreRoutes(app);

const blogService = createBlogService(rootDir);
blogService.registerBlogRoutes(app);

registerPublicContent(app, rootDir);

app.use(errorHandler);

module.exports = app;
