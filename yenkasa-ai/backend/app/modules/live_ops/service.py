from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime
from datetime import timedelta
from typing import Any


LOGGER = logging.getLogger("yenkasa_ai_cloud.live_ops")

LIVE_OPS_TERMS = (
    "bug",
    "comment",
    "comments",
    "current",
    "currently",
    "error",
    "events",
    "happening",
    "incident",
    "issues",
    "leader",
    "leading",
    "live",
    "now",
    "right now",
    "server.js",
    "today",
)

STOP_WORDS = {
    "a",
    "an",
    "and",
    "app",
    "are",
    "be",
    "current",
    "happening",
    "in",
    "is",
    "live",
    "me",
    "now",
    "of",
    "on",
    "right",
    "the",
    "there",
    "what",
    "who",
}


class LiveOpsService:
    def __init__(self, mongo_service, lookback_hours: int = 24) -> None:
        self.mongo = mongo_service
        self.lookback_hours = lookback_hours

    def should_include(self, question: str) -> bool:
        lowered = question.lower()
        return any(term in lowered for term in LIVE_OPS_TERMS)

    async def build_context(self, question: str, limit: int = 12) -> str | None:
        if not self.mongo.configured or not self.should_include(question):
            return None

        since = datetime.utcnow() - timedelta(hours=self.lookback_hours)
        terms = self._question_terms(question)

        event_rows, alert_rows, yme_rows, app_event_rows, memory_log_rows = await asyncio.gather(
            self._fetch_rows(
                self.mongo.events_collection,
                query={"timestamp": {"$gte": since}},
                sort_field="timestamp",
                limit=max(limit * 4, 40),
            ),
            self._fetch_rows(
                self.mongo.security_alerts_collection,
                query={"created_at": {"$gte": since}},
                sort_field="created_at",
                limit=max(limit * 3, 30),
            ),
            self._fetch_rows(
                self.mongo.yme_collection,
                query={"timestamp": {"$gte": since}},
                sort_field="timestamp",
                limit=max(limit * 2, 20),
            ),
            self._fetch_operational_rows(
                "user_events",
                query={"occurredAt": {"$gte": since}},
                sort_field="occurredAt",
                limit=max(limit * 4, 40),
            ),
            self._fetch_operational_rows(
                "memory_logs",
                query={"createdAt": {"$gte": since}},
                sort_field="createdAt",
                limit=max(limit * 2, 20),
            ),
        )

        matching_events = self._match_rows(event_rows, terms, fallback_limit=min(limit, 4))[:limit]
        matching_alerts = self._match_rows(alert_rows, terms, fallback_limit=max(2, limit // 3))[: max(4, limit // 2)]
        matching_yme = self._match_rows(yme_rows, terms, fallback_limit=max(2, limit // 4))[: max(4, limit // 3)]
        matching_app_events = self._match_rows(app_event_rows, terms, fallback_limit=min(limit, 6))[:limit]
        matching_memory_logs = self._match_rows(memory_log_rows, terms, fallback_limit=max(2, limit // 4))[
            : max(4, limit // 3)
        ]

        if not matching_events and not matching_alerts and not matching_yme and not matching_app_events and not matching_memory_logs:
            LOGGER.info("No matching live ops telemetry found question=%s", question)
            return (
                f"No matching live operations telemetry was found in the last {self.lookback_hours} hours. "
                "If the answer should depend on current app activity, say that the live feed does not currently contain it."
            )

        sections = [
            f"Question: {question}",
            f"Telemetry window: last {self.lookback_hours} hours.",
            "Use the operational records below for time-sensitive facts. Prefer them over static knowledge when they conflict.",
        ]
        if matching_app_events:
            sections.append("Recent live app activity:")
            sections.extend(self._format_operational_event_row(row) for row in matching_app_events)
        if matching_memory_logs:
            sections.append("Recent operational memory logs:")
            sections.extend(self._format_memory_log_row(row) for row in matching_memory_logs)
        if matching_events:
            sections.append("Recent app events:")
            sections.extend(self._format_event_row(row) for row in matching_events)
        if matching_alerts:
            sections.append("Recent security and incident alerts:")
            sections.extend(self._format_alert_row(row) for row in matching_alerts)
        if matching_yme:
            sections.append("Recent YME context:")
            sections.extend(self._format_yme_row(row) for row in matching_yme)
        return "\n".join(sections)

    async def _fetch_rows(self, collection, *, query: dict[str, Any], sort_field: str, limit: int) -> list[dict[str, Any]]:
        cursor = collection.find(query, projection={"_id": 0}).sort(sort_field, -1).limit(limit)
        return [row async for row in cursor]

    async def _fetch_operational_rows(
        self,
        collection_name: str,
        *,
        query: dict[str, Any],
        sort_field: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        if self.mongo.operational_database is None:
            return []
        collection = self.mongo.get_collection(collection_name, operational=True)
        return await self._fetch_rows(collection, query=query, sort_field=sort_field, limit=limit)

    def _question_terms(self, question: str) -> list[str]:
        raw_terms = re.findall(r"[a-zA-Z0-9_.-]+", question.lower())
        terms: set[str] = set()
        for term in raw_terms:
            if len(term) <= 2 or term in STOP_WORDS:
                continue
            terms.add(term)
            if term.endswith("s") and len(term) > 3:
                terms.add(term[:-1])
            elif len(term) > 3:
                terms.add(f"{term}s")
            if "_" in term:
                terms.update(part for part in term.split("_") if len(part) > 2 and part not in STOP_WORDS)
            if "." in term:
                terms.update(part for part in term.split(".") if len(part) > 2 and part not in STOP_WORDS)
        return sorted(terms)

    def _match_rows(self, rows: list[dict[str, Any]], terms: list[str], fallback_limit: int = 0) -> list[dict[str, Any]]:
        if not terms:
            return rows

        scored_rows: list[tuple[int, dict[str, Any]]] = []
        for row in rows:
            blob = json.dumps(row, default=str, sort_keys=True).lower()
            score = sum(1 for term in terms if term in blob)
            if score > 0:
                scored_rows.append((score, row))

        scored_rows.sort(
            key=lambda item: (
                -item[0],
                str(item[1].get("timestamp") or item[1].get("created_at") or ""),
            ),
            reverse=False,
        )
        if scored_rows:
            return [row for _score, row in scored_rows]
        if fallback_limit > 0:
            return rows[:fallback_limit]
        return []

    def _format_event_row(self, row: dict[str, Any]) -> str:
        timestamp = row.get("timestamp")
        return (
            f"- {self._format_timestamp(timestamp)} | event_type={row.get('event_type')} "
            f"| app_source={row.get('app_source')} | metadata={self._compact_json(row.get('metadata', {}))}"
        )

    def _format_alert_row(self, row: dict[str, Any]) -> str:
        created_at = row.get("created_at")
        return (
            f"- {self._format_timestamp(created_at)} | severity={row.get('severity')} "
            f"| alert_type={row.get('alert_type')} | metadata={self._compact_json(row.get('metadata', {}))}"
        )

    def _format_yme_row(self, row: dict[str, Any]) -> str:
        timestamp = row.get("timestamp")
        return (
            f"- {self._format_timestamp(timestamp)} | event_type={row.get('event_type')} "
            f"| source={row.get('source')} | metadata={self._compact_json(row.get('metadata', {}))}"
        )

    def _format_operational_event_row(self, row: dict[str, Any]) -> str:
        occurred_at = row.get("occurredAt") or row.get("updatedAt") or row.get("createdAt")
        event_metadata = row.get("eventMetadata") or {}
        return (
            f"- {self._format_timestamp(occurred_at)} | eventType={row.get('eventType')} "
            f"| sourceApp={row.get('sourceApp')} | creatorId={row.get('creatorId') or ''} "
            f"| postId={row.get('postId') or ''} | processingStatus={row.get('processingStatus')} "
            f"| traceId={event_metadata.get('traceId') or ''} | payload={self._compact_json(row.get('payload', {}))}"
        )

    def _format_memory_log_row(self, row: dict[str, Any]) -> str:
        created_at = row.get("createdAt") or row.get("updatedAt")
        return (
            f"- {self._format_timestamp(created_at)} | level={row.get('level')} "
            f"| stage={row.get('stage')} | message={row.get('message')} "
            f"| error={row.get('error') or ''} | metadata={self._compact_json(row.get('metadata', {}))}"
        )

    def _compact_json(self, payload: Any, max_length: int = 360) -> str:
        encoded = json.dumps(payload, default=str, sort_keys=True)
        if len(encoded) <= max_length:
            return encoded
        return f"{encoded[: max_length - 3]}..."

    def _format_timestamp(self, value: Any) -> str:
        if isinstance(value, datetime):
            return value.replace(microsecond=0).isoformat() + "Z"
        if value is None:
            return "unknown-time"
        return str(value)
