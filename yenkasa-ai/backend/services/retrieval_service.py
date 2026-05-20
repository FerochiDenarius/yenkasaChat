from __future__ import annotations

import re
import time
from typing import Any

from app.models import AnswerCard
from app.models import ChatRequest
from app.models import ChatResponse
from app.models import SearchRequest
from app.models import SearchResponse
from app.models import SourceChunk


PUBLIC_FOLLOW_UPS = {
    "platform": [
        "What is Yenkasa Coin and how do I earn it?",
        "How do communities work on Yenkasa?",
        "How does rank progression work?",
    ],
    "rewards": [
        "How do I earn more YKC on Yenkasa?",
        "What milestones should I aim for next?",
        "How do YKC rewards connect to ranks?",
    ],
    "ranks": [
        "What are the main ranks in Yenkasa?",
        "How does verification help rank progression?",
        "What do leaderboards and titles mean?",
    ],
    "livestreams": [
        "What is Yenkasa Live Arena?",
        "How do livestream duels work?",
        "What live titles can users earn?",
    ],
    "moderation": [
        "How does Yenkasa protect users?",
        "Why are some features role-gated?",
        "How does moderation affect livestreams and communities?",
    ],
    "creator-tools": [
        "How does the Yenkasa creator economy work?",
        "Which creator roles exist on Yenkasa?",
        "How do communities and livestreams help creators grow?",
    ],
}

PUBLIC_UNSAFE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bbypass\b.*\bmoderation\b",
        r"\bevad(e|ing)\b.*\bmoderation\b",
        r"\bcheat\b.*\b(rank|ykc|reward|verification|leaderboard)\b",
        r"\bfarm\b.*\b(ykc|reward|rank)\b",
        r"\bspam\b.*\b(without|and not)\b.*\b(ban|moderation|detection)\b",
        r"\bfake\b.*\b(verification|rank|reward|engagement)\b",
        r"\bexploit\b",
    ]
]


def history_to_pairs(history: list) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    pending_question: str | None = None

    for turn in history:
        content = turn.content.strip()
        if not content:
            continue
        role = turn.role.lower().strip()
        if role == "user":
            pending_question = content
            continue
        if role == "assistant" and pending_question:
            pairs.append((pending_question, content))
            pending_question = None

    return pairs


def format_history(history_pairs: list[tuple[str, str]], max_turns: int) -> str:
    if not history_pairs:
        return "No previous conversation."

    recent_turns = history_pairs[-max_turns:]
    lines = []
    for index, (question, answer) in enumerate(recent_turns, start=1):
        lines.append(f"Turn {index} Question: {question}")
        lines.append(f"Turn {index} Answer: {answer}")
    return "\n".join(lines)


def dedupe_results(results: list[tuple], limit: int) -> list[tuple]:
    deduped: list[tuple] = []
    seen: set[str] = set()
    for document, score in results:
        metadata = getattr(document, "metadata", {}) or {}
        dedupe_key = metadata.get("chunk_id") or f"{metadata.get('source_relative_path', '')}:{hash(document.page_content)}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        deduped.append((document, score))
        if len(deduped) >= limit:
            break
    return deduped


def search_chunks(vector_store: Any, question: str, top_k: int) -> tuple[list[tuple], float]:
    started = time.perf_counter()
    raw_results = vector_store.similarity_search_with_score(question, k=top_k)
    return dedupe_results(raw_results, top_k), time.perf_counter() - started


def build_section_path(metadata: dict[str, Any]) -> str:
    parts = [metadata.get("section_path"), metadata.get("h1"), metadata.get("h2"), metadata.get("h3")]
    for part in parts:
        if isinstance(part, str) and part.strip():
            return part.strip()
    return "Overview"


def format_sources(results: list[tuple]) -> list[SourceChunk]:
    sources: list[SourceChunk] = []
    for index, (document, score) in enumerate(results, start=1):
        metadata = dict(getattr(document, "metadata", {}) or {})
        numeric_score = float(score) if score is not None else 0.0
        relevance = 1 / (1 + max(0.0, numeric_score))
        section = build_section_path(metadata)
        sources.append(
            SourceChunk(
                id=metadata.get("chunk_id") or f"s{index}",
                label=f"S{index}",
                title=metadata.get("source_file", "unknown"),
                area=metadata.get("category", "uncategorized"),
                score=round(relevance, 6),
                rawScore=round(numeric_score, 6),
                excerpt=(document.page_content or "").strip()[:320],
                citation=f"{metadata.get('source_file', 'unknown')} > {section}",
                metadata=metadata,
            )
        )
    return sources


def format_context(results: list[tuple]) -> str:
    if not results:
        return "No relevant context retrieved."

    blocks = []
    for index, (document, score) in enumerate(results, start=1):
        metadata = dict(getattr(document, "metadata", {}) or {})
        blocks.append(
            f"[S{index}] file={metadata.get('source_file', 'unknown')} "
            f"category={metadata.get('category', 'uncategorized')} "
            f"section={build_section_path(metadata)} "
            f"score={float(score):.6f}\n"
            f"{document.page_content.strip()}"
        )
    return "\n\n".join(blocks)


def extract_answer_text(response: Any) -> str:
    if response is None:
        return ""
    if isinstance(response, str):
        return response.strip()
    content = getattr(response, "content", None)
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("text"):
                parts.append(str(item["text"]).strip())
            elif isinstance(item, str):
                parts.append(item.strip())
        return "\n".join(part for part in parts if part).strip()
    for attr_name in ("text", "output_text", "answer"):
        candidate = getattr(response, attr_name, None)
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return ""


def build_answer_cards(results: list[tuple]) -> list[AnswerCard]:
    cards: list[AnswerCard] = []
    seen: set[str] = set()
    for document, _score in results:
        metadata = dict(getattr(document, "metadata", {}) or {})
        key = f"{metadata.get('source_relative_path')}::{build_section_path(metadata)}"
        if key in seen:
            continue
        seen.add(key)
        excerpt = " ".join((document.page_content or "").strip().split())
        cards.append(
            AnswerCard(
                title=build_section_path(metadata),
                category=metadata.get("category", "platform"),
                summary=excerpt[:200] + ("..." if len(excerpt) > 200 else ""),
            )
        )
        if len(cards) >= 3:
            break
    return cards


def build_follow_ups(results: list[tuple], audience: str) -> list[str]:
    if audience == "engineering":
        return [
            "What are the main scaling risks in this subsystem?",
            "Which routes or sockets own this behavior today?",
            "What should be refactored first to reduce operational risk?",
        ]

    categories: list[str] = []
    for document, _score in results:
        metadata = dict(getattr(document, "metadata", {}) or {})
        category = metadata.get("category")
        if category and category not in categories:
            categories.append(category)

    suggestions: list[str] = []
    for category in categories:
        for suggestion in PUBLIC_FOLLOW_UPS.get(category, []):
            if suggestion not in suggestions:
                suggestions.append(suggestion)
    return suggestions[:3] or PUBLIC_FOLLOW_UPS["platform"]


def is_public_unsafe(question: str) -> bool:
    return any(pattern.search(question) for pattern in PUBLIC_UNSAFE_PATTERNS)


def safe_public_response(model_name: str) -> ChatResponse:
    return ChatResponse(
        provider="vertex_ai",
        model=model_name,
        audience="public",
        answer=(
            "I can explain how Yenkasa safety, rewards, ranks, and moderation work, but I cannot help with bypassing "
            "moderation, gaming rewards, or exploiting platform systems."
        ),
        answer_cards=[
            AnswerCard(
                title="Safe help available",
                category="moderation",
                summary="Ask about YKC, verification, ranks, communities, Live Arena, or creator growth instead.",
            )
        ],
        suggested_follow_ups=[
            "What is Yenkasa Coin and how do I earn it?",
            "How does verification work on Yenkasa?",
            "What is Yenkasa Live Arena?",
        ],
        sources=[],
        timings={"retrievalMs": 0, "generationMs": 0, "totalMs": 0},
        debug=None,
    )


def chat_with_rag(
    *,
    payload: ChatRequest,
    vector_store: Any,
    llm: Any,
    prompt: Any,
    model_name: str,
    max_history_turns: int,
    retrieval_k: int,
) -> ChatResponse:
    if payload.audience == "public" and is_public_unsafe(payload.question):
        return safe_public_response(model_name)

    total_started = time.perf_counter()
    results, retrieval_elapsed = search_chunks(vector_store, payload.question.strip(), retrieval_k)
    history = format_history(history_to_pairs(payload.history), max_history_turns)
    context = format_context(results)

    generation_started = time.perf_counter()
    response = llm.invoke(
        prompt.format_messages(
            history=history,
            question=payload.question.strip(),
            context=context,
        )
    )
    generation_elapsed = time.perf_counter() - generation_started
    total_elapsed = time.perf_counter() - total_started

    answer = extract_answer_text(response) or "No answer text was returned by the model."
    debug = None
    if payload.include_debug:
        debug = {
            "retrievedChunks": [
                {
                    "label": f"S{index}",
                    "score": float(score) if score is not None else 0.0,
                    "metadata": dict(getattr(document, "metadata", {}) or {}),
                }
                for index, (document, score) in enumerate(results, start=1)
            ]
        }

    return ChatResponse(
        provider="vertex_ai",
        model=model_name,
        audience=payload.audience,
        answer=answer,
        answer_cards=build_answer_cards(results),
        suggested_follow_ups=build_follow_ups(results, payload.audience),
        sources=format_sources(results),
        timings={
            "retrievalMs": round(retrieval_elapsed * 1000),
            "generationMs": round(generation_elapsed * 1000),
            "totalMs": round(total_elapsed * 1000),
        },
        debug=debug,
    )


def search_only(payload: SearchRequest, vector_store: Any) -> SearchResponse:
    results, _elapsed = search_chunks(vector_store, payload.question.strip(), payload.top_k or 5)
    return SearchResponse(audience=payload.audience, count=len(results), sources=format_sources(results))
