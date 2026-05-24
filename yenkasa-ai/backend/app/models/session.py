from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class SessionDocument(BaseModel):
    session_id: str
    user_id: str
    refresh_jti: str
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    ended_at: datetime | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    device_type: str | None = None
    platform: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
