from __future__ import annotations

import asyncio
import time

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import Request
from fastapi import UploadFile

from app.models import ChatRequest
from app.models import ChatResponse
from app.models import HealthResponse
from app.models import IngestResponse
from app.models import SearchRequest
from app.models import SearchResponse
from app.modules.security import require_current_user
from app.modules.security import require_roles


router = APIRouter()


def get_runtime(request: Request):
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise HTTPException(status_code=503, detail="YenkasaAI backend is not ready.")
    return runtime


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    runtime = get_runtime(request)
    return runtime.health()


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request, current_user=Depends(require_current_user)) -> ChatResponse:
    runtime = get_runtime(request)
    intelligence_runtime = getattr(request.app.state, "intelligence_runtime", None)
    current_session = getattr(request.state, "current_session", None)
    if intelligence_runtime is None or current_session is None:
        raise HTTPException(status_code=503, detail="Authenticated AI runtime is not ready.")

    try:
        await intelligence_runtime.security.enforce_rate_limit(
            key=f"ai:chat:{current_user.user_id}",
            limit=intelligence_runtime.settings.ai_request_rate_limit,
            window_s=60,
            error_message="AI usage rate limit exceeded.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    started = time.perf_counter()
    response = await asyncio.to_thread(runtime.chat, payload)
    duration_ms = int((time.perf_counter() - started) * 1000)
    await intelligence_runtime.tracking.track_interaction(
        user=current_user,
        session=current_session,
        feature="chat",
        request_path=str(request.url.path),
        prompt=payload.question,
        response_text=response.answer,
        response_time_ms=duration_ms,
        model_used=runtime.settings.vertex_model,
        metadata={"audience": payload.audience},
    )
    return response


@router.post("/search", response_model=SearchResponse)
async def search(payload: SearchRequest, request: Request, current_user=Depends(require_current_user)) -> SearchResponse:
    runtime = get_runtime(request)
    intelligence_runtime = getattr(request.app.state, "intelligence_runtime", None)
    current_session = getattr(request.state, "current_session", None)
    if intelligence_runtime is None or current_session is None:
        raise HTTPException(status_code=503, detail="Authenticated AI runtime is not ready.")

    try:
        await intelligence_runtime.security.enforce_rate_limit(
            key=f"ai:search:{current_user.user_id}",
            limit=intelligence_runtime.settings.ai_request_rate_limit,
            window_s=60,
            error_message="AI usage rate limit exceeded.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    started = time.perf_counter()
    response = await asyncio.to_thread(runtime.search, payload)
    duration_ms = int((time.perf_counter() - started) * 1000)
    await intelligence_runtime.tracking.track_interaction(
        user=current_user,
        session=current_session,
        feature="search",
        request_path=str(request.url.path),
        prompt=payload.question,
        response_text="\n".join(source.title for source in response.sources),
        response_time_ms=duration_ms,
        model_used=runtime.settings.embedding_model,
        metadata={"audience": payload.audience, "count": response.count},
    )
    return response


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    request: Request,
    files: list[UploadFile] = File(...),
    audience: str = "public",
    developer=Depends(require_roles("developer", "senior_developer", "admin", "super_admin")),
) -> IngestResponse:
    _ = developer
    runtime = get_runtime(request)
    return await runtime.ingest(files=files, audience=audience)
