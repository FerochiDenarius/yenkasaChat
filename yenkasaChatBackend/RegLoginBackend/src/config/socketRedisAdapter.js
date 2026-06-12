let redisModulePromise = null;
let redisAdapterModulePromise = null;
let pubClient = null;
let subClient = null;

function redisUrl() {
  return process.env.YENKASA_SOCKET_REDIS_URL ||
    process.env.YENKASA_REDIS_URL ||
    process.env.REDIS_URL ||
    '';
}

function redisOptions() {
  return {
    host: process.env.YENKASA_SOCKET_REDIS_HOST ||
      process.env.YENKASA_REDIS_HOST ||
      process.env.REDIS_HOST ||
      '127.0.0.1',
    port: Number(
      process.env.YENKASA_SOCKET_REDIS_PORT ||
        process.env.YENKASA_REDIS_PORT ||
        process.env.REDIS_PORT ||
        6379,
    ),
    password: process.env.YENKASA_SOCKET_REDIS_PASSWORD ||
      process.env.YENKASA_REDIS_PASSWORD ||
      process.env.REDIS_PASSWORD ||
      undefined,
    db: Number(
      process.env.YENKASA_SOCKET_REDIS_DB ||
        process.env.YENKASA_REDIS_DB ||
        process.env.REDIS_DB ||
        0,
    ),
  };
}

function isSocketRedisEnabled() {
  if (process.env.YENKASA_SOCKET_REDIS_ENABLED === 'false') return false;
  return Boolean(
    redisUrl() ||
      process.env.YENKASA_SOCKET_REDIS_HOST ||
      process.env.YENKASA_REDIS_HOST ||
      process.env.REDIS_HOST,
  );
}

async function loadRedis() {
  if (!redisModulePromise) {
    redisModulePromise = Promise.resolve().then(() => require('ioredis'));
  }
  return redisModulePromise;
}

async function loadRedisAdapter() {
  if (!redisAdapterModulePromise) {
    redisAdapterModulePromise = Promise.resolve().then(() => require('@socket.io/redis-adapter'));
  }
  return redisAdapterModulePromise;
}

async function buildRedisClient() {
  const IORedis = await loadRedis();
  const url = redisUrl();
  if (url) {
    return new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return new IORedis({
    ...redisOptions(),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function configureSocketRedisAdapter(io) {
  if (!io || !isSocketRedisEnabled()) {
    console.log('[Socket.IO] Redis adapter disabled; using in-memory adapter.');
    return { enabled: false };
  }

  const { createAdapter } = await loadRedisAdapter();
  pubClient = await buildRedisClient();
  subClient = pubClient.duplicate();

  const logError = (label) => (error) => {
    console.error(`[Socket.IO] Redis ${label} error:`, error.message);
  };
  pubClient.on('error', logError('pub'));
  subClient.on('error', logError('sub'));

  io.adapter(createAdapter(pubClient, subClient));
  console.log('[Socket.IO] Redis adapter enabled.');
  return { enabled: true };
}

async function closeSocketRedisAdapter() {
  await Promise.all([
    pubClient?.quit?.().catch(() => pubClient.disconnect?.()),
    subClient?.quit?.().catch(() => subClient.disconnect?.()),
  ].filter(Boolean));
  pubClient = null;
  subClient = null;
}

module.exports = {
  closeSocketRedisAdapter,
  configureSocketRedisAdapter,
  isSocketRedisEnabled,
};
