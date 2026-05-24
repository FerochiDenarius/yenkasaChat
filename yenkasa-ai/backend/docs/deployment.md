# Deployment

## Cloud Run API Service

```bash
gcloud run deploy yenkasa-ai-backend \
  --source . \
  --region us-central1 \
  --project project-10405180-0afd-4ecc-9f8 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars-file .env.production
```

## Cloud Run Worker Service

Deploy the worker from `Dockerfile.worker` so ingestion stays off the request path:

```bash
gcloud run deploy yenkasa-ai-worker \
  --source . \
  --region us-central1 \
  --project project-10405180-0afd-4ecc-9f8 \
  --no-allow-unauthenticated \
  --set-env-vars-file .env.production
```

## Required managed dependencies

- MongoDB Atlas
- Redis instance reachable from Cloud Run
- Google Cloud Storage bucket for the existing Chroma snapshot flow
- Google service account with Vertex AI and GCS permissions

## Recommended environment strategy

- keep `JWT_SECRET_KEY`, `MONGODB_URI`, and `REDIS_URL` in Secret Manager
- inject secrets into Cloud Run at deploy time
- keep `REPO_ALLOWED_ROOTS` limited to mounted or copied repository roots
- run the worker with the same Mongo/Redis/JWT environment as the API

## Local verification

```bash
python3 -m compileall app api services
python3 -m unittest discover -s tests
```
