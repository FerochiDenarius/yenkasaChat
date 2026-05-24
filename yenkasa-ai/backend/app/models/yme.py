from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class YMEEventDocument(BaseModel):
    event_type: str
    user_id: str
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str
    metadata: dict[str, Any] = Field(default_factory=dict)
