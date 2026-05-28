from __future__ import annotations

import asyncio
import inspect
import logging
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException


LOGGER = logging.getLogger("yenkasa_ai_cloud.ai_pipeline")


async def resolve_awaitable(value: Any, *, label: str) -> Any:
    depth = 0
    while inspect.isawaitable(value):
        depth += 1
        LOGGER.warning(
            "Awaitable leaked through AI pipeline label=%s depth=%s type=%s",
            label,
            depth,
            type(value),
        )
        value = await value
    return value


async def invoke_ai_callable(callable_obj: Callable[..., Any], *args: Any, label: str, **kwargs: Any) -> Any:
    if inspect.iscoroutinefunction(callable_obj):
        result = await callable_obj(*args, **kwargs)
    else:
        result = await asyncio.to_thread(callable_obj, *args, **kwargs)
    return await resolve_awaitable(result, label=label)


async def ensure_response_shape(
    response: Any,
    *,
    label: str,
    required_attr: str,
    expected_type: type[Any] | None = None,
) -> Any:
    response = await resolve_awaitable(response, label=f"{label}.response")
    LOGGER.info(f"Response type: {type(response)}")

    if response is None:
        raise HTTPException(status_code=500, detail="Empty AI response")

    if not hasattr(response, required_attr):
        raise HTTPException(status_code=500, detail="Invalid AI response structure")

    value = await resolve_awaitable(getattr(response, required_attr), label=f"{label}.{required_attr}")
    if expected_type is not None and not isinstance(value, expected_type):
        raise HTTPException(status_code=500, detail="Invalid AI response structure")

    try:
        setattr(response, required_attr, value)
    except Exception:
        LOGGER.debug("Could not normalize response attribute label=%s attr=%s", label, required_attr, exc_info=True)

    return response
