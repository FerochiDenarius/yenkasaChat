# YME Phase 4 Production Hardening

## Node backend rollout

Required environment:

- `INTERNAL_PLATFORM_API_KEY`
- `YENKASA_AI_INTELLIGENCE_ENABLED=true`
- `YENKASA_AI_INTELLIGENCE_URL=https://yenkasa-ai-backend-496173204476.europe-west1.run.app`
- `REDIS_URL` or `YENKASA_REDIS_URL`
- `YENKASA_YME_QUEUE_MODE=bullmq`
- `YENKASA_AI_BRIDGE_QUEUE_PREFIX=yme_bridge`
- `YENKASA_AI_BRIDGE_BATCH_SIZE=25`
- `YENKASA_AI_BRIDGE_MAX_ATTEMPTS=4`
- `YENKASA_AI_BRIDGE_BACKOFF_MS=5000`
- `YENKASA_AI_BRIDGE_CONCURRENCY=3`
- `YENKASA_AI_BRIDGE_TIMEOUT_MS=8000`

PM2 topology:

- `yenkasa-app-backend`
- `yenkasa-yme-worker`
- `yenkasa-moderation-worker`

The API process disables inline YME/moderation workers so queue processing happens in dedicated worker processes.

## Bridge queues

BullMQ queues:

- `ymeIntelligenceBridgeEventQueue`
- `ymeIntelligenceBridgeLogQueue`
- `ymeIntelligenceBridgeDeadLetterQueue`

Flow:

1. App publishes structured platform events.
2. Event bus writes observability state to Mongo.
3. Durable bridge jobs are queued in Redis.
4. YME worker process sends event/log batches to Cloud Run.
5. Final failures move to the dead-letter queue for replay.

## FastAPI rollout

Required environment:

- `INTERNAL_PLATFORM_API_KEY`
- `REDIS_URL`
- `MONGODB_URI`
- `INTERNAL_PLATFORM_BATCH_RATE_LIMIT`
- `INTERNAL_PLATFORM_HEALTH_RATE_LIMIT`

Cloud Run health:

- `GET /api/internal/platform/health`

Protected ingestion:

- `POST /api/internal/platform/events/batch`
- `POST /api/internal/platform/logs/batch`

All internal platform routes require `X-Internal-Api-Key`.
