# MongoDB Atlas Vector Search

Repository chunks live in the `repo_chunks` collection with:

- `repo_name`
- `file_path`
- `language`
- `chunk_index`
- `total_chunks`
- `last_modified`
- `hash`
- `content`
- `embedding`
- `start_line`
- `end_line`
- `symbol_names`

Search strategy:

- semantic retrieval via Atlas `$vectorSearch`
- regex fallback against `content` and `file_path`
- result deduplication by repo/file/chunk
- repo-level filtering through `repo_name`

The reference Atlas index definition lives in [mongodb/repo_chunks_vector_index.json](/Users/kofibright/yenkasaChat/yenkasa-ai/backend/mongodb/repo_chunks_vector_index.json).

Operational note:

- set `MONGODB_VECTOR_DIMENSIONS` to match the configured embedding model output
- Cloud Run startup attempts automatic vector index creation, but Atlas permissions may require manual creation
