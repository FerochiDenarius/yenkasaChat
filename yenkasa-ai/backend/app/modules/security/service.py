from __future__ import annotations

import asyncio
from datetime import datetime
from uuid import uuid4

from app.models import SecurityAlertDocument


class SecurityService:
    def __init__(self, settings, mongo_service, queue_service, password_service, token_service) -> None:
        self.settings = settings
        self.mongo = mongo_service
        self.queue = queue_service
        self.passwords = password_service
        self.tokens = token_service

    async def enforce_rate_limit(self, key: str, limit: int, window_s: int, error_message: str) -> None:
        if not self.queue.configured:
            return
        current = await self.queue.increment_window(key, window_s)
        if current > limit:
            raise ValueError(error_message)

    async def record_alert(
        self,
        alert_type: str,
        severity: str,
        user_id: str | None = None,
        session_id: str | None = None,
        ip_address: str | None = None,
        metadata: dict | None = None,
    ) -> SecurityAlertDocument:
        alert = SecurityAlertDocument(
            alert_id=str(uuid4()),
            alert_type=alert_type,
            severity=severity,
            user_id=user_id,
            session_id=session_id,
            ip_address=ip_address,
            metadata=metadata or {},
            created_at=datetime.utcnow(),
        )
        await self.mongo.security_alerts_collection.insert_one(alert.model_dump(mode="json"))
        return alert

    async def list_alerts(self, limit: int = 100) -> list[dict]:
        cursor = self.mongo.security_alerts_collection.find({}, projection={"_id": 0}).sort("created_at", -1).limit(limit)
        return [row async for row in cursor]
