from __future__ import annotations

import asyncio
import logging


LOGGER = logging.getLogger("yenkasa_ai_cloud.gemini")


class GeminiService:
    def __init__(self, settings) -> None:
        self.settings = settings
        self._genai_client = None
        self._chat_model = None
        self._embedding_model = None

    @property
    def configured(self) -> bool:
        return bool(self.settings.vertex_project_id and self.settings.vertex_location)

    async def embed_texts(self, texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float]]:
        if not texts:
            return []
        if not self.configured:
            raise RuntimeError("Gemini service is not configured.")

        try:
            return await asyncio.to_thread(self._embed_with_genai, texts, task_type)
        except Exception:
            LOGGER.exception("Gemini SDK embedding failed; falling back to Vertex AI embeddings.")
            return await asyncio.to_thread(self._embed_with_vertex, texts)

    async def generate_text(self, prompt: str) -> str:
        if not self.configured:
            raise RuntimeError("Gemini service is not configured.")

        try:
            return await asyncio.to_thread(self._generate_with_genai, prompt)
        except Exception:
            LOGGER.exception("Gemini SDK generation failed; falling back to Vertex AI chat.")
            return await asyncio.to_thread(self._generate_with_vertex, prompt)

    def _get_genai_client(self):
        if self._genai_client is None:
            from google import genai

            self._genai_client = genai.Client(
                vertexai=True,
                project=self.settings.vertex_project_id,
                location=self.settings.vertex_location,
            )
        return self._genai_client

    def _embed_with_genai(self, texts: list[str], task_type: str) -> list[list[float]]:
        from google.genai.types import EmbedContentConfig

        client = self._get_genai_client()
        response = client.models.embed_content(
            model=self.settings.gemini_embedding_model,
            contents=texts,
            config=EmbedContentConfig(task_type=task_type),
        )
        embeddings = getattr(response, "embeddings", None) or []
        return [list(getattr(item, "values", []) or []) for item in embeddings]

    def _generate_with_genai(self, prompt: str) -> str:
        client = self._get_genai_client()
        response = client.models.generate_content(
            model=self.settings.gemini_reasoning_model,
            contents=prompt,
        )
        text = getattr(response, "text", None)
        if text:
            return str(text).strip()
        candidates = getattr(response, "candidates", None) or []
        if candidates:
            content = getattr(candidates[0], "content", None)
            parts = getattr(content, "parts", None) or []
            return "\n".join(str(getattr(part, "text", "")).strip() for part in parts if getattr(part, "text", None)).strip()
        raise RuntimeError("Gemini response did not contain text.")

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
