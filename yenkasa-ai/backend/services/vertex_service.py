from __future__ import annotations

import logging
import os


LOGGER = logging.getLogger("yenkasa_ai_cloud.vertex")


def build_chat_model(project_id: str, location: str, model_name: str, temperature: float):
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        LOGGER.warning("Ignoring GOOGLE_API_KEY/GEMINI_API_KEY because Vertex AI uses ADC.")

    import google.auth
    from langchain_google_vertexai import ChatVertexAI

    google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    llm = ChatVertexAI(
        model=model_name,
        project=project_id,
        location=location,
        temperature=temperature,
    )
    LOGGER.info("Vertex AI chat model ready model=%s project=%s location=%s", model_name, project_id, location)
    return llm
