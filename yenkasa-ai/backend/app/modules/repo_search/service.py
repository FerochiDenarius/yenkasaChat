from __future__ import annotations

import time

from app.schemas import RepoSearchResponse
from app.schemas import RepoSearchResult


def infer_search_mode(query: str) -> str:
    lowered = query.lower()
    if any(term in lowered for term in ("architecture", "flow", "scaling", "system design")):
        return "architecture_lookup"
    if any(term in lowered for term in ("where", "find", "handled", "implemented", "logic")):
        return "implementation_trace"
    return "semantic_search"


class RepoSearchService:
    def __init__(self, settings, embeddings_service, vector_service) -> None:
        self.settings = settings
        self.embeddings = embeddings_service
        self.vector_search = vector_service

    async def search(self, query: str, repo_name: str | None = None, top_k: int | None = None) -> RepoSearchResponse:
        started = time.perf_counter()
        limit = top_k or self.settings.repo_search_top_k
        mode = infer_search_mode(query)

        vector_results: list[dict] = []
        try:
            query_vector = await self.embeddings.embed_query(query)
            vector_results = await self.vector_search.similarity_search(
                query_vector=query_vector,
                repo_name=repo_name,
                limit=limit,
                num_candidates=self.settings.repo_search_num_candidates,
            )
        except Exception:
            vector_results = []

        text_results = await self.vector_search.text_search(query, repo_name=repo_name, limit=limit)
        merged = self.vector_search.dedupe_results([*vector_results, *text_results], limit)
        results = [
            RepoSearchResult(
                repo_name=item["repo_name"],
                file_path=item["file_path"],
                language=item["language"],
                chunk_index=int(item["chunk_index"]),
                total_chunks=int(item["total_chunks"]),
                start_line=int(item["start_line"]),
                end_line=int(item["end_line"]),
                score=round(float(item.get("score", 0.0)), 6),
                excerpt=str(item.get("content", "")).strip()[:450],
                symbols=list(item.get("symbol_names", []) or []),
                metadata={"mode": mode},
            )
            for item in merged
        ]
        return RepoSearchResponse(
            query=query,
            repo_name=repo_name,
            mode=mode,
            count=len(results),
            took_ms=int((time.perf_counter() - started) * 1000),
            results=results,
        )
