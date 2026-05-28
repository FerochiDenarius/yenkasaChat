from __future__ import annotations

from collections import Counter
from collections import defaultdict
from typing import Any

from app.modules.crl.context_retriever import ContextEnvelope


class BehavioralReasoner:
    def summarize(
        self,
        *,
        yme_items: list[ContextEnvelope],
        memory_items: list[ContextEnvelope],
        conversations: list[ContextEnvelope],
        app_events: list[ContextEnvelope],
        user_memory_items: list[ContextEnvelope],
        chat_summaries: list[ContextEnvelope],
        engagement_patterns: list[ContextEnvelope],
        ai_profiles: list[ContextEnvelope],
        recommendation_signals: list[ContextEnvelope],
    ) -> list[str]:
        notes: list[str] = []

        if app_events:
            event_counts = Counter(item.title for item in app_events if item.title)
            top_events = self._format_counter(event_counts, limit=4)
            if top_events:
                notes.append(f"Recent live app events: {top_events}.")

            comment_events = [item for item in app_events if "comment" in f"{item.title} {item.text}".lower()]
            if comment_events:
                creator_counts = Counter()
                failed_comment_events = 0
                for item in comment_events:
                    creator_id = str(item.metadata.get("creator_id") or "").strip()
                    if creator_id:
                        creator_counts[creator_id] += 1
                    if item.metadata.get("processing_status") == "failed" or item.metadata.get("processing_error"):
                        failed_comment_events += 1

                leader_snapshot = self._format_counter(creator_counts, limit=3, value_prefix="creator ")
                if leader_snapshot:
                    notes.append(f"Recent comments leaderboard: {leader_snapshot}.")
                if failed_comment_events:
                    notes.append(
                        f"Comments ingestion shows {failed_comment_events} failed or errored events in the active window."
                    )

            processing_failures = sum(
                1
                for item in app_events
                if item.metadata.get("processing_status") == "failed" or item.metadata.get("processing_error")
            )
            if processing_failures:
                notes.append(f"Operational event ingestion currently has {processing_failures} failed event records.")

        if yme_items:
            event_counts = Counter(item.title for item in yme_items if item.title)
            top_events = self._format_counter(event_counts, limit=3)
            if top_events:
                notes.append(f"Recent behavioral signals: {top_events}.")

        if memory_items:
            issue_count = sum(1 for item in memory_items if item.severity.lower() in {"warn", "warning", "error"})
            if issue_count:
                notes.append(f"Memory logs recorded {issue_count} warning or error stages in the active window.")

        if user_memory_items:
            profile = user_memory_items[0]
            active_topics = profile.metadata.get("active_topics", [])
            stable_interests = profile.metadata.get("stable_interests", [])
            creator_affinity = profile.metadata.get("creator_affinity", [])
            if active_topics or stable_interests:
                notes.append(
                    "Memory profile focus: "
                    f"active topics {self._format_list(active_topics, limit=4)}; "
                    f"stable interests {self._format_list(stable_interests, limit=4)}."
                )
            if creator_affinity:
                notes.append(f"Strong creator affinity signals: {self._format_list(creator_affinity, limit=3)}.")

        if engagement_patterns:
            pattern = engagement_patterns[0]
            event_totals = self._top_numeric_items(pattern.metadata.get("event_totals", {}), limit=4)
            watch_behavior = pattern.metadata.get("watch_behavior", {}) or {}
            engagement_velocity = self._as_float(pattern.metadata.get("engagement_velocity"))
            active_hours = pattern.metadata.get("active_hours", [])

            summary_bits: list[str] = []
            if event_totals:
                summary_bits.append(f"top events {event_totals}")
            if engagement_velocity is not None and engagement_velocity > 0:
                summary_bits.append(f"velocity {round(engagement_velocity, 3)}")
            if summary_bits:
                notes.append(f"Engagement patterns show {'; '.join(summary_bits)}.")

            watch_bits: list[str] = []
            average_watch = self._as_float(watch_behavior.get("averageWatchTimeMs"))
            if average_watch and average_watch > 0:
                watch_bits.append(f"avg watch {round(average_watch / 1000, 1)}s")
            average_scroll = self._as_float(watch_behavior.get("averageScrollDurationMs"))
            if average_scroll and average_scroll > 0:
                watch_bits.append(f"avg scroll {round(average_scroll / 1000, 1)}s")
            rewatch_probability = self._as_float(watch_behavior.get("rewatchProbability"))
            if rewatch_probability and rewatch_probability > 0:
                watch_bits.append(f"rewatch {round(rewatch_probability, 3)}")
            if watch_bits:
                notes.append(f"Watch behavior snapshot: {', '.join(watch_bits)}.")
            if active_hours:
                notes.append(f"Most active hours observed: {self._format_list(active_hours, limit=4)} UTC.")

        if recommendation_signals:
            category_scores: defaultdict[str, float] = defaultdict(float)
            creator_scores: defaultdict[str, float] = defaultdict(float)
            source_event_types = Counter()
            for item in recommendation_signals:
                category = str(item.metadata.get("category") or "").strip()
                entity_type = str(item.metadata.get("entity_type") or "").strip()
                entity_id = str(item.metadata.get("entity_id") or "").strip()
                affinity_score = self._as_float(item.metadata.get("affinity_score")) or 0.0
                source_event_type = str(item.metadata.get("source_event_type") or "").strip()

                if category:
                    category_scores[category] += affinity_score
                if entity_type == "creator" and entity_id:
                    creator_scores[entity_id] += affinity_score
                if source_event_type:
                    source_event_types[source_event_type] += 1

            top_categories = self._format_float_map(category_scores, limit=4)
            top_creators = self._format_float_map(creator_scores, limit=3, value_prefix="creator ")
            if top_categories:
                notes.append(f"Recommendation signals currently favor: {top_categories}.")
            if top_creators:
                notes.append(f"Top creator recommendation signals: {top_creators}.")
            if source_event_types:
                notes.append(f"Recommendation updates are being driven by: {self._format_counter(source_event_types, limit=3)}.")

        combined_conversations = list(conversations) + list(chat_summaries)
        if combined_conversations:
            topic_counts = Counter()
            sentiment_counts = Counter()
            for item in combined_conversations:
                for topic in item.metadata.get("topics", []):
                    if topic:
                        topic_counts[str(topic)] += 1
                sentiment = str(item.metadata.get("sentiment") or "").strip()
                if sentiment:
                    sentiment_counts[sentiment] += 1

            top_topics = ", ".join(name for name, _count in topic_counts.most_common(4))
            if top_topics:
                notes.append(f"Recent AI and memory summaries focused on: {top_topics}.")
            if sentiment_counts:
                notes.append(f"Conversation sentiment mix: {self._format_counter(sentiment_counts, limit=3)}.")

        if ai_profiles:
            profile = ai_profiles[0]
            preferred_tones = profile.metadata.get("preferred_tones", [])
            topic_preferences = profile.metadata.get("topic_preferences", [])
            safety_flags = profile.metadata.get("safety_flags", [])
            preferred_languages = profile.metadata.get("preferred_languages", [])

            profile_bits: list[str] = []
            if preferred_tones:
                profile_bits.append(f"tones {self._format_list(preferred_tones, limit=3)}")
            if topic_preferences:
                profile_bits.append(f"topic prefs {self._format_list(topic_preferences, limit=4)}")
            if preferred_languages:
                profile_bits.append(f"languages {self._format_list(preferred_languages, limit=3)}")
            if profile_bits:
                notes.append(f"AI profile preferences: {'; '.join(profile_bits)}.")
            if safety_flags:
                notes.append(f"AI profile safety flags present: {self._format_list(safety_flags, limit=4)}.")

        return notes[:10]

    def _format_counter(self, counter: Counter, *, limit: int, value_prefix: str = "") -> str:
        return ", ".join(f"{value_prefix}{name} ({count})" for name, count in counter.most_common(limit))

    def _format_list(self, values: list[Any], *, limit: int) -> str:
        cleaned = [str(value).strip() for value in values if str(value).strip()]
        return ", ".join(cleaned[:limit]) if cleaned else "none"

    def _top_numeric_items(self, values: Any, *, limit: int) -> str:
        if not isinstance(values, dict):
            return ""
        ranked = sorted(
            [
                (str(key).strip(), self._as_float(score) or 0.0)
                for key, score in values.items()
                if str(key).strip()
            ],
            key=lambda item: item[1],
            reverse=True,
        )
        return ", ".join(
            f"{name} ({int(score) if float(score).is_integer() else round(score, 2)})"
            for name, score in ranked[:limit]
            if score > 0
        )

    def _format_float_map(self, values: dict[str, float], *, limit: int, value_prefix: str = "") -> str:
        ranked = sorted(values.items(), key=lambda item: item[1], reverse=True)
        return ", ".join(f"{value_prefix}{key} ({round(score, 3)})" for key, score in ranked[:limit] if score > 0)

    def _as_float(self, value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
