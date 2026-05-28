from __future__ import annotations

import secrets

from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request

from app.config import get_settings


def require_current_user(request: Request):
    auth_error = getattr(request.state, "auth_error", None)
    if auth_error:
        raise HTTPException(status_code=401, detail=str(auth_error))
    current_user = getattr(request.state, "current_user", None)
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return current_user


def require_roles(*roles: str):
    def _dependency(current_user=Depends(require_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions.")
        return current_user

    return _dependency


def require_admin_user(current_user=Depends(require_roles("admin", "super_admin"))):
    return current_user


def require_event_ingest_access(request: Request):
    auth_error = getattr(request.state, "auth_error", None)
    current_user = getattr(request.state, "current_user", None)
    if current_user is not None:
        return {"mode": "user", "user": current_user}

    provided_api_key = request.headers.get("x-event-api-key", "").strip()
    settings = get_settings()
    accepted_keys = [
        settings.internal_platform_api_key.strip(),
        settings.log_ingest_api_key.strip(),
    ]
    accepted_keys = [key for key in accepted_keys if key]

    if provided_api_key and accepted_keys:
        if any(secrets.compare_digest(provided_api_key, key) for key in accepted_keys):
            return {"mode": "event_api_key", "user": None}

    if auth_error:
        raise HTTPException(status_code=401, detail=str(auth_error))
    raise HTTPException(status_code=401, detail="Authentication required.")
