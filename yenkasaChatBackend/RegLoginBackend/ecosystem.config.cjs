module.exports = {
  apps: [
    {
      name: 'yenkasa-app-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        YENKASA_ENABLE_INLINE_YME_WORKERS: 'false',
        YENKASA_ENABLE_INLINE_MODERATION_WORKERS: 'false',
        YENKASA_AI_INTELLIGENCE_ENABLED: 'true',
      },
    },
    {
      name: 'yenkasa-yme-worker',
      script: 'src/yme/workers/yme.worker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        YENKASA_AI_INTELLIGENCE_ENABLED: 'true',
      },
    },
    {
      name: 'yenkasa-moderation-worker',
      script: 'src/ai/workers/moderation.worker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
