from __future__ import annotations

import logging
import time
from pathlib import Path

from app.models import ChatRequest
from app.models import ChatResponse
from app.models import HealthResponse
from app.models import SearchRequest
from app.models import SearchResponse
from rag.loaders import load_markdown_documents
from rag.prompts import build_hybrid_prompt
from rag.prompts import build_public_prompt
from rag.vector_store import build_embedding_function
from rag.vector_store import build_vector_store
from services.ingest_service import IngestionService
from services.retrieval_service import chat_with_rag
from services.retrieval_service import search_only
from services.storage_service import GCSStorageService
from services.vertex_service import build_chat_model


LOGGER = logging.getLogger("yenkasa_ai_cloud.runtime")


class RagRuntime:
    def __init__(self, settings) -> None:
        self.settings = settings
        self.storage = GCSStorageService(
            project_id=settings.vertex_project_id,
            bucket_name=settings.gcs_bucket,
            chroma_prefix=settings.gcs_chroma_prefix,
            knowledge_prefix=settings.gcs_knowledge_prefix,
        )
        self.ingestion = IngestionService(settings, self.storage)
        self.embedding_function = None
        self.engineering_vector_store = None
        self.public_vector_store = None
        self.llm = None
        self.hybrid_prompt = build_hybrid_prompt()
        self.public_prompt = build_public_prompt()
        self.startup_timings: dict[str, float] = {}
        self.collection_stats: dict[str, dict[str, object]] = {}
        self.snapshot_summary: dict[str, object] = {}

    def startup(self) -> None:
        started = time.perf_counter()
        self.settings.local_chroma_dir.mkdir(parents=True, exist_ok=True)
        self.settings.local_upload_dir.mkdir(parents=True, exist_ok=True)

        sync_started = time.perf_counter()
        if self.storage.configured:
            self.storage.download_directory(self.settings.gcs_chroma_prefix, self.settings.local_chroma_dir)
        self.startup_timings["gcs_sync_s"] = time.perf_counter() - sync_started

        embedding_started = time.perf_counter()
        self.embedding_function = build_embedding_function(self.settings.embedding_model)
        self.startup_timings["embedding_init_s"] = time.perf_counter() - embedding_started

        vector_started = time.perf_counter()
        self.engineering_vector_store = build_vector_store(
            self.settings.local_chroma_dir,
            self.settings.engineering_collection_name,
            self.embedding_function,
        )
        self.public_vector_store = build_vector_store(
            self.settings.local_chroma_dir,
            self.settings.public_collection_name,
            self.embedding_function,
        )
        self.startup_timings["vector_store_init_s"] = time.perf_counter() - vector_started
        self.snapshot_summary = self.summarize_snapshot(self.settings.local_chroma_dir)
        self.collection_stats = {
            "engineering": self.summarize_collection(self.engineering_vector_store, self.settings.engineering_collection_name),
            "public": self.summarize_collection(self.public_vector_store, self.settings.public_collection_name),
        }
        LOGGER.info(
            "Snapshot ready path=%s files=%s bytes=%s latest_mtime=%s",
            self.snapshot_summary["path"],
            self.snapshot_summary["fileCount"],
            self.snapshot_summary["totalBytes"],
            self.snapshot_summary["latestModifiedAt"],
        )
        for audience, stats in self.collection_stats.items():
            LOGGER.info(
                "Collection loaded audience=%s name=%s vectors=%s sources=%s categories=%s",
                audience,
                stats["name"],
                stats["vectorCount"],
                stats["sourceCount"],
                stats["categoryCount"],
            )

        llm_started = time.perf_counter()
        self.llm = build_chat_model(
            project_id=self.settings.vertex_project_id,
            location=self.settings.vertex_location,
            model_name=self.settings.vertex_model,
            temperature=self.settings.vertex_temperature,
        )
        self.startup_timings["llm_init_s"] = time.perf_counter() - llm_started

        if self.settings.public_bootstrap_dir and self.settings.public_bootstrap_dir.exists():
            try:
                self.bootstrap_public_collection()
            except Exception:
                LOGGER.exception("Public bootstrap sync failed")

        self.startup_timings["total_startup_s"] = time.perf_counter() - started

    def shutdown(self) -> None:
        return

    def bootstrap_public_collection(self) -> None:
        existing_count = int(self.public_vector_store._collection.count())  # noqa: SLF001
        if existing_count > 0:
            return

        for markdown_path in sorted(self.settings.public_bootstrap_dir.rglob("*.md")):
            if markdown_path.name.lower() == "readme.md":
                continue
            documents = load_markdown_documents(markdown_path, self.settings.public_bootstrap_dir, "public")
            if not documents:
                continue
            self.public_vector_store.add_documents(documents, ids=[doc.metadata["chunk_id"] for doc in documents])
            LOGGER.info("Bootstrapped public knowledge file=%s chunks=%d", markdown_path.name, len(documents))

        if self.storage.configured:
            self.storage.upload_directory(self.settings.local_chroma_dir, self.settings.gcs_chroma_prefix)

    @staticmethod
    def summarize_snapshot(chroma_dir: Path) -> dict[str, object]:
        files = [path for path in chroma_dir.rglob("*") if path.is_file()]
        latest_mtime = max((path.stat().st_mtime for path in files), default=0.0)
        total_bytes = sum(path.stat().st_size for path in files)
        return {
            "path": str(chroma_dir),
            "fileCount": len(files),
            "totalBytes": total_bytes,
            "latestModifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(latest_mtime)) if latest_mtime else None,
        }

    @staticmethod
    def summarize_collection(vector_store, collection_name: str) -> dict[str, object]:
        metadatas = vector_store._collection.get(include=["metadatas"]).get("metadatas", [])  # noqa: SLF001
        source_paths = {
            (metadata or {}).get("source_relative_path") or (metadata or {}).get("source_file")
            for metadata in metadatas
            if metadata
        }
        categories = {(metadata or {}).get("category") for metadata in metadatas if metadata and (metadata or {}).get("category")}
        return {
            "name": collection_name,
            "vectorCount": int(vector_store._collection.count()),  # noqa: SLF001
            "sourceCount": len(source_paths),
            "categoryCount": len(categories),
        }

    def health(self) -> HealthResponse:
        return HealthResponse(
            status="operational",
            provider="vertex_ai",
            model=self.settings.vertex_model,
            project_id=self.settings.vertex_project_id,
            location=self.settings.vertex_location,
            collections={
                "engineering": self.settings.engineering_collection_name,
                "public": self.settings.public_collection_name,
            },
            collection_stats=self.collection_stats,
            vector_db_path=str(self.settings.local_chroma_dir),
            gcs_bucket=self.settings.gcs_bucket,
            snapshot=self.snapshot_summary,
            startup_timings=self.startup_timings,
        )

    def chat(self, payload: ChatRequest, extra_context: str | None = None) -> ChatResponse:
        return chat_with_rag(
            payload=payload,
            public_vector_store=self.public_vector_store,
            engineering_vector_store=self.engineering_vector_store,
            llm=self.llm,
            prompt=self.hybrid_prompt,
            model_name=self.settings.vertex_model,
            max_history_turns=self.settings.max_history_turns,
            retrieval_k=self.settings.retrieval_k,
            extra_context=extra_context,
        )

    def search(self, payload: SearchRequest) -> SearchResponse:
        vector_store = self.engineering_vector_store if payload.audience == "engineering" else self.public_vector_store
        return search_only(payload, vector_store)

    async def ingest(self, files: list, audience: str):
        return await self.ingestion.ingest(self, files, audience)
