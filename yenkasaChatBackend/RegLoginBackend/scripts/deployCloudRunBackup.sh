#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-project-10405180-0afd-4ecc-9f8}"
REGION="${REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-yenkasa-chat-backend-backup}"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 2 \
  --update-env-vars NODE_ENV=production,PROJECT_REQUEST_STORAGE=firestore,SOFTOTECH_FIRESTORE_DATABASE_ID=yenkasa-project-mgmt,PROJECT_REQUEST_FIRESTORE_DATABASE_ID=yenkasa-project-mgmt,MEDIA_STORAGE_PROVIDER=gcs,GCS_MEDIA_BUCKET=yenkasa-media,GOOGLE_CLOUD_PROJECT="$PROJECT_ID",GCS_MAKE_PUBLIC=false,YENKASA_SOCKET_REDIS_ENABLED=true,YENKASA_PRESENCE_REDIS_ENABLED=true,YENKASA_ENABLE_INLINE_MODERATION_WORKERS=false,YENKASA_ENABLE_INLINE_YME_WORKERS=false \
  --update-secrets RESEND_API_KEY=RESEND_API_KEY:latest \
  --remove-env-vars SMTP_HOST,SMTP_PORT,SMTP_SECURE,EMAIL_USER,EMAIL_PASS
