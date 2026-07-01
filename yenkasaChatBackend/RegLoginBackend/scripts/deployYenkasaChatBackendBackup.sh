#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-project-10405180-0afd-4ecc-9f8}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-yenkasa-chat-backend-backup}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short=8 HEAD)"
BUILD_CONFIG="$REPO_ROOT/cloudbuild.yenkasa-chat-backup.yaml"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/yenkasa-chat-deploy.XXXXXX")"
SOURCE_DIR="$WORK_DIR/source"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if [[ ! -f "$BUILD_CONFIG" ]]; then
  echo "Missing Cloud Build config: $BUILD_CONFIG" >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "Refusing to deploy with uncommitted changes." >&2
  echo "Commit your changes first, then rerun this script." >&2
  exit 1
fi

echo "Deploying $SERVICE from commit $COMMIT_SHA"
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"

mkdir -p "$SOURCE_DIR"
git -C "$REPO_ROOT" archive --format=tar HEAD \
  cloudbuild.yenkasa-chat-backup.yaml \
  yenkasaChatBackend/RegLoginBackend \
  | tar -xf - -C "$SOURCE_DIR"

rm -rf \
  "$SOURCE_DIR/yenkasaChatBackend/RegLoginBackend/node_modules" \
  "$SOURCE_DIR/yenkasaChatBackend/RegLoginBackend/uploads" \
  "$SOURCE_DIR/yenkasaChatBackend/RegLoginBackend/public/uploads" \
  "$SOURCE_DIR/yenkasaChatBackend/RegLoginBackend/logs" \
  "$SOURCE_DIR/yenkasaChatBackend/RegLoginBackend/coverage" \
  "$SOURCE_DIR/yenkasaChatBackend/RegLoginBackend/.nyc_output" \
  "$SOURCE_DIR/yenkasaChatBackend/RegLoginBackend/tmp"

gcloud builds submit "$SOURCE_DIR" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --config="$SOURCE_DIR/cloudbuild.yenkasa-chat-backup.yaml" \
  --substitutions="SHORT_SHA=$COMMIT_SHA"

echo "Waiting for Cloud Run service readiness..."
gcloud run services describe "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format='table(status.latestReadyRevisionName,status.url,status.conditions[0].status)'

echo "Deploy complete. Verify: https://www.yenkasa.xyz/yenkasa-ai"
