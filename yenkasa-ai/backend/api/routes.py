from __future__ import annotations

import logging
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
from app.core.ai_pipeline import ensure_response_shape
from app.core.ai_pipeline import invoke_ai_callable
from app.modules.security import require_current_user
from app.modules.security import require_roles


router = APIRouter()
LOGGER = logging.getLogger("yenkasa_ai_cloud.legacy_routes")


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

    request_id = getattr(request.state, "request_id", None)
    LOGGER.info(
        "provider selected request_id=%s route=%s provider=vertex_ai model=%s",
        request_id,
        request.url.path,
        runtime.settings.vertex_model,
    )
    crl_context = None
    if getattr(intelligence_runtime, "crl", None) is not None:
        crl_context = await intelligence_runtime.crl.build_context(
            payload.question,
            user_id=current_user.user_id,
        )
        if crl_context:
            LOGGER.info(
                "crl context prepared request_id=%s route=%s chars=%s",
                request_id,
                request.url.path,
                len(crl_context),
            )
    live_context = None
    if getattr(intelligence_runtime, "live_ops", None) is not None:
        live_context = await intelligence_runtime.live_ops.build_context(payload.question)
        if live_context:
            LOGGER.info(
                "live context prepared request_id=%s route=%s chars=%s",
                request_id,
                request.url.path,
                len(live_context),
            )
    extra_context = "\n\n".join(part for part in (crl_context, live_context) if part) or None
    started = time.perf_counter()
    LOGGER.info(
        "AI generation started request_id=%s route=%s user_id=%s audience=%s",
        request_id,
        request.url.path,
        current_user.user_id,
        payload.audience,
    )
    try:
        response = await invoke_ai_callable(runtime.chat, payload, extra_context=extra_context, label="legacy_chat")
        response = await ensure_response_shape(
            response,
            label="legacy_chat",
            required_attr="answer",
            expected_type=str,
        )
    except HTTPException:
        LOGGER.exception("AI generation failed request_id=%s route=%s", request_id, request.url.path)
        raise
    except Exception:
        LOGGER.exception("AI generation failed request_id=%s route=%s", request_id, request.url.path)
        raise
    duration_ms = int((time.perf_counter() - started) * 1000)
    LOGGER.info(
        "AI generation completed request_id=%s route=%s duration_ms=%s",
        request_id,
        request.url.path,
        duration_ms,
    )
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
    LOGGER.info(
        "response serialization completed request_id=%s route=%s answer_chars=%s source_count=%s",
        request_id,
        request.url.path,
        len(response.answer),
        len(getattr(response, "sources", [])),
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
    request_id = getattr(request.state, "request_id", None)
    LOGGER.info(
        "provider selected request_id=%s route=%s provider=vertex_ai model=%s",
        request_id,
        request.url.path,
        runtime.settings.embedding_model,
    )
    started = time.perf_counter()
    LOGGER.info(
        "AI generation started request_id=%s route=%s user_id=%s audience=%s",
        request_id,
        request.url.path,
        current_user.user_id,
        payload.audience,
    )
    try:
        response = await invoke_ai_callable(runtime.search, payload, label="legacy_search")
        response = await ensure_response_shape(
            response,
            label="legacy_search",
            required_attr="sources",
            expected_type=list,
        )
    except HTTPException:
        LOGGER.exception("AI generation failed request_id=%s route=%s", request_id, request.url.path)
        raise
    except Exception:
        LOGGER.exception("AI generation failed request_id=%s route=%s", request_id, request.url.path)
        raise
    duration_ms = int((time.perf_counter() - started) * 1000)
    LOGGER.info(
        "AI generation completed request_id=%s route=%s duration_ms=%s",
        request_id,
        request.url.path,
        duration_ms,
    )
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
    LOGGER.info(
        "response serialization completed request_id=%s route=%s source_count=%s",
        request_id,
        request.url.path,
        len(response.sources),
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
