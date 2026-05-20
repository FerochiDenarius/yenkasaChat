from __future__ import annotations

import logging
from pathlib import Path

from app.models import IngestResponse
from rag.loaders import load_markdown_documents
from rag.loaders import load_pdf_documents


LOGGER = logging.getLogger("yenkasa_ai_cloud.ingest")


class IngestionService:
    def __init__(self, settings, storage_service) -> None:
        self.settings = settings
        self.storage = storage_service

    async def save_uploads(self, files: list, target_dir: Path) -> list[Path]:
        target_dir.mkdir(parents=True, exist_ok=True)
        saved: list[Path] = []
        for upload in files:
            if not upload.filename:
                continue
            destination = target_dir / upload.filename
            with destination.open("wb") as handle:
                handle.write(await upload.read())
            saved.append(destination)
        return saved

    def _target_collection(self, audience: str) -> str:
        return (
            self.settings.engineering_collection_name
            if audience == "engineering"
            else self.settings.public_collection_name
        )

    def _target_store(self, runtime, audience: str):
        return runtime.engineering_vector_store if audience == "engineering" else runtime.public_vector_store

    async def ingest(self, runtime, files: list, audience: str) -> IngestResponse:
        upload_dir = self.settings.local_upload_dir / audience
        saved_files = await self.save_uploads(files, upload_dir)
        if not saved_files:
            raise ValueError("No valid files were uploaded.")

        target_store = self._target_store(runtime, audience)
        total_chunks = 0
        uploaded_to_gcs = False

        for saved_file in saved_files:
            if self.storage.configured:
                blob_name = f"{self.settings.gcs_knowledge_prefix.strip('/')}/{audience}/{saved_file.name}"
                uploaded_to_gcs = self.storage.upload_file(saved_file, blob_name) or uploaded_to_gcs

            if saved_file.suffix.lower() == ".md":
                documents = load_markdown_documents(saved_file, upload_dir, audience)
            elif saved_file.suffix.lower() == ".pdf":
                documents = load_pdf_documents(saved_file, upload_dir, audience)
            else:
                LOGGER.warning("Skipping unsupported upload file=%s", saved_file.name)
                continue

            if not documents:
                LOGGER.warning("Skipping empty upload file=%s", saved_file.name)
                continue

            try:
                target_store.delete(where={"source_file": saved_file.name})
            except Exception:
                LOGGER.exception("Failed deleting prior chunks for file=%s", saved_file.name)

            target_store.add_documents(documents, ids=[document.metadata["chunk_id"] for document in documents])
            total_chunks += len(documents)
            LOGGER.info("Ingested file=%s audience=%s chunks=%d", saved_file.name, audience, len(documents))

        self.storage.upload_directory(self.settings.local_chroma_dir, self.settings.gcs_chroma_prefix)
        return IngestResponse(
            accepted_files=len(saved_files),
            target_collection=self._target_collection(audience),
            uploaded_to_gcs=uploaded_to_gcs,
            chunks_inserted=total_chunks,
            vector_db_path=str(self.settings.local_chroma_dir),
        )
