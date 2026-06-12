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

Initial Heroku formation:

```bash
heroku ps:scale web=1 worker_moderation=0 worker_yme=0 --app <heroku-app-name>
```

Only scale workers after Redis is configured and the provider is active:

```bash
heroku ps:scale worker_moderation=1 worker_yme=1 --app <heroku-app-name>
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

- Socket.IO state is still process-local. Multi-instance failover should stay active-passive until Redis Socket.IO adapter is implemented.
- `uploads/` and `public/uploads/` still contain local files and must not be treated as durable production storage.
- Cloud Run and Heroku must use MongoDB Atlas with provider network access enabled.
- Heroku needs GCS credentials through config vars or workload identity equivalent is not available there.
- Cloud Run can use the service account identity for GCS if IAM is configured on `yenkasa-media`.

## Recommended Failover Order

1. Keep DigitalOcean primary.
2. Deploy Cloud Run backup with `min-instances=0` for warm standby.
3. Deploy Heroku tertiary with one paid web dyno but no workers.
4. Add Redis Socket.IO adapter.
5. Configure Cloudflare health checks and manual failover.
6. Only then enable automatic failover.
