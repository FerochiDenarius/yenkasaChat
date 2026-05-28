from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import AliasChoices
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class EventRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    event_type: str = Field(
        min_length=1,
        validation_alias=AliasChoices("event_type", "eventType"),
    )
    user_id: str = Field(
        min_length=1,
        validation_alias=AliasChoices("user_id", "userId"),
    )
    app_source: str = Field(
        min_length=1,
        validation_alias=AliasChoices("app_source", "appSource", "source"),
    )
    timestamp: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventIngestResponse(BaseModel):
    status: str
    event_type: str
    stored_at: datetime
