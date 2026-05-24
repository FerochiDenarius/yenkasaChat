from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware


class AuthContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request.state.current_user = None
        request.state.current_session = None
        request.state.auth_error = None
        authorization = request.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
            runtime = getattr(request.app.state, "intelligence_runtime", None)
            if runtime is not None and getattr(runtime, "auth", None) is not None:
                try:
                    user, session = await runtime.auth.resolve_access_token(token)
                    request.state.current_user = user
                    request.state.current_session = session
                except Exception as exc:
                    request.state.auth_error = str(exc)
        response = await call_next(request)
        return response
