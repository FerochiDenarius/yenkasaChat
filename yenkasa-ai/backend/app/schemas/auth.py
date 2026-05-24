from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field
from typing import Literal


class AuthRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    country: str | None = Field(default=None, min_length=2, max_length=80)
    phone_number: str | None = Field(default=None, min_length=5, max_length=30)
    signup_type: Literal["developer", "individual", "student", "enterprise"] | None = None
    profile_image: str | None = None
    preferred_language: str | None = None
    captcha_code: str | None = None
    agree_to_terms: bool = False
    preferences: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthRefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class CurrentUserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    full_name: str | None = None
    country: str | None = None
    phone_number: str | None = None
    signup_type: str | None = None
    profile_image: str | None = None
    created_at: datetime
    terms_accepted_at: datetime | None = None
    last_seen: datetime | None = None
    role: str
    account_status: str
    ai_usage_count: int
    total_tokens_used: int
    last_ai_interaction: datetime | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_token_expires_in: int
    refresh_token_expires_in: int
    session_id: str
    user: CurrentUserResponse


class LogoutResponse(BaseModel):
    status: str
