from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from typing import Iterable

from app.modules.crl.context_retriever import ContextEnvelope
from app.modules.crl.context_retriever import STOP_WORDS


SOURCE_WEIGHTS = {
    "alerts": 42,
    "app_events": 38,
    "engagement_patterns": 28,
    "events": 34,
    "insights": 30,
    "memory_logs": 28,
    "jobs": 24,
    "recommendation_signals": 22,
    "user_memory": 20,
    "yme": 22,
    "chat_summaries": 18,
    "conversations": 16,
    "ai_profiles": 14,
}

SEVERITY_WEIGHTS = {
    "critical": 18,
    "error": 16,
    "high": 12,
    "warn": 10,
    "warning": 10,
    "medium": 6,
    "info": 2,
}


@dataclass(slots=True)
class RankedContextItem:
    envelope: ContextEnvelope
    score: float
    reasons: list[str]


class ConsciousContextRanker:
    def rank(self, question: str, bundles: dict[str, list[ContextEnvelope]], limit: int = 18) -> list[RankedContextItem]:
        terms = self._question_terms(question)
        ranked: list[RankedContextItem] = []

        for source, items in bundles.items():
            for item in items:
                score, reasons = self._score_item(source, item, terms)
                ranked.append(RankedContextItem(envelope=item, score=score, reasons=reasons))

        ranked.sort(
            key=lambda item: (
                item.score,
                item.envelope.timestamp or datetime.min,
            ),
            reverse=True,
        )
        return ranked[:limit]

    def _score_item(self, source: str, item: ContextEnvelope, terms: list[str]) -> tuple[float, list[str]]:
        score = float(SOURCE_WEIGHTS.get(source, 10))
        reasons = [f"source:{source}"]

        severity = item.severity.lower().strip()
        if severity:
            severity_score = SEVERITY_WEIGHTS.get(severity, 0)
            score += severity_score
            if severity_score:
                reasons.append(f"severity:{severity}")

        haystack = f"{item.title} {item.text}".lower()
        match_count = sum(1 for term in terms if term in haystack)
        if match_count:
            score += match_count * 8
            reasons.append(f"terms:{match_count}")

        if item.timestamp is not None:
            age_minutes = max(0.0, (datetime.utcnow() - item.timestamp).total_seconds() / 60)
            recency_score = max(0.0, 18 - min(age_minutes / 15, 18))
            score += recency_score
            if recency_score:
                reasons.append("recent")

        if any(token in haystack for token in ("coroutine", "await", "async", "server.js", "comment")):
            score += 9
            reasons.append("hotspot")

        if item.metadata.get("processing_status") == "failed" or item.metadata.get("processing_error"):
            score += 12
            reasons.append("pipeline_error")

        return score, reasons

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
        return sorted(terms)

    def flatten(self, bundles: dict[str, list[ContextEnvelope]]) -> Iterable[ContextEnvelope]:
        for items in bundles.values():
            yield from items
