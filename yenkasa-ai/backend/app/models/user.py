from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class UserDocument(BaseModel):
    user_id: str
    username: str
    email: str
    hashed_password: str
    full_name: str | None = None
    country: str | None = None
    phone_number: str | None = None
    signup_type: str | None = None
    profile_image: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    terms_accepted_at: datetime | None = None
    last_seen: datetime | None = None
    role: str = "user"
    account_status: str = "active"
    ai_usage_count: int = 0
    total_tokens_used: int = 0
    last_ai_interaction: datetime | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AIConversationDocument(BaseModel):
    conversation_id: str
    user_id: str
    session_id: str
    feature: str
    messages: list[dict[str, Any]] = Field(default_factory=list)
    model_used: str
    request_path: str
    response_time_ms: int
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    topics: list[str] = Field(default_factory=list)
    coding_languages: list[str] = Field(default_factory=list)
    summary: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
