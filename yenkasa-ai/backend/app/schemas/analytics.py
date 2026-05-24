from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class AnalyticsOverviewResponse(BaseModel):
    daily_active_users: int
    prompt_count: int
    average_session_duration_s: float
    total_tokens_used: int
    most_used_features: list[dict[str, Any]] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class AnalyticsUsageResponse(BaseModel):
    feature_usage: list[dict[str, Any]] = Field(default_factory=list)
    coding_language_preferences: list[dict[str, Any]] = Field(default_factory=list)
    error_frequency: list[dict[str, Any]] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class AnalyticsUsersResponse(BaseModel):
    most_active_users: list[dict[str, Any]] = Field(default_factory=list)
    login_frequency: list[dict[str, Any]] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class AdminUsersResponse(BaseModel):
    users: list[dict[str, Any]] = Field(default_factory=list)
    count: int = 0


class ActiveSessionsResponse(BaseModel):
    sessions: list[dict[str, Any]] = Field(default_factory=list)
    count: int = 0


class AIUsageResponse(BaseModel):
    usage: list[dict[str, Any]] = Field(default_factory=list)
    count: int = 0
