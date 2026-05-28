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

ENGINEERING_FOLLOW_UPS = [
    "How does this compare with standard social platform architecture?",
    "What should be refactored first to reduce scaling risk?",
    "Which parts should stay monolithic and which should split out?",
]

HYBRID_GENERAL_FOLLOW_UPS = [
    "How does this compare with engineering best practice?",
    "What are the biggest scaling risks here?",
    "What would you improve first if this had to grow fast?",
]

ENGINEERING_INTENT_TERMS = (
    "api",
    "architecture",
    "backend",
    "cache",
    "cloud run",
    "code",
    "database",
    "deploy",
    "engineering",
    "feed",
    "flutter",
    "infrastructure",
    "kotlin",
    "latency",
    "microservice",
    "mobile",
    "node",
    "performance",
    "queue",
    "redis",
    "scal",
    "socket",
    "system design",
)

FOUNDER_INTENT_TERMS = (
    "bright kofi",
    "bright kofi ofosu menya",
    "creator",
    "developer identity",
    "ferochi",
    "ferochi denarius",
    "founded",
    "founder",
    "history",
    "origin",
    "who built",
    "who created",
    "why yenkasa exists",
)

TOKENOMICS_INTENT_TERMS = (
    "coin",
    "economy",
    "monetization",
    "reward",
    "rewards",
    "token",
    "tokenomics",
    "ykc",
)

COMMUNITY_INTENT_TERMS = (
    "blocking",
    "communities",
    "community",
    "feed",
    "filtering",
    "privacy",
    "verification",
)

CURATED_SOURCE_MARKERS = (
    "/tmp/yenkasa-ai/uploads/",
    "/backend/knowledge/semantic/",
)

LEGACY_YENKASA_SOURCE_MARKERS = (
    "/Users/kofibright/yenkasaChat/yenkasa_knowledge/",
)

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


def source_priority(metadata: dict[str, Any]) -> tuple[int, int]:
    source_path = str(metadata.get("source_path", ""))
    source_file = str(metadata.get("source_file", "")).lower()
    category = str(metadata.get("category", "")).lower()

    if any(marker in source_path for marker in CURATED_SOURCE_MARKERS):
        return (0, 0)

    if any(marker in source_path for marker in LEGACY_YENKASA_SOURCE_MARKERS):
        return (1, 0)

    if "yenkasa" in source_file or "ykc" in source_file or category.startswith("founder") or category.startswith("ecosystem"):
        return (1, 1)

    return (2, 0)


def search_chunks_with_queries(vector_store: Any, queries: list[str], top_k: int) -> tuple[list[tuple], float]:
    started = time.perf_counter()
    merged_results: list[tuple] = []
    seen_queries: set[str] = set()

    for query in queries:
        normalized_query = query.strip()
        if not normalized_query or normalized_query in seen_queries:
            continue
        seen_queries.add(normalized_query)
        merged_results.extend(vector_store.similarity_search_with_score(normalized_query, k=top_k))

    sorted_results = sorted(
        merged_results,
        key=lambda item: (
            *source_priority(dict(getattr(item[0], "metadata", {}) or {})),
            float(item[1]) if item[1] is not None else float("inf"),
        ),
    )
    return dedupe_results(sorted_results, max(top_k * 2, top_k)), time.perf_counter() - started


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


def format_context(results: list[tuple], empty_message: str = "No relevant context retrieved.") -> str:
    if not results:
        return empty_message

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
        return ENGINEERING_FOLLOW_UPS

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


def is_engineering_question(question: str) -> bool:
    lowered = question.lower()
    return any(term in lowered for term in ENGINEERING_INTENT_TERMS)


def contains_any_term(question: str, terms: tuple[str, ...]) -> bool:
    lowered = question.lower()
    return any(term in lowered for term in terms)


def build_public_search_queries(question: str) -> list[str]:
    queries = [question]

    if contains_any_term(question, FOUNDER_INTENT_TERMS):
        queries.insert(
            0,
            (
                f"{question}\n"
                "Focus on founder identity, creator biography, project origin, history, and motivation. "
                "Important entities: Bright Kofi Ofosu Menya, Ferochi Denarius, Yenkasa Soft-O-Tech."
            ),
        )

    if contains_any_term(question, TOKENOMICS_INTENT_TERMS):
        queries.append(
            (
                f"{question}\n"
                "Focus on Yenkasa Coin, YKC utility, rewards, tokenomics, monetization, and participation economy."
            )
        )

    if contains_any_term(question, COMMUNITY_INTENT_TERMS):
        queries.append(
            (
                f"{question}\n"
                "Focus on verification systems, privacy controls, communities, feed filtering, and trust architecture."
            )
        )

    return queries


def build_engineering_search_queries(question: str) -> list[str]:
    queries = [question]

    if is_engineering_question(question):
        queries.append(
            (
                f"{question}\n"
                "Focus on current implementation, architecture, scalability risks, cloud deployment, "
                "backend design, mobile engineering, and best-practice tradeoffs."
            )
        )

    if "compare" in question.lower() or "versus" in question.lower() or " vs " in question.lower():
        queries.append(
            (
                f"{question}\n"
                "Focus on architecture comparison, scaling tradeoffs, and engineering standards."
            )
        )

    return queries


def best_relevance(results: list[tuple]) -> float:
    if not results:
        return 0.0
    return max(1 / (1 + max(0.0, float(score or 0.0))) for _document, score in results)


def filter_results_for_context(results: list[tuple], min_relevance: float = 0.34) -> list[tuple]:
    filtered = [
        (document, score)
        for document, score in results
        if (1 / (1 + max(0.0, float(score or 0.0)))) >= min_relevance
    ]
    return filtered


def merge_results_by_priority(*result_groups: list[tuple], limit: int) -> list[tuple]:
    merged: list[tuple] = []
    seen: set[str] = set()
    for results in result_groups:
        for document, score in results:
            metadata = dict(getattr(document, "metadata", {}) or {})
            chunk_id = metadata.get("chunk_id") or metadata.get("source_relative_path")
            dedupe_key = f"{chunk_id}:{hash((document.page_content or '').strip())}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            merged.append((document, score))
            if len(merged) >= limit:
                return merged
    return merged


def build_combined_context(public_results: list[tuple], engineering_results: list[tuple]) -> str:
    public_context = format_context(
        public_results,
        empty_message="No direct Yenkasa platform passages were retrieved for this question.",
    )
    engineering_context = format_context(
        engineering_results,
        empty_message="No direct engineering or uploaded-document passages were retrieved for this question.",
    )
    return (
        "YENKASA KNOWLEDGE:\n"
        f"{public_context}\n\n"
        "ENGINEERING KNOWLEDGE:\n"
        f"{engineering_context}"
    )


def build_retrieval_status(public_results: list[tuple], engineering_results: list[tuple]) -> str:
    public_relevance = best_relevance(public_results)
    engineering_relevance = best_relevance(engineering_results)

    if not public_results and not engineering_results:
        return (
            "No high-confidence knowledge-base matches were retrieved. "
            "Answer using general engineering and product reasoning, and clearly mark that the answer is best-practice guidance."
        )

    status = [
        f"Yenkasa retrieval relevance: {public_relevance:.2f}",
        f"Engineering retrieval relevance: {engineering_relevance:.2f}",
    ]
    if public_relevance < 0.38 and engineering_relevance < 0.38:
        status.append(
            "Both retrieval channels are weak. Lean on general reasoning while avoiding unsupported Yenkasa-specific claims."
        )
    elif public_relevance < 0.38:
        status.append(
            "Yenkasa retrieval is weak. Use engineering reasoning where needed and be explicit when advice is not grounded in Yenkasa docs."
        )
    elif engineering_relevance < 0.38:
        status.append(
            "Engineering retrieval is weak. Prioritize Yenkasa context, then general best practices if extra implementation advice is needed."
        )
    else:
        status.append("Both retrieval channels have usable signal. Combine them thoughtfully.")
    return "\n".join(status)


def build_hybrid_follow_ups(
    question: str,
    public_results: list[tuple],
    engineering_results: list[tuple],
    audience: str,
) -> list[str]:
    if (
        audience == "engineering"
        or best_relevance(engineering_results) >= 0.38
        or is_engineering_question(question)
    ):
        return ENGINEERING_FOLLOW_UPS

    public_suggestions = build_follow_ups(public_results, "public")
    merged: list[str] = []
    for suggestion in [*public_suggestions, *HYBRID_GENERAL_FOLLOW_UPS]:
        if suggestion not in merged:
            merged.append(suggestion)
    return merged[:3]


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
    public_vector_store: Any,
    engineering_vector_store: Any,
    llm: Any,
    prompt: Any,
    model_name: str,
    max_history_turns: int,
    retrieval_k: int,
    extra_context: str | None = None,
) -> ChatResponse:
    if payload.audience == "public" and is_public_unsafe(payload.question):
        return safe_public_response(model_name)

    total_started = time.perf_counter()
    public_results, public_retrieval_elapsed = search_chunks_with_queries(
        public_vector_store,
        build_public_search_queries(payload.question.strip()),
        retrieval_k,
    )
    engineering_results, engineering_retrieval_elapsed = search_chunks_with_queries(
        engineering_vector_store,
        build_engineering_search_queries(payload.question.strip()),
        retrieval_k,
    )
    public_results = filter_results_for_context(public_results)
    engineering_results = filter_results_for_context(engineering_results)
    results = merge_results_by_priority(
        public_results,
        engineering_results,
        limit=max(retrieval_k * 2, 8),
    )
    history = format_history(history_to_pairs(payload.history), max_history_turns)
    context = build_combined_context(public_results, engineering_results)
    if extra_context:
        context = f"{context}\n\nLIVE OPERATIONS CONTEXT:\n{extra_context}"
    retrieval_status = build_retrieval_status(public_results, engineering_results)

    generation_started = time.perf_counter()
    response = llm.invoke(
        prompt.format_messages(
            audience_mode=(
                "Engineering code assistant mode: be technically rigorous, implementation-first, concise, and production-oriented."
                if payload.audience == "engineering"
                else "Product and code assistant mode: stay clear and accessible, but still provide implementation-ready engineering answers when asked."
            ),
            history=history,
            question=payload.question.strip(),
            context=context,
            retrieval_status=retrieval_status,
        )
    )
    generation_elapsed = time.perf_counter() - generation_started
    total_elapsed = time.perf_counter() - total_started

    answer = extract_answer_text(response) or "No answer text was returned by the model."
    debug = None
    if payload.include_debug:
        debug = {
            "retrievalMode": "hybrid_reasoning",
            "publicRetrievedChunks": [
                {
                    "label": f"P{index}",
                    "score": float(score) if score is not None else 0.0,
                    "metadata": dict(getattr(document, "metadata", {}) or {}),
                }
                for index, (document, score) in enumerate(public_results, start=1)
            ],
            "engineeringRetrievedChunks": [
                {
                    "label": f"E{index}",
                    "score": float(score) if score is not None else 0.0,
                    "metadata": dict(getattr(document, "metadata", {}) or {}),
                }
                for index, (document, score) in enumerate(engineering_results, start=1)
            ],
            "mergedRetrievedChunks": [
                {
                    "label": f"S{index}",
                    "score": float(score) if score is not None else 0.0,
                    "metadata": dict(getattr(document, "metadata", {}) or {}),
                }
                for index, (document, score) in enumerate(results, start=1)
            ],
            "liveContextIncluded": bool(extra_context),
        }

    return ChatResponse(
        provider="vertex_ai",
        model=model_name,
        audience=payload.audience,
        answer=answer,
        answer_cards=build_answer_cards(results),
        suggested_follow_ups=build_hybrid_follow_ups(
            payload.question.strip(),
            public_results,
            engineering_results,
            payload.audience,
        ),
        sources=format_sources(results),
        timings={
            "retrievalMs": round((public_retrieval_elapsed + engineering_retrieval_elapsed) * 1000),
            "publicRetrievalMs": round(public_retrieval_elapsed * 1000),
            "engineeringRetrievalMs": round(engineering_retrieval_elapsed * 1000),
            "generationMs": round(generation_elapsed * 1000),
            "totalMs": round(total_elapsed * 1000),
        },
        debug=debug,
    )


def search_only(payload: SearchRequest, vector_store: Any) -> SearchResponse:
    queries = (
        build_engineering_search_queries(payload.question.strip())
        if payload.audience == "engineering"
        else build_public_search_queries(payload.question.strip())
    )
    results, _elapsed = search_chunks_with_queries(vector_store, queries, payload.top_k or 5)
    return SearchResponse(audience=payload.audience, count=len(results), sources=format_sources(results))
