# Yenkasa Identity Layer

The identity layer is designed as a reusable FastAPI module set:

- `auth`: registration, login, refresh, logout, `/me`
- `users`: user persistence and profile stats
- `sessions`: refresh-token rotation, active session control, suspicious login signals
- `security`: password hashing, JWT creation, role checks, rate limiting, security alerts
- `tracking`: conversation storage and AI usage accounting
- `yme`: long-term memory event feed
- `analytics`: admin intelligence over users, sessions, and AI usage

Why this fits Cloud Run:

- API instances stay stateless
- JWT carries short-lived access context
- MongoDB persists identity and conversation data
- Redis handles rate limits and worker queue load
- refresh token state lives in MongoDB sessions, not local memory
