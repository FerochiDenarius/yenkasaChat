# Yenkasa Chat

Yenkasa Chat is a multi-client social chat platform with Android, web, and Node.js backend applications.

## Repository layout

- `app/` — Android application.
- `yenkasaChatBackend/RegLoginBackend/` — Express, MongoDB, Socket.IO, and worker services.
- `yenkasa-web/` — Vite/React web client.
- `yenkasa_knowledge/` — product and operational reference material.

## Requirements

- Node.js 20
- Java 17 and Android SDK for the Android project
- MongoDB for normal backend operation

## Setup

```bash
cp yenkasaChatBackend/RegLoginBackend/.env.example yenkasaChatBackend/RegLoginBackend/.env
npm ci --prefix yenkasaChatBackend/RegLoginBackend
npm ci --prefix yenkasa-web
```

Never commit `.env` files or real credentials. The backend environment contract is documented in the backend `.env.example` file.

## Development

```bash
npm --prefix yenkasaChatBackend/RegLoginBackend run dev
npm --prefix yenkasa-web run dev
```

The backend exposes `/health` for liveness, `/health/ready` for dependency readiness, and `/metrics` in Prometheus text format.

## Verification

```bash
npm run test:backend
npm run test:backend:coverage
npm run lint:backend
npm run format:check
npm run build:web
./gradlew test
```

These checks also run in GitHub Actions for pushes and pull requests.

## Architecture

The backend separates route registration, controllers, services, models, workers, and cross-cutting middleware. The Android chat feature is being migrated toward a ViewModel/repository boundary so Activities focus on rendering and lifecycle events. See `ARCHITECTURE.md` for the current boundaries and planned migration.

## Security

Authentication secrets, storage credentials, email credentials, and provider keys must be injected through the environment or deployment secret manager. Input validation, allowlisted CORS, Helmet, request IDs, structured logs, and dependency auditing are part of the application baseline.

## Contributing

Read `CONTRIBUTING.md` before opening a pull request.
