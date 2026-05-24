from __future__ import annotations

import asyncio
import logging


LOGGER = logging.getLogger("yenkasa_ai_cloud.embeddings")


class EmbeddingsService:
    def __init__(self, settings, gemini_service) -> None:
        self.settings = settings
        self.gemini = gemini_service

    async def embed_documents(self, documents: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        batch_size = max(1, self.settings.embedding_batch_size)
        for index in range(0, len(documents), batch_size):
            batch = documents[index : index + batch_size]
            vectors.extend(await self._embed_batch_with_retry(batch))
        return vectors

    async def embed_query(self, query: str) -> list[float]:
        results = await self._embed_batch_with_retry([query], task_type="RETRIEVAL_QUERY")
        return results[0]

    async def _embed_batch_with_retry(self, batch: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
        last_error: Exception | None = None
        for attempt in range(1, self.settings.embedding_retry_attempts + 1):
            try:
                return await self.gemini.embed_texts(batch, task_type=task_type)
            except Exception as exc:  # pragma: no cover - exercised in integration environments
                last_error = exc
                wait_s = min(2**attempt, 10)
                LOGGER.warning(
                    "Embedding batch failed attempt=%s/%s wait_s=%s error=%s",
                    attempt,
                    self.settings.embedding_retry_attempts,
                    wait_s,
                    exc,
                )
                await asyncio.sleep(wait_s)
        raise RuntimeError("Embedding generation failed after retries.") from last_error
