from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query

from app.core.dependencies import get_intelligence_runtime
from app.modules.security import require_admin_user
from app.schemas import AIUsageResponse
from app.schemas import ActiveSessionsResponse
from app.schemas import AnalyticsOverviewResponse
from app.schemas import AnalyticsUsageResponse
from app.schemas import AnalyticsUsersResponse
from app.schemas import AdminUsersResponse
from app.schemas import SecurityAlertsResponse


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/analytics/overview", response_model=AnalyticsOverviewResponse)
async def analytics_overview(
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> AnalyticsOverviewResponse:
    _ = admin_user
    return await runtime.analytics.overview()


@router.get("/analytics/usage", response_model=AnalyticsUsageResponse)
async def analytics_usage(
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> AnalyticsUsageResponse:
    _ = admin_user
    return await runtime.analytics.usage()


@router.get("/analytics/users", response_model=AnalyticsUsersResponse)
async def analytics_users(
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> AnalyticsUsersResponse:
    _ = admin_user
    return await runtime.analytics.users_overview()


@router.get("/users", response_model=AdminUsersResponse)
async def admin_users(
    limit: int = Query(default=100, ge=1, le=200),
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> AdminUsersResponse:
    _ = admin_user
    return await runtime.analytics.admin_users(limit=limit)


@router.get("/active-sessions", response_model=ActiveSessionsResponse)
async def active_sessions(
    limit: int = Query(default=100, ge=1, le=200),
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> ActiveSessionsResponse:
    _ = admin_user
    return await runtime.analytics.active_sessions(limit=limit)


@router.get("/ai-usage", response_model=AIUsageResponse)
async def ai_usage(
    limit: int = Query(default=100, ge=1, le=200),
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> AIUsageResponse:
    _ = admin_user
    return await runtime.analytics.ai_usage(limit=limit)


@router.get("/security-alerts", response_model=SecurityAlertsResponse)
async def security_alerts(
    limit: int = Query(default=100, ge=1, le=200),
    admin_user=Depends(require_admin_user),
    runtime=Depends(get_intelligence_runtime),
) -> SecurityAlertsResponse:
    _ = admin_user
    return await runtime.analytics.security_alerts(limit=limit)
