# YenkasaAI Cloud Run Backend

This is the production-oriented FastAPI backend for YenkasaAI.

## Role in the System

- frontend remains on DigitalOcean for now
- backend runs on Google Cloud Run
- Vertex AI handles generation
- ChromaDB handles retrieval
- Google Cloud Storage stores the Chroma snapshot and uploaded knowledge files

## Endpoint Surface

- `GET /health`
- `POST /chat`
- `POST /search`
- `POST /ingest`

## Persistence Strategy

Cloud Run is stateless. This backend therefore:

1. downloads the latest Chroma snapshot from GCS into `/tmp/yenkasa-ai/chroma_db`
2. serves retrieval from that local working copy
3. uploads the updated Chroma snapshot back to GCS after ingestion

This is the pragmatic Cloud Run-compatible approach while keeping ChromaDB.

## Required Environment Variables

- `VERTEX_AI_PROJECT_ID=project-10405180-0afd-4ecc-9f8`
- `VERTEX_AI_LOCATION=us-central1`
- `VERTEX_AI_MODEL=gemini-2.5-flash`
- `GCS_BUCKET=<your-bucket>`
- `GCS_CHROMA_PREFIX=yenkasa-ai/chroma`
- `GCS_KNOWLEDGE_PREFIX=yenkasa-ai/knowledge`
- `CORS_ALLOW_ORIGINS=https://your-do-frontend.example`

Optional:

- `CHROMA_COLLECTION_NAME=yenkasa_research`
- `CHROMA_PUBLIC_COLLECTION_NAME=yenkasa_platform_knowledge`
- `PUBLIC_KNOWLEDGE_BOOTSTRAP_DIR=/workspace/knowledge/bootstrap`
- `EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2`

## Cloud Run Deploy Command

```bash
gcloud run deploy yenkasa-ai-backend \
  --source . \
  --region us-central1 \
  --project project-10405180-0afd-4ecc-9f8 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars VERTEX_AI_PROJECT_ID=project-10405180-0afd-4ecc-9f8,VERTEX_AI_LOCATION=us-central1,VERTEX_AI_MODEL=gemini-2.5-flash,GCS_BUCKET=YOUR_BUCKET,GCS_CHROMA_PREFIX=yenkasa-ai/chroma,GCS_KNOWLEDGE_PREFIX=yenkasa-ai/knowledge,CORS_ALLOW_ORIGINS=https://YOUR-DO-FRONTEND
```

## Deployment Notes

- attach a service account with Vertex AI and Cloud Storage access
- keep frontend API base pointed to the Cloud Run URL after deployment
- if ingestion volume grows, move heavy ingest into a job or worker tier instead of keeping it inline on request
