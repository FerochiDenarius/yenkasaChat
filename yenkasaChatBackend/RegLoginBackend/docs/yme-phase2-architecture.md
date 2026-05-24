# Yenkasa Memory Engine Phase 2

## Scope

Phase 2 connects real behavioral product events into YME without adding new infrastructure beyond:

- Node.js + Express
- MongoDB Atlas + Vector Search
- BullMQ + Redis
- Vertex AI Gemini embeddings
- Android client batching with Room + WorkManager

This phase does **not** add recommendation ML, advanced affect modeling, or custom model training.

## Implemented Architecture

### Backend ingestion hardening

- `src/yme/services/importanceScoring.service.js`
  Assigns `importanceScore`, `importanceBand`, and reason strings from event type, text richness, watch time, dwell time, rewatchs, and commerce hints.
- `src/yme/services/embeddingPolicy.service.js`
  Decides whether an event should be embedded directly or only influence summaries/profile state.
- `src/yme/services/eventGuard.service.js`
  Adds duplicate detection, low-value throttling, `fingerprint`, and `dedupeKey`.
- `src/yme/middleware/yme.middleware.js`
  Adds payload validation and route-level abuse protection for `/api/yme/events`, `/api/yme/events/batch`, and `/api/yme/retrieve`.

### Event processing behavior

- Low-value duplicate events are skipped before persistence.
- Important events are scored and annotated on `user_events`.
- Direct embedding is restricted to higher-signal text events such as:
  - captions
  - meaningful chat messages
  - creator interaction text
  - community join narratives
- Low-signal events still update memory profiles and recommendation signals, but no longer trigger direct embeddings by default.

### Embedding pipeline

- `src/yme/services/embedding.service.js`
  Uses **Vertex AI Gemini embeddings only**.
- Supports batched requests and a process-level request interval gate.
- Embedding jobs stay isolated on `ymeEmbeddingQueue`.
- `src/yme/services/vectorSearch.service.js`
  Adds `contentHash` caching so repeated source text does not regenerate embeddings unnecessarily.

### Observability

New backend inspection surfaces:

- `GET /api/yme/admin/queue-health`
- `GET /api/yme/admin/embeddings`
- `GET /api/yme/admin/failed-embeddings`
- `POST /api/yme/admin/retrieve-inspect`
- existing:
  - `GET /api/yme/admin/events`
  - `GET /api/yme/admin/logs`
  - `GET /api/yme/admin/metrics`
  - `GET /api/yme/profile/:userId`

## Android Integration Structure

Android YME package:

```text
app/src/main/java/xyz/yenkasa/app/yme/
  YmeModels.kt
  YmeQueuedEventEntity.kt
  YmeEventDao.kt
  YmeEventDatabase.kt
  YmeSessionManager.kt
  YmeEventQueue.kt
  YmeEventWorker.kt
  YmeEventTracker.kt
  YmeAnalyticsManager.kt
```

### Android responsibilities

- `YmeSessionManager`
  Maintains app session ids with idle expiry.
- `YmeEventTracker`
  Creates normalized YME events, adds client ids, applies lightweight in-memory dedupe, and queues them.
- `YmeEventQueue`
  Persists offline events in Room and flushes them in batches.
- `YmeEventWorker`
  Flushes queued events through WorkManager when network is available.
- `YmeAnalyticsManager`
  Exposes product-level tracking helpers such as:
  - `trackPostView`
  - `trackWatchDuration`
  - `trackNotificationOpen`
  - `trackLiveStreamJoin`
  - `trackRawEvent`

### Current Android hooks

- `MyApplication.kt`
  - initializes YME
  - tracks `notification_open`
- `YenkasaPlayerFeedAdapter.kt`
  - tracks `post_view` / `video_watch`
  - tracks `watch_duration` from real dwell time

## Event Lifecycle

### Feed event lifecycle

1. User lands on a feed item.
2. `YenkasaPlayerFeedAdapter` calls `YmeAnalyticsManager.trackPostView(...)`.
3. `YmeEventTracker` adds `sessionId`, `clientEventId`, dedupe fingerprint, and local queue persistence.
4. `YmeEventQueue` stores the event in Room.
5. `YmeEventWorker` flushes queued events to `POST /api/yme/events/batch`.
6. Backend middleware validates and rate-limits the request.
7. `eventGuard.service` skips duplicates or throttles low-value floods.
8. `importanceScoring.service` assigns `importanceScore`.
9. `consolidation.service` updates memory/profile signals.
10. If allowed by `embeddingPolicy.service`, a separate embedding job is queued.

### Chat event lifecycle

1. User sends a message through backend `routes/messages.routes.js`.
2. Backend publishes `chat_message` into YME.
3. Event processing updates user memory and recommendation signals.
4. Rolling chat summaries are updated.
5. Only meaningful chat text is eligible for direct embedding.

### Notification event lifecycle

1. User opens a push notification.
2. `MyApplication.kt` tracks `notification_open`.
3. Event is queued offline if needed and flushed later.
4. Backend stores and scores the event.

## Memory Scoring Strategy

Event importance currently combines:

- base event-type score
- text richness
- interest candidate count
- watch time
- dwell time
- rewatch behavior
- skip speed penalty
- engagement value
- commerce/business hints

Bands:

- `low` below configured medium threshold
- `medium` above `YENKASA_YME_IMPORTANCE_MEDIUM_THRESHOLD`
- `high` above `YENKASA_YME_IMPORTANCE_HIGH_THRESHOLD`

## Vertex AI Embedding Optimization Strategy

Rules in effect:

- Only Vertex AI Gemini embeddings are used.
- Event embeddings are selective, not blanket.
- Memory summaries and chat summaries remain primary embedding sources.
- Direct event embeddings are reserved for higher-signal text events.
- Repeated source text reuses cached embeddings via `contentHash`.
- Embedding jobs are isolated in BullMQ and rate-limited by worker limiter plus request interval gate.

## Updated Backend Schemas

### `user_events`

New fields:

- `clientEventId`
- `fingerprint`
- `dedupeKey`
- `importanceScore`
- `importanceReason`
- `shouldEmbed`
- `embeddingPriority`
- `summaryEligible`
- `duplicateCount`
- `lastDuplicateAt`
- `processingNotes`
- new feed metadata:
  - `feedDwellMs`
  - `scrollSpeed`
  - `skipSpeed`
  - `rewatchCount`
  - `impressionId`
  - `appVersion`

### `memory_embeddings`

New fields:

- `contentHash`
- `cacheHitCount`

## Updated APIs

### Client ingestion

- `POST /api/yme/events`
- `POST /api/yme/events/batch`
- `POST /api/yme/retrieve`

### Admin inspection

- `GET /api/yme/admin/events`
- `GET /api/yme/admin/logs`
- `GET /api/yme/admin/metrics`
- `GET /api/yme/admin/indexes`
- `GET /api/yme/admin/queue-health`
- `GET /api/yme/admin/embeddings`
- `GET /api/yme/admin/failed-embeddings`
- `POST /api/yme/admin/retrieve-inspect`

## Safe Rollout Strategy

### Stage 1

- Keep Android event tracking limited to:
  - feed views
  - watch duration
  - notification opens
- Keep server-side behavior events enabled for:
  - likes
  - comments
  - shares
  - follows
  - searches
  - profile visits
  - messages

### Stage 2

- Add more client hooks:
  - live stream join
  - reward claim
  - community join
  - creator interaction

### Stage 3

- Add scheduled consolidation cadence
- add a simple internal inspector UI on top of admin JSON endpoints
- add client feature flags for YME rollout percentages

## Remaining Phase 2 Work

- add more Android screen integrations beyond feed + notifications
- add client-side hooks for live streams, rewards, and communities
- expose a simple internal HTML inspector or admin page
- tune queue limits and thresholds from production metrics
- optionally add retrieval request logging for deeper prompt-debug audits
