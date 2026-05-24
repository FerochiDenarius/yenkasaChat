from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class RepoInsightItem(BaseModel):
    repo_name: str
    insight_type: str
    severity: str
    title: str
    description: str
    file_path: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class RepoInsightsResponse(BaseModel):
    repo_name: str | None = None
    count: int
    insights: list[RepoInsightItem]
    summary: list[str] = Field(default_factory=list)


class SystemComponentHealth(BaseModel):
    status: str
    detail: str
    metrics: dict[str, Any] = Field(default_factory=dict)


class SystemHealthResponse(BaseModel):
    status: str
    allowed_roots: list[str]
    components: dict[str, SystemComponentHealth]
    queues: dict[str, int] = Field(default_factory=dict)
    latest_jobs: list[dict[str, Any]] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class RecommendationItem(BaseModel):
    category: str
    priority: str
    recommendation: str
    rationale: str


class RecommendationsResponse(BaseModel):
    repo_name: str | None = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    recommendations: list[RecommendationItem]


class SecurityAlertsResponse(BaseModel):
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    count: int = 0
