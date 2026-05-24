from __future__ import annotations

from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request


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
