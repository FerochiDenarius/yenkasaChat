from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.models import SessionDocument


def parse_device_type(user_agent: str | None) -> str:
    agent = (user_agent or "").lower()
    if any(term in agent for term in ("iphone", "android", "mobile")):
        return "mobile"
    if any(term in agent for term in ("ipad", "tablet")):
        return "tablet"
    return "desktop"


def parse_platform(user_agent: str | None) -> str:
    agent = (user_agent or "").lower()
    if "android" in agent:
        return "android"
    if "iphone" in agent or "ipad" in agent or "ios" in agent:
        return "ios"
    if "mac os" in agent or "macintosh" in agent:
        return "macos"
    if "windows" in agent:
        return "windows"
    if "linux" in agent:
        return "linux"
    return "unknown"


class SessionService:
    def __init__(self, settings, mongo_service, security_service) -> None:
        self.settings = settings
        self.mongo = mongo_service
        self.security = security_service

    async def create_session(self, user_id: str, refresh_jti: str, ip_address: str | None, user_agent: str | None) -> SessionDocument:
        prior_ips = await self.mongo.sessions_collection.distinct("ip_address", {"user_id": user_id, "ip_address": {"$ne": None}})
        session = SessionDocument(
            session_id=str(uuid4()),
            user_id=user_id,
            refresh_jti=refresh_jti,
            ip_address=ip_address,
            user_agent=user_agent,
            device_type=parse_device_type(user_agent),
            platform=parse_platform(user_agent),
            created_at=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        await self.mongo.sessions_collection.insert_one(session.model_dump(mode="json"))
        active_sessions = await self.mongo.sessions_collection.count_documents({"user_id": user_id, "status": "active"})
        if active_sessions > self.settings.max_concurrent_sessions:
            await self.security.record_alert(
                alert_type="concurrent_sessions",
                severity="medium",
                user_id=user_id,
                session_id=session.session_id,
                ip_address=ip_address,
                metadata={"active_sessions": active_sessions},
            )
        if ip_address and prior_ips and ip_address not in prior_ips:
            await self.security.record_alert(
                alert_type="new_ip_login",
                severity="low",
                user_id=user_id,
                session_id=session.session_id,
                ip_address=ip_address,
                metadata={"known_ips": prior_ips[:5]},
            )
        return session

    async def get_session(self, session_id: str) -> SessionDocument | None:
        document = await self.mongo.sessions_collection.find_one({"session_id": session_id}, projection={"_id": 0})
        return SessionDocument(**document) if document else None

    async def validate_active_session(self, session_id: str) -> SessionDocument:
        session = await self.get_session(session_id)
        if session is None or session.status != "active":
            raise ValueError("Session is not active.")
        await self.mongo.sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": {"last_seen": datetime.utcnow()}},
        )
        session.last_seen = datetime.utcnow()
        return session

    async def rotate_refresh_jti(self, session_id: str, old_jti: str, new_jti: str) -> SessionDocument:
        session = await self.get_session(session_id)
        if session is None or session.status != "active":
            raise ValueError("Session is not active.")
        if session.refresh_jti != old_jti:
            raise ValueError("Refresh token has been revoked.")
        await self.mongo.sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": {"refresh_jti": new_jti, "last_seen": datetime.utcnow()}},
        )
        session.refresh_jti = new_jti
        session.last_seen = datetime.utcnow()
        return session

    async def invalidate_session(self, session_id: str) -> None:
        await self.mongo.sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": {"status": "revoked", "ended_at": datetime.utcnow(), "last_seen": datetime.utcnow()}},
        )

    async def list_active_sessions(self, limit: int = 100) -> list[dict]:
        cursor = self.mongo.sessions_collection.find(
            {"status": "active"},
            projection={"_id": 0},
        ).sort("last_seen", -1).limit(limit)
        return [row async for row in cursor]
