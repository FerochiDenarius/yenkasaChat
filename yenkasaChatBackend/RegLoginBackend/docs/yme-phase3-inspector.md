# YME Phase 3: Inspector and Behavioral Signal Calibration

## Objective

Phase 3 keeps YME in a visibility-first mode. The goal is to inspect memory quality, validate retrieval quality, understand behavioral signals, and protect cost/performance before any recommendation logic is added.

## Inspector dashboard architecture

- Read-only internal page at `/yme-inspector`.
- Uses `GET /api/yme/admin/inspector` for a combined system + user inspection payload.
- Admin access is enforced by `analyticsAccess`.
- The dashboard is intentionally simple: search by user ID, optional retrieval query, and a small set of sections that surface the full state of YME.

## Signal calibration strategy

- High-signal events are scored higher when they show strong intent, longer dwell, repeated engagement, or creator/community affinity.
- Weak or noisy signals are down-weighted when they are repetitive, duplicated, short, or clearly low intent.
- `signalStrengthScore` is computed per event type from recent event samples and is used to separate:
  - strongest signals
  - weak signals
  - noisy signals

### High-signal examples

- `watch_duration`
- `rewatch` / repeated watch behavior
- `comment`
- `share`
- `follow`
- `live_stream_join`
- `reward_claim`

### Weak/noisy examples

- `post_view`
- `notification_open`
- repeated low-value spam patterns
- duplicate bursts with minimal text or low intent

## Retrieval quality strategy

- Retrieval quality is measured independently from memory quantity.
- `retrievalQualityScore` combines:
  - relevance of the returned memories
  - duplicate retrieval rate
  - stale retrieval rate
  - retrieval latency
  - low-quality retrieval frequency

### Inspection focus

- Prefer fewer, better memories.
- Prune stale, low-importance memory before growing memory volume.
- Treat duplicate retrievals as a quality problem, not a success signal.

## Event quality analysis

- Dashboard metrics surface:
  - event throughput
  - duplicate suppression
  - queue health
  - failed embeddings
  - ingestion latency
  - retrieval latency
  - memory growth rate

- The event quality layer is used to identify which event types are useful enough to keep, and which ones should stay blocked or throttled.

## User interest profile generation flow

The interest profile is assembled from:

- watch behavior
- engagement patterns
- recurring topics
- creator interactions
- community interactions

### Output structure

```json
{
  "topInterests": [],
  "strongestCommunities": [],
  "strongestCreators": [],
  "activeHours": [],
  "engagementStyle": {}
}
```

### Strategy

- Keep interest profiles structured and sparse.
- Promote recurring topics only after they stabilize.
- Prefer behavioral evidence over single-event spikes.

## Production readiness report

Current report output includes:

1. current YME maturity assessment
2. scaling bottlenecks
3. MongoDB growth projections
4. Vertex AI cost pressure projections
5. queue scaling risks
6. rollout strategy
7. safe production checklist

### Maturity posture

- The system is in a production-hardening phase, not a recommendation phase.
- The correct goal is stability and observability, not broader AI complexity.

## Cost protection strategy

- Keep direct embedding gated by importance and summary eligibility.
- Keep the event queue, embedding queue, and consolidation queue separate.
- Keep embedding batching and request spacing in place.
- Keep retrieval caching via `contentHash`.
- Keep rate limits on events, batch ingestion, and retrieval.

## Memory optimization strategy

- Stale memory cleanup is done with retention windows and summary caps.
- Rolling summaries preserve signal while dropping raw noise.
- Duplicate memory merging keeps stable interests compact.
- Low-quality pruning removes old, low-importance material from retention.
- Archival logic should prefer summary text over raw event volume.

## Not in scope

- recommendation ML models
- predictive AI
- emotional AI
- moderation AI training
- creator AI ranking models

## Rollout rule

- Broaden capture only for event types that produce clear, high-signal memory value.
- If an event type does not improve retrieval or interest quality, do not ingest it by default.
