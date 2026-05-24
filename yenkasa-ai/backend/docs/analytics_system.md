# Analytics System

Admin analytics endpoints:

- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/usage`
- `GET /api/admin/analytics/users`
- `GET /api/admin/users`
- `GET /api/admin/active-sessions`
- `GET /api/admin/ai-usage`
- `GET /api/admin/security-alerts`

Computed metrics include:

- daily active AI users
- prompt volume
- average session duration
- total token usage
- most used AI features
- most active users
- coding language preferences
- security alert frequency

These analytics are derived from MongoDB conversation, session, YME, and security collections so they remain Cloud Run-compatible.
