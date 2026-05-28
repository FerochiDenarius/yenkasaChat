from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import Request

from app.core.ai_pipeline import ensure_response_shape
from app.core.ai_pipeline import invoke_ai_callable
from app.core.dependencies import get_intelligence_runtime
from app.modules.security import require_admin_user
from app.modules.security import require_current_user
from app.modules.security import require_roles
from app.schemas import EventIngestResponse
from app.schemas import EventRequest
from app.schemas import RecommendationsResponse
from app.schemas import RepoChatRequest
from app.schemas import RepoChatResponse
from app.schemas import RepoIngestionJobResponse
from app.schemas import RepoIngestionRequest
from app.schemas import RepoInsightsResponse
from app.schemas import RepoSearchResponse
from app.schemas import SystemComponentHealth
from app.schemas import SystemHealthResponse


router = APIRouter(prefix="/api", tags=["dev-intelligence"])
LOGGER = logging.getLogger("yenkasa_ai_cloud.intelligence_routes")


@router.post("/repo/ingestions", response_model=RepoIngestionJobResponse)
async def enqueue_repo_ingestion(
    payload: RepoIngestionRequest,
    developer=Depends(require_roles("developer", "senior_developer", "admin", "super_admin")),
    runtime=Depends(get_intelligence_runtime),
) -> RepoIngestionJobResponse:
    _ = developer
    try:
        return await runtime.repo_ingestion.enqueue(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/repo/ingestions/{job_id}", response_model=RepoIngestionJobResponse)
async def get_repo_ingestion_job(
    job_id: str,
    developer=Depends(require_roles("developer", "senior_developer", "admin", "super_admin")),
    runtime=Depends(get_intelligence_runtime),
) -> RepoIngestionJobResponse:
    _ = developer
    try:
        return await runtime.repo_ingestion.get_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/repo/search", response_model=RepoSearchResponse)
async def repo_search(
    request: Request,
    q: str = Query(min_length=1),
    repo_name: str | None = None,
    top_k: int | None = Query(default=None, ge=1, le=20),
    current_user=Depends(require_current_user),
    runtime=Depends(get_intelligence_runtime),
) -> RepoSearchResponse:
    current_session = getattr(request.state, "current_session", None)
    if current_session is None:
        raise HTTPException(status_code=401, detail="Active session is required.")
    try:
        await runtime.security.enforce_rate_limit(
            key=f"ai:repo-search:{current_user.user_id}",
            limit=runtime.settings.ai_request_rate_limit,
            window_s=60,
            error_message="AI usage rate limit exceeded.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    response = await runtime.repo_search.search(query=q, repo_name=repo_name, top_k=top_k)
    await runtime.tracking.track_interaction(
        user=current_user,
        session=current_session,
        feature="repo_search",
        request_path=str(request.url.path),
        prompt=q,
        response_text="\n".join(result.file_path for result in response.results),
        response_time_ms=response.took_ms,
        model_used=runtime.settings.gemini_embedding_model,
        metadata={"repo_name": repo_name, "count": response.count},
    )
    return response


@router.post("/repo/chat", response_model=RepoChatResponse)
async def repo_chat(
    payload: RepoChatRequest,
    request: Request,
    current_user=Depends(require_current_user),
    runtime=Depends(get_intelligence_runtime),
) -> RepoChatResponse:
    current_session = getattr(request.state, "current_session", None)
    if current_session is None:
        raise HTTPException(status_code=401, detail="Active session is required.")
    try:
        await runtime.security.enforce_rate_limit(
            key=f"ai:repo-chat:{current_user.user_id}",
            limit=runtime.settings.ai_request_rate_limit,
            window_s=60,
            error_message="AI usage rate limit exceeded.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    request_id = getattr(request.state, "request_id", None)
    LOGGER.info(
        "provider selected request_id=%s route=%s provider=gemini model=%s",
        request_id,
        request.url.path,
        runtime.settings.gemini_reasoning_model,
    )
    LOGGER.info(
        "AI generation started request_id=%s route=%s user_id=%s repo_name=%s",
        request_id,
        request.url.path,
        current_user.user_id,
        payload.repo_name,
    )
    try:
        response = await invoke_ai_callable(
            runtime.repo_chat.answer,
            question=payload.question,
            repo_name=payload.repo_name,
            top_k=payload.top_k,
            include_sources=payload.include_sources,
            label="repo_chat",
        )
        response = await ensure_response_shape(
            response,
            label="repo_chat",
            required_attr="answer",
            expected_type=str,
        )
    except HTTPException:
        LOGGER.exception("AI generation failed request_id=%s route=%s", request_id, request.url.path)
        raise
    except Exception:
        LOGGER.exception("AI generation failed request_id=%s route=%s", request_id, request.url.path)
        raise
    LOGGER.info(
        "AI generation completed request_id=%s route=%s duration_ms=%s",
        request_id,
        request.url.path,
        response.timings.get("total_ms", 0),
    )
    await runtime.tracking.track_interaction(
        user=current_user,
        session=current_session,
        feature="repo_chat",
        request_path=str(request.url.path),
        prompt=payload.question,
        response_text=response.answer,
        response_time_ms=response.timings.get("total_ms", 0),
        model_used=runtime.settings.gemini_reasoning_model,
        metadata={"repo_name": payload.repo_name},
    )
    LOGGER.info(
        "response serialization completed request_id=%s route=%s answer_chars=%s source_count=%s",
        request_id,
        request.url.path,
        len(response.answer),
        len(response.sources),
    )
    return response


@router.post("/events", response_model=EventIngestResponse)
async def ingest_event(
    payload: EventRequest,
    current_user=Depends(require_current_user),
    runtime=Depends(get_intelligence_runtime),
) -> EventIngestResponse:
    _ = current_user
    event = await runtime.events.record_event(payload)
    return EventIngestResponse(status="accepted", event_type=event.event_type, stored_at=event.timestamp)


@router.get("/admin/repo-insights", response_model=RepoInsightsResponse)
async def admin_repo_insights(
    repo_name: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> RepoInsightsResponse:
    _ = admin_user
    return await runtime.repo_insights.list(repo_name=repo_name, limit=limit)


@router.get("/admin/system-health", response_model=SystemHealthResponse)
async def admin_system_health(
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> SystemHealthResponse:
    _ = admin_user
    payload = await runtime.system_health()
    components = {
        name: SystemComponentHealth(**details)
        for name, details in payload["components"].items()
    }
    return SystemHealthResponse(
        status=payload["status"],
        allowed_roots=payload["allowed_roots"],
        components=components,
        queues=payload["queues"],
        latest_jobs=payload["latest_jobs"],
    )


@router.get("/admin/recommendations", response_model=RecommendationsResponse)
async def admin_recommendations(
    repo_name: str | None = None,
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> RecommendationsResponse:
    _ = admin_user
    return await runtime.repo_insights.recommendations(repo_name=repo_name)
