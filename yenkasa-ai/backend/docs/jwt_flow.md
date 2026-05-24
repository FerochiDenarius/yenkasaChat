# JWT Flow

1. `POST /api/auth/register` or `POST /api/auth/login`
2. Backend creates a session document and returns:
   - access token
   - refresh token
   - session id
3. Client sends `Authorization: Bearer <access_token>` on AI requests.
4. `AuthContextMiddleware` decodes the token, validates the session, and injects `current_user`.
5. Protected routes enforce auth and role rules.
6. `POST /api/auth/refresh` rotates the refresh token JTI and returns a fresh pair.
7. `POST /api/auth/logout` revokes the current session.

Security posture:

- access tokens are short-lived
- refresh tokens are rotated
- refresh token reuse is blocked by stored `refresh_jti`
- admin routes require `admin` or `super_admin`
