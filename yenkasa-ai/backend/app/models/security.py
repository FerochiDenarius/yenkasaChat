from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class SecurityAlertDocument(BaseModel):
    alert_id: str
    alert_type: str
    severity: str
    user_id: str | None = None
    session_id: str | None = None
    ip_address: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
