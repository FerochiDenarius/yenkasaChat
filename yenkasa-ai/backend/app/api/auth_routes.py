from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request

from app.core.dependencies import get_intelligence_runtime
from app.modules.auth.service import user_to_response
from app.modules.security import require_current_user
from app.schemas import AuthLoginRequest
from app.schemas import AuthRefreshRequest
from app.schemas import AuthRegisterRequest
from app.schemas import AuthTokenResponse
from app.schemas import CurrentUserResponse
from app.schemas import LogoutResponse
from app.utils import get_client_ip
from app.utils import get_user_agent


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthTokenResponse)
async def register(payload: AuthRegisterRequest, request: Request, runtime=Depends(get_intelligence_runtime)) -> AuthTokenResponse:
    try:
        return await runtime.auth.register(payload, ip_address=get_client_ip(request), user_agent=get_user_agent(request))
    except ValueError as exc:
        status_code = 429 if "too many" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: AuthLoginRequest, request: Request, runtime=Depends(get_intelligence_runtime)) -> AuthTokenResponse:
    try:
        return await runtime.auth.login(payload, ip_address=get_client_ip(request), user_agent=get_user_agent(request))
    except ValueError as exc:
        status_code = 429 if "too many" in str(exc).lower() else 401
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    current_user=Depends(require_current_user),
    runtime=Depends(get_intelligence_runtime),
) -> LogoutResponse:
    _ = current_user
    current_session = getattr(request.state, "current_session", None)
    if current_session is None:
        raise HTTPException(status_code=401, detail="Active session is required.")
    await runtime.auth.logout(current_session.session_id)
    return LogoutResponse(status="logged_out")


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh(payload: AuthRefreshRequest, runtime=Depends(get_intelligence_runtime)) -> AuthTokenResponse:
    try:
        return await runtime.auth.refresh(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.get("/me", response_model=CurrentUserResponse)
async def me(current_user=Depends(require_current_user)) -> CurrentUserResponse:
    return user_to_response(current_user)
