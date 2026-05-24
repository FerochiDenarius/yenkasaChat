from __future__ import annotations

from datetime import datetime

from app.models import YMEEventDocument


class YMETrackingService:
    def __init__(self, mongo_service) -> None:
        self.mongo = mongo_service

    async def record_event(
        self,
        event_type: str,
        user_id: str,
        session_id: str,
        source: str,
        metadata: dict | None = None,
    ) -> YMEEventDocument:
        event = YMEEventDocument(
            event_type=event_type,
            user_id=user_id,
            session_id=session_id,
            source=source,
            metadata=metadata or {},
            timestamp=datetime.utcnow(),
        )
        await self.mongo.yme_collection.insert_one(event.model_dump(mode="json"))
        return event
