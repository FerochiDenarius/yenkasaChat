from __future__ import annotations

import logging
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware


LOGGER = logging.getLogger("yenkasa_ai_cloud.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        LOGGER.info(
            "request received request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        response = await call_next(request)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        current_user = getattr(request.state, "current_user", None)
        user_id = getattr(current_user, "user_id", None)
        response.headers["x-request-id"] = request_id
        LOGGER.info(
            "request_id=%s user_id=%s method=%s path=%s status_code=%s duration_ms=%s",
            request_id,
            user_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response
