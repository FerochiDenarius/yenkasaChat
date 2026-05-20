from __future__ import annotations

import logging
import os
import time
from pathlib import Path


LOGGER = logging.getLogger("yenkasa_ai_cloud.vector")


def get_huggingface_embeddings_class():
    try:
        from langchain_huggingface import HuggingFaceEmbeddings

        return HuggingFaceEmbeddings
    except ImportError:
        from langchain_community.embeddings import HuggingFaceEmbeddings

        LOGGER.warning("Falling back to deprecated langchain_community.HuggingFaceEmbeddings.")
        return HuggingFaceEmbeddings


def get_chroma_class():
    try:
        from langchain_chroma import Chroma

        return Chroma
    except ImportError:
        from langchain_community.vectorstores import Chroma

        LOGGER.warning("Falling back to deprecated langchain_community.vectorstores.Chroma.")
        return Chroma


def build_embedding_function(model_name: str):
    started = time.perf_counter()
    chosen = Path(model_name).expanduser()
    if chosen.exists():
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        resolved_model = str(chosen.resolve())
        LOGGER.info("Using local embedding snapshot path=%s", resolved_model)
    else:
        resolved_model = model_name

    HuggingFaceEmbeddings = get_huggingface_embeddings_class()
    embedding = HuggingFaceEmbeddings(
        model_name=resolved_model,
        model_kwargs={"device": "cpu"},
    )
    LOGGER.info("Embedding backend ready model=%s init_time=%.2fs", resolved_model, time.perf_counter() - started)
    return embedding


def build_vector_store(persist_dir: Path, collection_name: str, embedding_function):
    persist_dir.mkdir(parents=True, exist_ok=True)
    Chroma = get_chroma_class()
    started = time.perf_counter()
    store = Chroma(
        persist_directory=str(persist_dir),
        collection_name=collection_name,
        embedding_function=embedding_function,
    )
    LOGGER.info(
        "Vector store ready persist_dir=%s collection=%s init_time=%.2fs",
        persist_dir,
        collection_name,
        time.perf_counter() - started,
    )
    return store
