# YenkasaAI Cloud Run Backend

This backend now has two layers:

- the existing public/engineering RAG chat runtime
- a new authenticated intelligence layer for repositories, sessions, YME tracking, analytics, and admin tooling

Google Cloud Run remains the deployment target. The API service stays stateless, while MongoDB Atlas, Redis, and Google Cloud Storage hold all durable state.

Primary endpoint groups:

- legacy AI: `GET /health`, `POST /chat`, `POST /search`, `POST /ingest`
- auth: `/api/auth/*`
- repo intelligence: `/api/repo/*`
- admin intelligence: `/api/admin/*`

Key docs:

- [architecture.md](/Users/kofibright/yenkasaChat/yenkasa-ai/backend/docs/architecture.md)
- [deployment.md](/Users/kofibright/yenkasaChat/yenkasa-ai/backend/docs/deployment.md)
- [auth_architecture.md](/Users/kofibright/yenkasaChat/yenkasa-ai/backend/docs/auth_architecture.md)
- [vector_search.md](/Users/kofibright/yenkasaChat/yenkasa-ai/backend/docs/vector_search.md)

Local verification:

```bash
python3 -m compileall app api services
python3 -m unittest discover -s tests
```
