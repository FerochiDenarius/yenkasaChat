const express = require('express');
const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const listEndpoints = require('express-list-endpoints');
const mongoose = require('mongoose');

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
const logger = require('./observability/logger');
const { render: renderMetrics, requestMetrics } = require('./observability/metrics');
const requestContext = require('./middleware/requestContext');

const app = express();
const rootDir = path.resolve(__dirname, '..');

app.set('trust proxy', true);
app.use(redirectMiddleware);
app.use(softotechPortalProxy);
app.use(requestContext);

const allowedOrigins = [process.env.CLIENT_URL, process.env.FRONTEND_URL]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ''));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
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
app.use(requestMetrics);
app.use(cloudinaryMediaResponseOptimizer);
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

validateYmeRuntime();
logger.info('YME runtime validated');

require('../store/yenkasa-store-server')(app);
require('../web/yenkasa-web-server')(app);
require('../ai/yenkasa-ai-server')(app);

const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
const r2PublicOrigin = (() => {
  if (!r2PublicBaseUrl) return null;
  try {
    return new URL(r2PublicBaseUrl).origin;
  } catch {
    return null;
  }
})();
const mediaSources = [
  'https://www.yenkasa.xyz',
  'https://res.cloudinary.com',
  'https://storage.googleapis.com',
  ...(r2PublicOrigin ? [r2PublicOrigin] : []),
];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', ...mediaSources, 'https://images.unsplash.com'],
        mediaSrc: ["'self'", 'blob:', ...mediaSources],
      },
    },
  }),
);

app.use(compression());

registerApiRoutes(app, rootDir);
logger.info('API routes registered', { endpointCount: listEndpoints(app).length });

app.use(multerError);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

app.get('/health/ready', (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const ready = mongoReady || process.env.SOFTOTECH_FIRESTORE_ONLY === 'true';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: { mongodb: mongoReady },
  });
});

app.get('/metrics', (req, res) => {
  res.type('text/plain').send(renderMetrics());
});

app.use(mp4Headers);

const storeService = createStoreService(rootDir, StoreProfile);
storeService.registerStoreRoutes(app);

const blogService = createBlogService(rootDir);
blogService.registerBlogRoutes(app);

registerPublicContent(app, rootDir);

app.use(errorHandler);

module.exports = app;
