from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from dataclasses import field
from datetime import datetime
from datetime import timedelta
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId


STOP_WORDS = {
    "a",
    "an",
    "and",
    "app",
    "are",
    "current",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "now",
    "of",
    "on",
    "right",
    "the",
    "this",
    "to",
    "what",
    "which",
    "who",
    "why",
}

LOGGER = logging.getLogger("yenkasa_ai_cloud.crl.retriever")


@dataclass(slots=True)
class ContextEnvelope:
    source: str
    title: str
    timestamp: datetime | None
    text: str
    severity: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


class ConsciousContextRetriever:
    def __init__(self, mongo_service, lookback_hours: int = 24) -> None:
        self.mongo = mongo_service
        self.lookback_hours = lookback_hours

    async def retrieve(self, question: str, *, user_id: str | None = None) -> dict[str, list[ContextEnvelope]]:
        if not self.mongo.configured:
            return {}

        since = datetime.utcnow() - timedelta(hours=self.lookback_hours)
        terms = self._question_terms(question)

        tasks = {
            "events": self._fetch_events(since=since, terms=terms),
            "alerts": self._fetch_alerts(since=since, terms=terms),
            "yme": self._fetch_yme(since=since, terms=terms, user_id=user_id),
            "memory_logs": self._fetch_memory_logs(since=since, terms=terms, user_id=user_id),
            "conversations": self._fetch_conversations(terms=terms, user_id=user_id),
            "insights": self._fetch_insights(terms=terms),
            "jobs": self._fetch_jobs(terms=terms),
            "app_events": self._fetch_user_events(since=since, terms=terms),
            "user_memory": self._fetch_user_memory(terms=terms, user_id=user_id),
            "chat_summaries": self._fetch_chat_summaries(terms=terms, user_id=user_id),
            "engagement_patterns": self._fetch_engagement_patterns(terms=terms, user_id=user_id),
            "ai_profiles": self._fetch_ai_profiles(terms=terms, user_id=user_id),
            "recommendation_signals": self._fetch_recommendation_signals(since=since, terms=terms, user_id=user_id),
        }

        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        bundles: dict[str, list[ContextEnvelope]] = {}
        for key, result in zip(tasks.keys(), results, strict=False):
            if isinstance(result, Exception):
                LOGGER.warning("CRL retrieval failed source=%s error=%s", key, result)
                continue
            if result:
                bundles[key] = result
        return bundles

    def _question_terms(self, question: str) -> list[str]:
        raw_terms = re.findall(r"[a-zA-Z0-9_.-]+", question.lower())
        terms: set[str] = set()
        for term in raw_terms:
            if len(term) <= 2 or term in STOP_WORDS:
                continue

            candidates = {term}
            if term.endswith("s") and len(term) > 3:
                candidates.add(term[:-1])
            elif len(term) > 3:
                candidates.add(f"{term}s")

            if "_" in term:
                candidates.update(part for part in term.split("_") if len(part) > 2 and part not in STOP_WORDS)
            if "." in term:
                candidates.update(part for part in term.split(".") if len(part) > 2 and part not in STOP_WORDS)

            terms.update(candidates)
        return sorted(terms)

    async def _fetch_events(self, *, since: datetime, terms: list[str]) -> list[ContextEnvelope]:
        rows = await self._fetch_rows(
            self.mongo.events_collection,
            query={"timestamp": {"$gte": since}},
            sort_field="timestamp",
            limit=40,
        )
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="events",
                title=str(row.get("event_type") or "event"),
                timestamp=self._coerce_datetime(row.get("timestamp")),
                text=self._compact_line(
                    row.get("event_type"),
                    row.get("app_source"),
                    row.get("metadata", {}),
                ),
                severity=str((row.get("metadata") or {}).get("severity") or ""),
                metadata=dict(row.get("metadata", {}) or {}),
                raw=row,
            ),
        )

    async def _fetch_alerts(self, *, since: datetime, terms: list[str]) -> list[ContextEnvelope]:
        rows = await self._fetch_rows(
            self.mongo.security_alerts_collection,
            query={"created_at": {"$gte": since}},
            sort_field="created_at",
            limit=25,
        )
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="alerts",
                title=str(row.get("alert_type") or row.get("title") or "alert"),
                timestamp=self._coerce_datetime(row.get("created_at")),
                text=self._compact_line(
                    row.get("severity"),
                    row.get("message") or row.get("title"),
                    row.get("metadata", {}),
                ),
                severity=str(row.get("severity") or ""),
                metadata=dict(row.get("metadata", {}) or {}),
                raw=row,
            ),
        )

    async def _fetch_yme(self, *, since: datetime, terms: list[str], user_id: str | None) -> list[ContextEnvelope]:
        query: dict[str, Any] = {"timestamp": {"$gte": since}}
        if user_id:
            query["user_id"] = user_id
        rows = await self._fetch_rows(
            self.mongo.yme_collection,
            query=query,
            sort_field="timestamp",
            limit=30,
        )
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="yme",
                title=str(row.get("event_type") or "yme_event"),
                timestamp=self._coerce_datetime(row.get("timestamp")),
                text=self._compact_line(
                    row.get("event_type"),
                    row.get("source"),
                    row.get("metadata", {}),
                ),
                metadata=dict(row.get("metadata", {}) or {}),
                raw=row,
            ),
        )

    async def _fetch_memory_logs(self, *, since: datetime, terms: list[str], user_id: str | None) -> list[ContextEnvelope]:
        if self.mongo.operational_database is None:
            return []
        collection = self.mongo.get_collection("memory_logs", operational=True)
        query: dict[str, Any] = {"createdAt": {"$gte": since}}
        if user_id:
            query["metadata.userId"] = user_id
        rows = await self._fetch_rows(collection, query=query, sort_field="createdAt", limit=30)
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="memory_logs",
                title=str(row.get("stage") or "memory_log"),
                timestamp=self._coerce_datetime(row.get("createdAt")),
                text=self._compact_line(
                    row.get("level"),
                    row.get("message"),
                    row.get("metadata", {}),
                    row.get("error"),
                ),
                severity=str(row.get("level") or ""),
                metadata=dict(row.get("metadata", {}) or {}),
                raw=row,
            ),
        )

    async def _fetch_conversations(self, *, terms: list[str], user_id: str | None) -> list[ContextEnvelope]:
        query: dict[str, Any] = {}
        if user_id:
            query["user_id"] = user_id
        rows = await self._fetch_rows(
            self.mongo.conversations_collection,
            query=query,
            sort_field="created_at",
            limit=12,
        )
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="conversations",
                title=str(row.get("feature") or "conversation"),
                timestamp=self._coerce_datetime(row.get("created_at")),
                text=self._compact_line(
                    row.get("summary"),
                    row.get("topics", []),
                    row.get("coding_languages", []),
                ),
                metadata={
                    "feature": row.get("feature"),
                    "topics": row.get("topics", []),
                    "coding_languages": row.get("coding_languages", []),
                },
                raw=row,
            ),
        )

    async def _fetch_insights(self, *, terms: list[str]) -> list[ContextEnvelope]:
        rows = await self._fetch_rows(
            self.mongo.insights_collection,
            query={},
            sort_field="created_at",
            limit=25,
        )
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="insights",
                title=str(row.get("title") or row.get("insight_type") or "repo_insight"),
                timestamp=self._coerce_datetime(row.get("created_at")),
                text=self._compact_line(
                    row.get("description"),
                    row.get("file_path"),
                    row.get("metadata", {}),
                ),
                severity=str(row.get("severity") or ""),
                metadata={
                    "repo_name": row.get("repo_name"),
                    "file_path": row.get("file_path"),
                    **dict(row.get("metadata", {}) or {}),
                },
                raw=row,
            ),
        )

    async def _fetch_jobs(self, *, terms: list[str]) -> list[ContextEnvelope]:
        rows = await self._fetch_rows(
            self.mongo.jobs_collection,
            query={},
            sort_field="updated_at",
            limit=15,
        )
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="jobs",
                title=str(row.get("repo_name") or "repo_job"),
                timestamp=self._coerce_datetime(row.get("updated_at")),
                text=self._compact_line(
                    row.get("status"),
                    row.get("last_error"),
                    row.get("failed_files", []),
                ),
                severity="error" if row.get("last_error") else "",
                metadata={
                    "repo_name": row.get("repo_name"),
                    "status": row.get("status"),
                    "last_error": row.get("last_error"),
                },
                raw=row,
            ),
        )

    async def _fetch_user_events(self, *, since: datetime, terms: list[str]) -> list[ContextEnvelope]:
        if self.mongo.operational_database is None:
            return []

        collection = self.mongo.get_collection("user_events", operational=True)
        rows = await self._fetch_rows(
            collection,
            query={"occurredAt": {"$gte": since}},
            sort_field="occurredAt",
            limit=60,
        )
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="app_events",
                title=str(row.get("eventType") or "user_event"),
                timestamp=self._coerce_datetime(row.get("occurredAt") or row.get("updatedAt") or row.get("createdAt")),
                text=self._compact_line(
                    row.get("sourceApp"),
                    row.get("normalizedText"),
                    row.get("interestCandidates", []),
                    row.get("processingError"),
                ),
                severity="error" if row.get("processingStatus") == "failed" or row.get("processingError") else "",
                metadata={
                    "user_id": self._stringify_id(row.get("userId")),
                    "creator_id": self._stringify_id(row.get("creatorId")),
                    "related_user_id": self._stringify_id(row.get("relatedUserId")),
                    "community_id": self._stringify_id(row.get("communityId")),
                    "post_id": self._stringify_id(row.get("postId")),
                    "conversation_id": row.get("conversationId"),
                    "content_id": row.get("contentId"),
                    "importance_score": row.get("importanceScore"),
                    "should_embed": row.get("shouldEmbed"),
                    "processing_status": row.get("processingStatus"),
                    "processing_error": row.get("processingError"),
                    "source_app": row.get("sourceApp"),
                    "client_platform": (row.get("eventMetadata") or {}).get("clientPlatform"),
                    "app_version": (row.get("eventMetadata") or {}).get("appVersion"),
                    "trace_id": (row.get("eventMetadata") or {}).get("traceId"),
                    "watch_time_ms": (row.get("eventMetadata") or {}).get("watchTimeMs"),
                    "scroll_duration_ms": (row.get("eventMetadata") or {}).get("scrollDurationMs"),
                },
                raw=row,
            ),
        )

    async def _fetch_user_memory(self, *, terms: list[str], user_id: str | None) -> list[ContextEnvelope]:
        if self.mongo.operational_database is None:
            return []

        collection = self.mongo.get_collection("user_memory", operational=True)
        query = self._user_scoped_query("userId", user_id)
        rows = await self._fetch_rows(collection, query=query, sort_field="updatedAt", limit=6)
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="user_memory",
                title=str(row.get("status") or "user_memory"),
                timestamp=self._coerce_datetime(row.get("updatedAt") or row.get("createdAt") or row.get("lastEventAt")),
                text=self._compact_line(
                    (row.get("shortTerm") or {}).get("activeTopics", []),
                    self._scored_labels((row.get("midTerm") or {}).get("recentTopics", [])),
                    self._scored_labels((row.get("longTerm") or {}).get("stableInterests", [])),
                    self._memory_summaries(row.get("memorySummaries", [])),
                ),
                metadata={
                    "user_id": self._stringify_id(row.get("userId")),
                    "active_topics": list((row.get("shortTerm") or {}).get("activeTopics", []) or []),
                    "recent_topics": self._scored_labels((row.get("midTerm") or {}).get("recentTopics", [])),
                    "stable_interests": self._scored_labels((row.get("longTerm") or {}).get("stableInterests", [])),
                    "creator_affinity": self._creator_ids((row.get("longTerm") or {}).get("creatorAffinity", [])),
                    "active_hours": self._active_hours((row.get("longTerm") or {}).get("activeHours", [])),
                    "memory_summaries": self._memory_summaries(row.get("memorySummaries", [])),
                    "last_event_at": row.get("lastEventAt"),
                },
                raw=row,
            ),
        )

    async def _fetch_chat_summaries(self, *, terms: list[str], user_id: str | None) -> list[ContextEnvelope]:
        if self.mongo.operational_database is None:
            return []

        collection = self.mongo.get_collection("chat_summaries", operational=True)
        query = self._user_scoped_query("userId", user_id)
        rows = await self._fetch_rows(collection, query=query, sort_field="updatedAt", limit=20)
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="chat_summaries",
                title=str(row.get("summaryType") or "chat_summary"),
                timestamp=self._coerce_datetime(row.get("windowEnd") or row.get("updatedAt") or row.get("createdAt")),
                text=self._compact_line(
                    row.get("summary"),
                    row.get("topics", []),
                    row.get("entities", []),
                ),
                metadata={
                    "user_id": self._stringify_id(row.get("userId")),
                    "conversation_id": row.get("conversationId"),
                    "topics": list(row.get("topics", []) or []),
                    "entities": list(row.get("entities", []) or []),
                    "sentiment": row.get("sentiment"),
                    "message_count": row.get("messageCount"),
                    "source_app": row.get("sourceApp"),
                },
                raw=row,
            ),
        )

    async def _fetch_engagement_patterns(self, *, terms: list[str], user_id: str | None) -> list[ContextEnvelope]:
        if self.mongo.operational_database is None:
            return []

        collection = self.mongo.get_collection("engagement_patterns", operational=True)
        query = self._user_scoped_query("userId", user_id)
        rows = await self._fetch_rows(collection, query=query, sort_field="updatedAt", limit=12)
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="engagement_patterns",
                title="engagement_pattern",
                timestamp=self._coerce_datetime(row.get("lastActiveAt") or row.get("updatedAt") or row.get("createdAt")),
                text=self._compact_line(
                    self._event_totals(row.get("eventTotals", {})),
                    self._watch_behavior(row.get("watchBehavior", {})),
                    f"velocity={row.get('engagementVelocity', 0)}",
                ),
                metadata={
                    "user_id": self._stringify_id(row.get("userId")),
                    "event_totals": dict(row.get("eventTotals", {}) or {}),
                    "watch_behavior": dict(row.get("watchBehavior", {}) or {}),
                    "engagement_velocity": row.get("engagementVelocity"),
                    "active_hours": self._histogram_peaks(row.get("hourlyHistogram", [])),
                    "active_days": self._histogram_peaks(row.get("weekdayHistogram", [])),
                },
                raw=row,
            ),
        )

    async def _fetch_ai_profiles(self, *, terms: list[str], user_id: str | None) -> list[ContextEnvelope]:
        if self.mongo.operational_database is None:
            return []

        collection = self.mongo.get_collection("ai_profiles", operational=True)
        query = self._user_scoped_query("userId", user_id)
        rows = await self._fetch_rows(collection, query=query, sort_field="updatedAt", limit=8)
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="ai_profiles",
                title="ai_profile",
                timestamp=self._coerce_datetime(row.get("updatedAt") or row.get("createdAt")),
                text=self._compact_line(
                    row.get("preferredTones", []),
                    row.get("responseStyles", []),
                    row.get("topicPreferences", []),
                    row.get("safetyFlags", []),
                ),
                metadata={
                    "user_id": self._stringify_id(row.get("userId")),
                    "preferred_tones": list(row.get("preferredTones", []) or []),
                    "response_styles": list(row.get("responseStyles", []) or []),
                    "preferred_languages": list(row.get("preferredLanguages", []) or []),
                    "topic_preferences": list(row.get("topicPreferences", []) or []),
                    "safety_flags": list(row.get("safetyFlags", []) or []),
                },
                raw=row,
            ),
        )

    async def _fetch_recommendation_signals(
        self,
        *,
        since: datetime,
        terms: list[str],
        user_id: str | None,
    ) -> list[ContextEnvelope]:
        if self.mongo.operational_database is None:
            return []

        collection = self.mongo.get_collection("recommendation_signals", operational=True)
        query: dict[str, Any] = {"lastSignalAt": {"$gte": since}}
        user_scope = self._user_scoped_query("userId", user_id)
        if user_scope:
            query.update(user_scope)

        rows = await self._fetch_rows(collection, query=query, sort_field="lastSignalAt", limit=30)
        return self._filter_rows(
            rows,
            terms=terms,
            builder=lambda row: ContextEnvelope(
                source="recommendation_signals",
                title=f"{row.get('entityType') or 'signal'}:{row.get('entityId') or 'unknown'}",
                timestamp=self._coerce_datetime(row.get("lastSignalAt") or row.get("updatedAt") or row.get("createdAt")),
                text=self._compact_line(
                    row.get("category"),
                    f"affinity={row.get('affinityScore')}",
                    f"engagement={row.get('engagementProbability')}",
                    f"rewatch={row.get('rewatchProbability')}",
                ),
                metadata={
                    "user_id": self._stringify_id(row.get("userId")),
                    "entity_type": row.get("entityType"),
                    "entity_id": row.get("entityId"),
                    "category": row.get("category"),
                    "affinity_score": row.get("affinityScore"),
                    "engagement_probability": row.get("engagementProbability"),
                    "rewatch_probability": row.get("rewatchProbability"),
                    "freshness_score": row.get("freshnessScore"),
                    "source_event_type": (row.get("metadata") or {}).get("sourceEventType"),
                },
                raw=row,
            ),
        )

    async def _fetch_rows(
        self,
        collection,
        *,
        query: dict[str, Any],
        sort_field: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        cursor = collection.find(query, projection={"_id": 0}).sort(sort_field, -1).limit(limit)
        return [row async for row in cursor]

    def _filter_rows(
        self,
        rows: list[dict[str, Any]],
        *,
        terms: list[str],
        builder,
    ) -> list[ContextEnvelope]:
        items: list[ContextEnvelope] = []
        for row in rows:
            envelope = builder(row)
            if not terms:
                items.append(envelope)
                continue
            blob = f"{envelope.title} {envelope.text} {json.dumps(envelope.metadata, default=str)}".lower()
            if any(term in blob for term in terms):
                items.append(envelope)
        return items

    def _compact_line(self, *parts: Any) -> str:
        chunks: list[str] = []
        for part in parts:
            if part is None:
                continue
            if isinstance(part, str):
                value = part.strip()
                if value:
                    chunks.append(value)
                continue
            if isinstance(part, (list, tuple, set)):
                value = ", ".join(str(item) for item in part if str(item).strip())
                if value:
                    chunks.append(value)
                continue
            if isinstance(part, dict):
                encoded = json.dumps(part, default=str, sort_keys=True)
                if encoded and encoded != "{}":
                    chunks.append(encoded)
                continue
            chunks.append(str(part))
        return " | ".join(chunks)[:700]

    def _user_scoped_query(self, field_name: str, user_id: str | None) -> dict[str, Any]:
        identities = self._user_identity_candidates(user_id)
        if not identities:
            return {}
        return {field_name: {"$in": identities}}

    def _user_identity_candidates(self, user_id: str | None) -> list[Any]:
        if not user_id:
            return []

        candidates: list[Any] = []
        seen: set[str] = set()

        def remember(value: Any) -> None:
            key = str(value)
            if not key or key in seen:
                return
            seen.add(key)
            candidates.append(value)

        remember(user_id)
        stripped = user_id.strip()
        remember(stripped)
        try:
            remember(ObjectId(stripped))
        except (InvalidId, TypeError):
            pass
        return candidates

    def _coerce_datetime(self, value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value.replace(tzinfo=None) if value.tzinfo else value
        if isinstance(value, str):
            normalized = value.replace("Z", "+00:00")
            try:
                parsed = datetime.fromisoformat(normalized)
            except ValueError:
                return None
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        return None

    def _stringify_id(self, value: Any) -> str:
        if value in (None, ""):
            return ""
        return str(value)

    def _scored_labels(self, values: Any, limit: int = 5) -> list[str]:
        labels: list[str] = []
        for entry in list(values or []):
            label = str(entry.get("label") or "").strip() if isinstance(entry, dict) else str(entry).strip()
            if not label:
                continue
            labels.append(label)
            if len(labels) >= limit:
                break
        return labels

    def _creator_ids(self, values: Any, limit: int = 5) -> list[str]:
        creator_ids: list[str] = []
        for entry in list(values or []):
            if not isinstance(entry, dict):
                continue
            creator_id = self._stringify_id(entry.get("creatorId"))
            if not creator_id:
                continue
            creator_ids.append(creator_id)
            if len(creator_ids) >= limit:
                break
        return creator_ids

    def _active_hours(self, values: Any, limit: int = 4) -> list[str]:
        hours: list[str] = []
        for entry in list(values or []):
            if not isinstance(entry, dict):
                continue
            hour = entry.get("hour")
            if hour in (None, ""):
                continue
            hours.append(str(hour))
            if len(hours) >= limit:
                break
        return hours

    def _memory_summaries(self, values: Any, limit: int = 3) -> list[str]:
        summaries: list[str] = []
        for entry in list(values or []):
            if not isinstance(entry, dict):
                continue
            summary = str(entry.get("summary") or "").strip()
            if not summary:
                continue
            summaries.append(summary[:180])
            if len(summaries) >= limit:
                break
        return summaries

    def _histogram_peaks(self, values: Any, limit: int = 4) -> list[str]:
        ranked = sorted(
            [
                (
                    str(entry.get("key") or "").strip(),
                    float(entry.get("score") or 0),
                )
                for entry in list(values or [])
                if isinstance(entry, dict) and str(entry.get("key") or "").strip()
            ],
            key=lambda item: item[1],
            reverse=True,
        )
        return [label for label, _score in ranked[:limit]]

    def _event_totals(self, values: Any, limit: int = 5) -> str:
        if not isinstance(values, dict):
            return ""
        ranked = sorted(
            (
                (str(key), float(value or 0))
                for key, value in values.items()
                if str(key).strip()
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        return ", ".join(f"{key}={int(score) if score.is_integer() else round(score, 2)}" for key, score in ranked[:limit])

    def _watch_behavior(self, values: Any) -> str:
        if not isinstance(values, dict):
            return ""

        avg_watch = float(values.get("averageWatchTimeMs") or 0)
        avg_scroll = float(values.get("averageScrollDurationMs") or 0)
        rewatch = float(values.get("rewatchProbability") or 0)
        parts = [
            f"watch_avg_ms={int(avg_watch)}" if avg_watch else "",
            f"scroll_avg_ms={int(avg_scroll)}" if avg_scroll else "",
            f"rewatch={round(rewatch, 3)}" if rewatch else "",
        ]
        return ", ".join(part for part in parts if part)
