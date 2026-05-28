from __future__ import annotations

from app.modules.crl.context_retriever import ContextEnvelope


class RepoReasoner:
    def summarize(self, question: str, insight_items: list[ContextEnvelope]) -> list[str]:
        _ = question
        notes: list[str] = []
        for item in insight_items[:4]:
            file_path = item.metadata.get("file_path") or item.raw.get("file_path") or "unknown-file"
            notes.append(f"{file_path}: {item.title}. {item.text}")
        return notes
