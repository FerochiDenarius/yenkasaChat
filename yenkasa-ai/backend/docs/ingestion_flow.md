# Repository Ingestion Flow

1. A developer calls `POST /api/repo/ingestions`.
2. The API validates the JWT, role, and repository path sandbox.
3. A job document is written to MongoDB and queued into Redis/RQ.
4. The worker loads the job, rescans the repository, and skips ignored paths.
5. Supported files are chunked with line overlap and metadata preservation.
6. Gemini embeddings are generated in batches with retries.
7. Chunks are upserted into MongoDB Atlas and indexed for vector search.
8. Repository insights are regenerated from the fresh chunk set.
9. Job status is updated in MongoDB for resumability and admin visibility.

Resumability details:

- each ingestion job keeps `processed_file_paths`
- files are skipped when the stored hash matches the current file hash
- `force_reingest=true` clears prior repo chunks and insights before reprocessing

Security constraints:

- repositories must live under `REPO_ALLOWED_ROOTS`
- scanning is read-only
- unsupported and binary files are skipped
- no shell execution is used during ingestion
