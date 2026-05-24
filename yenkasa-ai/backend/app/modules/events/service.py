from __future__ import annotations

from datetime import datetime

from app.models import EventDocument


class EventService:
    def __init__(self, mongo_service) -> None:
        self.mongo = mongo_service

    async def record_event(self, payload) -> EventDocument:
        event = EventDocument(
            event_type=payload.event_type,
            user_id=payload.user_id,
            app_source=payload.app_source,
            timestamp=payload.timestamp or datetime.utcnow(),
            metadata=payload.metadata,
        )
        await self.mongo.events_collection.insert_one(event.model_dump(mode="json"))
        return event
