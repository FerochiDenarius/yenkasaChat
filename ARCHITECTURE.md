# Architecture

## Runtime boundaries

The Node.js backend follows this flow:

```text
HTTP request
  -> request context / security middleware
  -> route
  -> controller
  -> service
  -> model or external provider
```

`src/app.js` builds the application and is testable without opening a port. `src/server.js` owns process startup, database connection, workers, Socket.IO, and graceful deployment behavior.

Cross-cutting concerns belong in middleware or `src/observability`: request IDs, structured logs, metrics, CORS, validation, and error translation should not be duplicated in individual routes.

## Android chat migration

The target boundary is:

```text
ChatActivity -> ChatViewModel -> ChatRepository -> Retrofit/WebSocket/cache
```

The Activity owns lifecycle, permissions, navigation, and rendering. The ViewModel owns screen state and user intents. The repository owns network, socket, and cache coordination. Existing controllers can be migrated behind the repository incrementally without changing the public chat behavior.

## Operational endpoints

- `/health` — process liveness.
- `/health/ready` — dependency readiness.
- `/metrics` — request counters and durations for monitoring.
