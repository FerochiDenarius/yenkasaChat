# Yenkasa Memory Engine (YME) Phase 1

## High-Level Architecture

YME is a shared memory layer for the Yenkasa social app and Yenkasa-AI. Phase 1 keeps everything inside the current Node.js backend, but isolates the module under `src/yme` so it can later be extracted into its own service without changing API contracts.

Core flow:

1. App or AI emits a user event to `/api/yme/events`.
2. The backend stores the raw event in `user_events`.
3. BullMQ dispatches the event to YME workers.
4. Workers:
   - normalize activity into memory signals
   - update `user_memory`
   - update `engagement_patterns`, `creator_affinity`, `social_graph`, `recommendation_signals`, and `ai_profiles`
   - build chat summaries
   - generate Gemini embeddings through Vertex AI
   - store embeddings in `memory_embeddings`
5. Retrieval queries blend:
   - recent short-term context
   - mid-term chat summaries
   - long-term interests and affinity
   - semantic matches from MongoDB Vector Search

## Folder Structure

```text
src/yme/
  config/
    yme.config.js
    vectorIndexes.js
  controllers/
    yme.controller.js
  models/
    aiProfile.model.js
    chatSummary.model.js
    creatorAffinity.model.js
    engagementPattern.model.js
    memoryEmbedding.model.js
    memoryLog.model.js
    recommendationSignal.model.js
    socialGraph.model.js
    userEvent.model.js
    userMemory.model.js
  routes/
    index.js
  services/
    activitySummarizer.service.js
    chatMemoryBridge.service.js
    consolidation.service.js
    embedding.service.js
    eventIngestion.service.js
    interestExtraction.service.js
    log.service.js
    memoryProfile.service.js
    metrics.service.js
    queue.service.js
    recommendationSignals.service.js
    retrieval.service.js
    vectorSearch.service.js
  utils/
    yme.utils.js
  workers/
    yme.worker.js
```

## MongoDB Collections

Phase 1 creates these collections:

- `user_events`: raw normalized product and AI behavior events
- `user_memory`: unified short/mid/long-term memory profile per user
- `memory_embeddings`: Gemini embeddings for events, summaries, and profile memory
- `chat_summaries`: rolling chat summaries for Yenkasa-AI memory
- `engagement_patterns`: activity histograms and watch behavior
- `creator_affinity`: user-to-creator preference scores
- `social_graph`: user-to-user edge strength and relationship metadata
- `recommendation_signals`: future feed-ranking features per user/entity
- `ai_profiles`: AI-facing preference and tone profile per user
- `memory_logs`: YME pipeline logs and audit trail

## Event Pipeline Design

Supported event families in Phase 1:

- likes
- comments
- shares
- follows
- watch time
- scroll duration
- profile visits
- searches
- chats
- captions
- creator interactions
- ad engagement
- notification opens
- live stream interactions

Pipeline behavior:

1. `eventIngestion.service.js` validates and stores the raw event.
2. `queue.service.js` enqueues the event for async processing.
3. `consolidation.service.js` derives signals and updates memory state.
4. `recommendationSignals.service.js` updates affinity and feed features.
5. `activitySummarizer.service.js` produces deterministic chat/activity summaries.
6. `embedding.service.js` sends text to Vertex AI `gemini-embedding-001`.
7. `vectorSearch.service.js` stores embeddings and performs semantic retrieval.

## Gemini Embedding Integration Strategy

Phase 1 uses Vertex AI text embeddings through the publisher REST endpoint for `gemini-embedding-001`.

- Document memory uses `task_type=RETRIEVAL_DOCUMENT`.
- Retrieval queries use `task_type=RETRIEVAL_QUERY`.
- The implementation assumes one input text per request for `gemini-embedding-001`.
- Output dimensionality is configurable with `YENKASA_YME_EMBEDDING_DIMENSIONS` and defaults to `768`.
- Cloud Run should inject Google credentials through the runtime service account and Secret Manager-backed environment variables.

Relevant references:

- Vertex AI text embeddings API: `gemini-embedding-001` REST predict endpoint, one text per request, and retrieval task types. Source: <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api>
- Task type guidance for `RETRIEVAL_QUERY` and `RETRIEVAL_DOCUMENT`. Source: <https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/task-types>

## MongoDB Vector Search Strategy

YME stores semantic memory in `memory_embeddings` and queries it with `$vectorSearch`.

Index strategy:

- one primary vector index on `memory_embeddings.embedding`
- filter fields on `userId`, `memoryTier`, `sourceType`, and `sourceApp`
- similarity defaults to `cosine`
- `numDimensions` must match the configured embedding size

Relevant references:

- Atlas vector index definition format, `fields`, `numDimensions`, and filter fields. Source: <https://www.mongodb.com/docs/vector-search/index/vector-search-type/>
- `$vectorSearch` requirements that query vectors use the same model and dimensions as indexed data. Source: <https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch/>

## BullMQ Queue Architecture

Phase 1 queues:

- `ymeEventIngestionQueue`
- `ymeEmbeddingQueue`
- `ymeConsolidationQueue`
- `ymeChatSummaryQueue`

Recommended worker deployment:

- Cloud Run service handles HTTP ingress.
- Separate Cloud Run worker process runs `npm run worker:yme`.
- Upstash Redis or Memorystore provides the BullMQ backend.

## API Endpoints

User-scoped:

- `POST /api/yme/events`
- `POST /api/yme/events/batch`
- `GET /api/yme/profile/:userId`
- `POST /api/yme/retrieve`
- `POST /api/yme/consolidate/:userId`

Analytics/admin:

- `GET /api/yme/admin/events`
- `GET /api/yme/admin/logs`
- `GET /api/yme/admin/metrics`
- `GET /api/yme/admin/indexes`

Health:

- `GET /api/yme/health`

## Example Event Payloads

Single engagement event:

```json
{
  "eventType": "watch",
  "sourceApp": "social_app",
  "userId": "6650d4f6f6894a0f7bb8f001",
  "contentId": "post:abc123",
  "creatorId": "6650d4f6f6894a0f7bb8f002",
  "watchTimeMs": 32000,
  "categories": ["technology", "startups"],
  "caption": "Watched an AI startup explainer",
  "occurredAt": "2026-05-24T09:15:00.000Z"
}
```

AI chat turn batch:

```json
{
  "events": [
    {
      "eventType": "chat_message",
      "sourceApp": "yenkasa_ai",
      "userId": "6650d4f6f6894a0f7bb8f001",
      "conversationId": "conv_123",
      "message": "I want to find creator tips for selling handmade bags."
    },
    {
      "eventType": "chat_response",
      "sourceApp": "yenkasa_ai",
      "userId": "6650d4f6f6894a0f7bb8f001",
      "conversationId": "conv_123",
      "message": "You seem interested in handmade commerce and creator growth."
    }
  ]
}
```

## Example Retrieval Flow

1. User sends a Yenkasa-AI question.
2. `chatMemoryBridge.service.js` asks YME for memory context with the latest query.
3. `retrieval.service.js` loads:
   - unified `user_memory`
   - latest `chat_summaries`
   - semantic matches from `memory_embeddings`
4. The AI system prompt receives a compact context block with recent intent, stable interests, and relevant past activity.
5. After the assistant replies, the AI chat bridge writes chat events back into YME.

## Environment Variables

Required:

- `MONGODB_URI`
- `ACCESS_TOKEN_SECRET`
- `REDIS_URL` or `YENKASA_REDIS_URL`
- `YENKASA_GCP_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT`
- `YENKASA_VERTEX_LOCATION`
- `YENKASA_GEMINI_EMBEDDING_MODEL`

Recommended:

- `YENKASA_YME_EMBEDDINGS_ENABLED=true`
- `YENKASA_YME_EMBEDDING_DIMENSIONS=768`
- `YENKASA_YME_VECTOR_SEARCH_ENABLED=true`
- `YENKASA_YME_VECTOR_INDEX_NAME=yme_memory_embeddings_vector_index`
- `YENKASA_YME_QUEUE_ENABLED=true`
- `YENKASA_YME_QUEUE_MODE=bullmq`
- `YENKASA_YME_QUEUE_PREFIX=yme`
- `YENKASA_ENABLE_INLINE_YME_WORKERS=true`
- `YENKASA_YME_ENABLE_AI_CHAT_BRIDGE=true`
- `YENKASA_YME_BATCH_LIMIT=100`
- `YENKASA_YME_RETRIEVAL_LIMIT=8`

## Setup Instructions

Install backend dependencies:

```bash
cd yenkasaChatBackend/RegLoginBackend
npm install
```

Run the API:

```bash
npm run dev
```

Run YME workers:

```bash
npm run worker:yme
```

Create the Atlas Vector Search index using the JSON returned by:

```bash
GET /api/yme/admin/indexes
```

## Future Phase 2 Recommendations

- Add LLM-based summarization for higher-quality chat and behavioral memory compression.
- Introduce OCR and speech-to-text event enrichment for multimodal memory.
- Add scheduled consolidation and stale-interest decay jobs.
- Publish YME memory updates to Socket.IO rooms once clients subscribe to per-user memory channels.
- Feed `recommendation_signals` into a dedicated ranking service for creator and content recommendations.
