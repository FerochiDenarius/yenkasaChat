from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class EventRequest(BaseModel):
    event_type: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    app_source: str = Field(min_length=1)
    timestamp: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventIngestResponse(BaseModel):
    status: str
    event_type: str
    stored_at: datetime
