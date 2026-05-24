from __future__ import annotations

import logging
from datetime import datetime
from uuid import uuid4

from app.models import RepoChunkDocument
from app.models import RepoIngestionJobDocument
from app.modules.repo_ingestion.chunker import chunk_file_content
from app.schemas import RepoIngestionJobResponse
from app.utils.path_safety import build_repo_name
from app.utils.path_safety import ensure_within_roots


LOGGER = logging.getLogger("yenkasa_ai_cloud.repo_ingestion")


class RepoIngestionService:
    def __init__(
        self,
        settings,
        mongo_service,
        queue_service,
        scanner,
        embeddings_service,
        vector_service,
        insights_service,
    ) -> None:
        self.settings = settings
        self.mongo = mongo_service
        self.queue = queue_service
        self.scanner = scanner
        self.embeddings = embeddings_service
        self.vector = vector_service
        self.insights = insights_service

    async def enqueue(self, payload) -> RepoIngestionJobResponse:
        repo_path = ensure_within_roots(payload.repo_path, self.settings.repo_allowed_roots)
        repo_name = build_repo_name(payload.repo_name, repo_path)
        now = datetime.utcnow()
        job = RepoIngestionJobDocument(
            job_id=str(uuid4()),
            repo_name=repo_name,
            repo_path=str(repo_path),
            status="queued",
            force_reingest=payload.force_reingest,
            created_at=now,
            updated_at=now,
        )
        await self.mongo.jobs_collection.insert_one(job.model_dump(mode="json"))
        await self.queue.enqueue_repo_ingestion(job.job_id)
        LOGGER.info("Queued repo ingestion job_id=%s repo_name=%s repo_path=%s", job.job_id, repo_name, repo_path)
        return RepoIngestionJobResponse(**job.model_dump())

    async def get_job(self, job_id: str) -> RepoIngestionJobResponse:
        document = await self.mongo.jobs_collection.find_one({"job_id": job_id}, projection={"_id": 0})
        if not document:
            raise ValueError(f"Repository ingestion job '{job_id}' was not found.")
        return RepoIngestionJobResponse(**document)

    async def run_job(self, job_id: str) -> RepoIngestionJobResponse:
        document = await self.mongo.jobs_collection.find_one({"job_id": job_id}, projection={"_id": 0})
        if not document:
            raise ValueError(f"Repository ingestion job '{job_id}' was not found.")

        job = RepoIngestionJobDocument(**document)
        repo_path = ensure_within_roots(job.repo_path, self.settings.repo_allowed_roots)
        repo_name = build_repo_name(job.repo_name, repo_path)
        await self.mongo.jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": {"status": "running", "started_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
        )

        if job.force_reingest:
            await self.vector.clear_repository(repo_name)
            await self.mongo.insights_collection.delete_many({"repo_name": repo_name})
            await self.mongo.jobs_collection.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "files_processed": 0,
                        "chunks_indexed": 0,
                        "failed_files": [],
                        "processed_file_paths": [],
                    }
                },
            )

        files = self.scanner.scan(repo_path, repo_name=repo_name)
        await self.mongo.jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": {"files_total": len(files), "updated_at": datetime.utcnow()}},
        )

        for file in files:
            if file.relative_path in job.processed_file_paths:
                continue

            try:
                if await self.vector.file_hash_matches(repo_name, file.relative_path, file.file_hash):
                    await self._mark_file_processed(job_id, file.relative_path, chunks_added=0)
                    continue

                chunks = chunk_file_content(
                    file.content,
                    language=file.language,
                    max_lines=self.settings.repo_chunk_max_lines,
                    overlap_lines=self.settings.repo_chunk_overlap_lines,
                )
                if not chunks:
                    await self._mark_file_processed(job_id, file.relative_path, chunks_added=0)
                    continue

                embeddings = await self.embeddings.embed_documents([chunk.content for chunk in chunks])
                documents = [
                    RepoChunkDocument(
                        repo_name=repo_name,
                        file_path=file.relative_path,
                        language=file.language,
                        chunk_index=chunk.chunk_index,
                        total_chunks=chunk.total_chunks,
                        last_modified=file.last_modified,
                        hash=file.file_hash,
                        content=chunk.content,
                        embedding=embedding,
                        start_line=chunk.start_line,
                        end_line=chunk.end_line,
                        file_size_bytes=file.file_size_bytes,
                        symbol_names=chunk.symbol_names,
                        todo_count=chunk.todo_count,
                        complexity_score=chunk.complexity_score,
                    ).model_dump(mode="json")
                    for chunk, embedding in zip(chunks, embeddings, strict=True)
                ]
                await self.vector.replace_file_chunks(repo_name, file.relative_path, documents)
                await self._mark_file_processed(job_id, file.relative_path, chunks_added=len(documents))
            except Exception as exc:  # pragma: no cover - exercised in integration environments
                LOGGER.exception("Repository ingestion failed job_id=%s file=%s", job_id, file.relative_path)
                await self.mongo.jobs_collection.update_one(
                    {"job_id": job_id},
                    {
                        "$addToSet": {"failed_files": file.relative_path},
                        "$set": {"last_error": str(exc), "updated_at": datetime.utcnow()},
                    },
                )

        await self.insights.regenerate(repo_name)
        await self.mongo.jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": {"status": "completed", "finished_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
        )
        return await self.get_job(job_id)

    async def _mark_file_processed(self, job_id: str, file_path: str, chunks_added: int) -> None:
        await self.mongo.jobs_collection.update_one(
            {"job_id": job_id},
            {
                "$addToSet": {"processed_file_paths": file_path},
                "$inc": {"files_processed": 1, "chunks_indexed": chunks_added},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )
