from __future__ import annotations

import time

from app.schemas import RepoChatResponse
from app.schemas import RepoChatSource


SYSTEM_PROMPT = """You are Yenkasa Dev Intelligence v1.
Answer only from the supplied repository context when the question is repository-specific.
Prefer architecture reasoning, implementation tracing, bug-risk analysis, and scaling recommendations.
If the context is incomplete, say what is missing instead of inventing details.
Reference concrete file paths and line ranges where possible.
"""


class RepoChatService:
    def __init__(self, repo_search_service, gemini_service) -> None:
        self.repo_search = repo_search_service
        self.gemini = gemini_service

    async def answer(self, question: str, repo_name: str | None = None, top_k: int = 6, include_sources: bool = True) -> RepoChatResponse:
        started = time.perf_counter()
        search_response = await self.repo_search.search(question, repo_name=repo_name, top_k=top_k)
        context_blocks = []
        for idx, result in enumerate(search_response.results, start=1):
            context_blocks.append(
                f"[{idx}] {result.file_path}:{result.start_line}-{result.end_line} ({result.language})\n{result.excerpt}"
            )

        prompt = (
            f"{SYSTEM_PROMPT}\n"
            f"Repository: {repo_name or 'all indexed repositories'}\n"
            f"Question: {question}\n\n"
            f"Repository Context:\n{chr(10).join(context_blocks) if context_blocks else 'No repository context found.'}\n\n"
            "Produce a concise engineering answer. Mention uncertainty if retrieval is weak."
        )
        answer = await self.gemini.generate_text(prompt)
        sources = [
            RepoChatSource(
                file_path=result.file_path,
                language=result.language,
                start_line=result.start_line,
                end_line=result.end_line,
                score=result.score,
                excerpt=result.excerpt,
            )
            for result in search_response.results
        ]
        return RepoChatResponse(
            repo_name=repo_name,
            question=question,
            answer=answer,
            sources=sources if include_sources else [],
            timings={
                "search_ms": search_response.took_ms,
                "total_ms": int((time.perf_counter() - started) * 1000),
            },
        )
