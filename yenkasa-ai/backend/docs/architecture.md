# Yenkasa Dev Intelligence v1 Architecture

`Yenkasa-AI` now runs as a layered FastAPI service on Google Cloud Run:

- The legacy `RagRuntime` still serves `/chat`, `/search`, `/ingest`.
- The new `IntelligenceRuntime` adds authentication, repository intelligence, YME tracking, analytics, sessions, and admin APIs.
- MongoDB Atlas stores repository chunks, users, sessions, conversations, YME events, security alerts, and insights.
- Redis backs RQ ingestion workers, rate limiting, and future cache expansion.
- Gemini handles repository reasoning and embeddings.

Core application layout:

- `app/api`: auth, admin, repo intelligence routes
- `app/core`: runtime lifecycle and shared dependencies
- `app/modules/auth|users|sessions|yme|analytics|tracking|security`: identity and telemetry
- `app/modules/repo_ingestion|repo_search|repo_chat|repo_insights|embeddings|vector_search|events`: engineering intelligence
- `app/workers`: RQ worker entrypoints and ingestion task execution
- `app/services`: MongoDB, Redis/RQ, Gemini provider adapters
- `app/models` and `app/schemas`: persistence and API contracts
- `app/utils` and `app/middleware`: safety helpers and request/auth context

Cloud Run deployment model:

- API service: `Dockerfile`
- Worker service or Cloud Run Job: `Dockerfile.worker`
- External state only: MongoDB Atlas, Redis, GCS
- Repository scanning remains read-only and constrained to `REPO_ALLOWED_ROOTS`

Future extension points:

- multi-agent coding workflows on top of stored repo chunks and conversations
- ecosystem SSO across Yenkasa properties
- deeper YME personalization and recommendation services
