from __future__ import annotations

from typing import Any


def get_client_ip(request: Any) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def get_user_agent(request: Any) -> str | None:
    return request.headers.get("user-agent")
