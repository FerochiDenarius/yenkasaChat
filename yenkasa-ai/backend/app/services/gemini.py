from __future__ import annotations

import asyncio
import logging


LOGGER = logging.getLogger("yenkasa_ai_cloud.gemini")


class GeminiService:
    def __init__(self, settings) -> None:
        self.settings = settings
        self._chat_model = None
        self._embedding_model = None

    @property
    def configured(self) -> bool:
        return bool(self.settings.vertex_project_id and self.settings.vertex_location)

    async def embed_texts(self, texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
        _ = task_type
        if not texts:
            return []
        if not self.configured:
            raise RuntimeError("Gemini service is not configured.")
        return await asyncio.to_thread(self._embed_with_vertex, texts)

    async def generate_text(self, prompt: str) -> str:
        if not self.configured:
            raise RuntimeError("Gemini service is not configured.")
        return await asyncio.to_thread(self._generate_with_vertex, prompt)

    def _embed_with_vertex(self, texts: list[str]) -> list[list[float]]:
        from langchain_google_vertexai import VertexAIEmbeddings

        if self._embedding_model is None:
            self._embedding_model = VertexAIEmbeddings(
                model_name=self.settings.gemini_embedding_model,
                project=self.settings.vertex_project_id,
                location=self.settings.vertex_location,
            )
        return self._embedding_model.embed_documents(texts)

    def _generate_with_vertex(self, prompt: str) -> str:
        from langchain_google_vertexai import ChatVertexAI

        if self._chat_model is None:
            self._chat_model = ChatVertexAI(
                model=self.settings.gemini_reasoning_model,
                project=self.settings.vertex_project_id,
                location=self.settings.vertex_location,
                temperature=self.settings.vertex_temperature,
            )
        response = self._chat_model.invoke(prompt)
        return str(getattr(response, "content", response)).strip()
