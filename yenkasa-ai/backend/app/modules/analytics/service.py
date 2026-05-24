from __future__ import annotations

from datetime import datetime
from datetime import timedelta

from app.schemas import AIUsageResponse
from app.schemas import ActiveSessionsResponse
from app.schemas import AnalyticsOverviewResponse
from app.schemas import AnalyticsUsageResponse
from app.schemas import AnalyticsUsersResponse
from app.schemas import AdminUsersResponse
from app.schemas import SecurityAlertsResponse


class AnalyticsService:
    def __init__(self, mongo_service, user_service, session_service, security_service) -> None:
        self.mongo = mongo_service
        self.users = user_service
        self.sessions = session_service
        self.security = security_service

    async def overview(self) -> AnalyticsOverviewResponse:
        since = datetime.utcnow() - timedelta(days=1)
        dau = len(
            await self.mongo.conversations_collection.distinct(
                "user_id",
                {"created_at": {"$gte": since}},
            )
        )
        prompt_count = await self.mongo.conversations_collection.count_documents({"created_at": {"$gte": since}})
        sessions = [
            row
            async for row in self.mongo.sessions_collection.find(
                {"created_at": {"$gte": since}, "ended_at": {"$ne": None}},
                projection={"created_at": 1, "ended_at": 1},
            )
        ]
        average_duration = 0.0
        if sessions:
            total = sum((row["ended_at"] - row["created_at"]).total_seconds() for row in sessions)
            average_duration = round(total / len(sessions), 2)

        token_pipeline = [
            {"$group": {"_id": None, "total_tokens": {"$sum": "$total_tokens"}}},
        ]
        token_rows = [row async for row in self.mongo.conversations_collection.aggregate(token_pipeline)]
        total_tokens = int(token_rows[0]["total_tokens"]) if token_rows else 0
        feature_usage = await self._group_by("feature", self.mongo.conversations_collection, limit=5)
        return AnalyticsOverviewResponse(
            daily_active_users=dau,
            prompt_count=prompt_count,
            average_session_duration_s=average_duration,
            total_tokens_used=total_tokens,
            most_used_features=feature_usage,
        )

    async def usage(self) -> AnalyticsUsageResponse:
        feature_usage = await self._group_by("feature", self.mongo.conversations_collection, limit=20)
        language_usage = await self._unwind_group_by("coding_languages", self.mongo.conversations_collection, limit=20)
        error_frequency = await self._group_by("alert_type", self.mongo.security_alerts_collection, limit=20)
        return AnalyticsUsageResponse(
            feature_usage=feature_usage,
            coding_language_preferences=language_usage,
            error_frequency=error_frequency,
        )

    async def users_overview(self) -> AnalyticsUsersResponse:
        top_users = await self._top_users()
        login_frequency = await self._group_by("user_id", self.mongo.sessions_collection, limit=10)
        return AnalyticsUsersResponse(most_active_users=top_users, login_frequency=login_frequency)

    async def admin_users(self, limit: int = 100) -> AdminUsersResponse:
        users = await self.users.list_users(limit=limit)
        return AdminUsersResponse(users=users, count=len(users))

    async def active_sessions(self, limit: int = 100) -> ActiveSessionsResponse:
        sessions = await self.sessions.list_active_sessions(limit=limit)
        return ActiveSessionsResponse(sessions=sessions, count=len(sessions))

    async def ai_usage(self, limit: int = 100) -> AIUsageResponse:
        cursor = self.mongo.conversations_collection.find({}, projection={"_id": 0}).sort("created_at", -1).limit(limit)
        rows = [row async for row in cursor]
        return AIUsageResponse(usage=rows, count=len(rows))

    async def security_alerts(self, limit: int = 100) -> SecurityAlertsResponse:
        alerts = await self.security.list_alerts(limit=limit)
        return SecurityAlertsResponse(alerts=alerts, count=len(alerts))

    async def _group_by(self, field: str, collection, limit: int) -> list[dict]:
        pipeline = [
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        return [{"value": row["_id"], "count": row["count"]} async for row in collection.aggregate(pipeline)]

    async def _unwind_group_by(self, field: str, collection, limit: int) -> list[dict]:
        pipeline = [
            {"$unwind": f"${field}"},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        return [{"value": row["_id"], "count": row["count"]} async for row in collection.aggregate(pipeline)]

    async def _top_users(self) -> list[dict]:
        pipeline = [
            {"$group": {"_id": "$user_id", "prompts": {"$sum": 1}, "tokens": {"$sum": "$total_tokens"}}},
            {"$sort": {"prompts": -1}},
            {"$limit": 10},
        ]
        return [
            {"user_id": row["_id"], "prompt_count": row["prompts"], "total_tokens": row["tokens"]}
            async for row in self.mongo.conversations_collection.aggregate(pipeline)
        ]
