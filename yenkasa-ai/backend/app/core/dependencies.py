from __future__ import annotations

from fastapi import HTTPException
from fastapi import Request


def get_intelligence_runtime(request: Request):
    runtime = getattr(request.app.state, "intelligence_runtime", None)
    if runtime is None:
        raise HTTPException(status_code=503, detail="Dev intelligence runtime is not ready.")
    return runtime
