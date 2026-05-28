from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


LOGGER = logging.getLogger("yenkasa_ai_cloud.errors")


def _error_payload(request: Request, error: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "success": False,
        "error": error,
    }
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        payload["request_id"] = request_id
    return payload


def _error_headers(request: Request) -> dict[str, str]:
    request_id = getattr(request.state, "request_id", None)
    if not request_id:
        return {}
    return {"x-request-id": str(request_id)}


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    logger_method = LOGGER.error if exc.status_code >= 500 else LOGGER.warning
    logger_method(
        "HTTP exception request_id=%s method=%s path=%s status_code=%s detail=%s",
        getattr(request.state, "request_id", None),
        request.method,
        request.url.path,
        exc.status_code,
        detail,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(request, detail),
        headers=_error_headers(request),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    LOGGER.warning(
        "Validation exception request_id=%s method=%s path=%s errors=%s",
        getattr(request.state, "request_id", None),
        request.method,
        request.url.path,
        exc.errors(),
    )
    return JSONResponse(
        status_code=422,
        content=_error_payload(request, "Invalid request payload"),
        headers=_error_headers(request),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    LOGGER.exception(
        "Unhandled application exception request_id=%s method=%s path=%s",
        getattr(request.state, "request_id", None),
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content=_error_payload(request, "AI processing failed"),
        headers=_error_headers(request),
    )
