# Yenkasa Backup Server Deployment Runbook

Date: 2026-06-12

## Objective

Prepare backup server deployments for:

- Google Cloud Run secondary
- Heroku tertiary

DigitalOcean remains the primary provider.

## Files Added

- `Dockerfile`
- `.dockerignore`
- `Procfile`
- `app.json`
- `scripts/deployCloudRunBackup.sh`
- `src/config/socketRedisAdapter.js`

## Backup Runtime Rules

Backup web servers should run the HTTP and Socket.IO app only.

Set these flags on Cloud Run and Heroku backup web processes:

```text
YENKASA_ENABLE_INLINE_MODERATION_WORKERS=false
YENKASA_ENABLE_INLINE_YME_WORKERS=false
```

Run workers as separate processes only after Redis is configured and only on the active provider.

## Cloud Run Backup Deployment

Service name:

```text
yenkasa-chat-backend-backup
```

Current deployed service:

```text
URL: https://yenkasa-chat-backend-backup-3vx2nvls4a-ew.a.run.app
Revision: yenkasa-chat-backend-backup-00001-rb9
Health: 200 OK at /health
Deployed: 2026-06-12
```

Project:

```text
project-10405180-0afd-4ecc-9f8
```

Region:

```text
europe-west1
```

Deploy command:

```bash
PROJECT_ID=project-10405180-0afd-4ecc-9f8 \
REGION=europe-west1 \
SERVICE_NAME=yenkasa-chat-backend-backup \
bash scripts/deployCloudRunBackup.sh
```

Required Cloud Run secrets/env:

- `MONGODB_URI`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `REDIS_URL`
- `YENKASA_SOCKET_REDIS_ENABLED=true`
- `YENKASA_AI_ENGINE_URL`
- `YENKASA_AI_EVENT_API_KEY`
- `TRICIABALES_API_BASE`

GCS defaults:

```text
MEDIA_STORAGE_PROVIDER=gcs
GCS_MEDIA_BUCKET=yenkasa-media
GOOGLE_CLOUD_PROJECT=project-10405180-0afd-4ecc-9f8
GCS_MAKE_PUBLIC=false
```

## Heroku Backup Deployment

The `Procfile` defines:

```text
web: npm start
worker_moderation: npm run worker:moderation
worker_yme: npm run worker:yme
```

Current status:

```text
Not deployed.
Reason: local Heroku CLI credentials are invalid and HEROKU_API_KEY is not set.
```

Required unblock:

```bash
heroku login
```

or export a valid token:

```bash
export HEROKU_API_KEY=<valid token>
```

Initial Heroku formation:

```bash
heroku ps:scale web=1 worker_moderation=0 worker_yme=0 --app <heroku-app-name>
```

Only scale workers after Redis is configured and the provider is active:

```bash
heroku ps:scale worker_moderation=1 worker_yme=1 --app <heroku-app-name>
```

## Redis Realtime Layer

Socket.IO now supports the official Redis adapter through:

```text
@socket.io/redis-adapter
ioredis
```

The adapter is enabled automatically when any of these are configured:

```text
YENKASA_SOCKET_REDIS_URL
YENKASA_REDIS_URL
REDIS_URL
YENKASA_SOCKET_REDIS_HOST
YENKASA_REDIS_HOST
REDIS_HOST
```

Disable explicitly with:

```text
YENKASA_SOCKET_REDIS_ENABLED=false
```

Recommended production value:

```text
YENKASA_SOCKET_REDIS_ENABLED=true
REDIS_URL=<shared redis url>
```

Impact:

- Socket.IO room broadcasts can cross DigitalOcean, Cloud Run, and Heroku instances when they share Redis.
- Chat room events and livestream room events are no longer limited to one Node.js process.
- Online presence has optional Redis-backed shared sets while retaining a local in-process map for fast socket cleanup.

Presence-specific overrides:

```text
YENKASA_PRESENCE_REDIS_ENABLED=true
YENKASA_PRESENCE_REDIS_URL=<shared redis url>
YENKASA_PRESENCE_REDIS_PREFIX=yenkasa:presence
YENKASA_PRESENCE_SOCKET_TTL_SECONDS=86400
```

## Verification

After deployment:

```bash
curl https://<backup-url>/health
```

Expected:

```json
{"status":"ok"}
```

Then verify:

- login
- feed read
- post creation
- profile image upload
- community read/create
- Socket.IO connect
- one livestream token generation
- one Agora join flow
- one notification event

## Current Risks

- Socket.IO room pub/sub and online presence can use Redis. Multi-provider failover should still start active-passive until production traffic verifies Redis latency and disconnect behavior.
- `uploads/` and `public/uploads/` still contain local files and must not be treated as durable production storage.
- Cloud Run and Heroku must use MongoDB Atlas with provider network access enabled.
- Heroku needs GCS credentials through config vars or workload identity equivalent is not available there.
- Cloud Run can use the service account identity for GCS if IAM is configured on `yenkasa-media`.

## Recommended Failover Order

1. Keep DigitalOcean primary.
2. Deploy Cloud Run backup with `min-instances=0` for warm standby.
3. Deploy Heroku tertiary with one paid web dyno but no workers.
4. Configure all providers with the same Redis URL.
5. Configure Cloudflare health checks and manual failover.
6. Verify Redis-backed presence under a controlled multi-instance test.
7. Only then enable automatic failover.
