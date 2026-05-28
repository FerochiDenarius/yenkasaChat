from __future__ import annotations

from app.modules.crl.context_ranker import RankedContextItem


class ConsciousContextBuilder:
    def build(
        self,
        *,
        question: str,
        ranked_items: list[RankedContextItem],
        behavioral_notes: list[str],
        repo_notes: list[str],
        correlations: list[str],
    ) -> str:
        sections = [
            "Conscious Reasoning Layer",
            f"Question: {question}",
            "Use the operational evidence below for current-state answers. Prefer this over generic model assumptions.",
        ]

        if correlations:
            sections.append("Runtime correlations:")
            sections.extend(f"- {note}" for note in correlations)

        if behavioral_notes:
            sections.append("Behavioral intelligence:")
            sections.extend(f"- {note}" for note in behavioral_notes)

        if repo_notes:
            sections.append("Repo intelligence:")
            sections.extend(f"- {note}" for note in repo_notes)

        if ranked_items:
            sections.append("Ranked operational evidence:")
            for item in ranked_items[:8]:
                timestamp = item.envelope.timestamp.isoformat() + "Z" if item.envelope.timestamp else "unknown-time"
                sections.append(
                    f"- [{item.envelope.source}] {timestamp} | {item.envelope.title} | {item.envelope.text}"
                )

        return "\n".join(sections)
