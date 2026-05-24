from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Iterable

from pymongo.operations import SearchIndexModel

from app.modules.vector_search.index_setup import build_vector_index_definition


LOGGER = logging.getLogger("yenkasa_ai_cloud.vector_search")


class MongoVectorSearchService:
    def __init__(self, settings, mongo_service) -> None:
        self.settings = settings
        self.mongo = mongo_service

    async def ensure_indexes(self) -> None:
        if not self.mongo.configured:
            return

        definition = build_vector_index_definition(self.settings)
        model = SearchIndexModel(
            definition=definition,
            name=self.settings.mongodb_vector_index_name,
            type="vectorSearch",
        )
        try:
            await asyncio.to_thread(self.mongo.sync_chunks_collection.create_search_index, model)
            LOGGER.info("Ensured MongoDB Atlas vector index index=%s", self.settings.mongodb_vector_index_name)
        except Exception:
            LOGGER.exception("Automatic vector index creation failed; apply the documented index definition manually.")

    async def replace_file_chunks(self, repo_name: str, file_path: str, documents: list[dict]) -> None:
        await self.mongo.chunks_collection.delete_many({"repo_name": repo_name, "file_path": file_path})
        if documents:
            await self.mongo.chunks_collection.insert_many(documents)

    async def clear_repository(self, repo_name: str) -> None:
        await self.mongo.chunks_collection.delete_many({"repo_name": repo_name})

    async def file_hash_matches(self, repo_name: str, file_path: str, file_hash: str) -> bool:
        document = await self.mongo.chunks_collection.find_one(
            {"repo_name": repo_name, "file_path": file_path},
            projection={"hash": 1},
        )
        return bool(document and document.get("hash") == file_hash)

    async def similarity_search(
        self,
        query_vector: list[float],
        repo_name: str | None,
        limit: int,
        num_candidates: int,
    ) -> list[dict]:
        vector_stage = {
            "$vectorSearch": {
                "index": self.settings.mongodb_vector_index_name,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": num_candidates,
                "limit": limit,
            }
        }
        if repo_name:
            vector_stage["$vectorSearch"]["filter"] = {"repo_name": repo_name}

        pipeline = [
            vector_stage,
            {
                "$project": {
                    "_id": 0,
                    "repo_name": 1,
                    "file_path": 1,
                    "language": 1,
                    "chunk_index": 1,
                    "total_chunks": 1,
                    "content": 1,
                    "start_line": 1,
                    "end_line": 1,
                    "symbol_names": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]
        return [document async for document in self.mongo.chunks_collection.aggregate(pipeline)]

    async def text_search(self, query: str, repo_name: str | None, limit: int) -> list[dict]:
        tokens = [token for token in re.split(r"\s+", query.strip()) if token]
        if not tokens:
            return []

        token_patterns = [{"content": {"$regex": re.escape(token), "$options": "i"}} for token in tokens[:5]]
        file_pattern = {"file_path": {"$regex": re.escape(query.strip()), "$options": "i"}}
        match = {"$or": [file_pattern, *token_patterns]}
        if repo_name:
            match["repo_name"] = repo_name

        cursor = (
            self.mongo.chunks_collection.find(
                match,
                projection={
                    "_id": 0,
                    "repo_name": 1,
                    "file_path": 1,
                    "language": 1,
                    "chunk_index": 1,
                    "total_chunks": 1,
                    "content": 1,
                    "start_line": 1,
                    "end_line": 1,
                    "symbol_names": 1,
                },
            )
            .limit(limit)
        )
        results = []
        async for document in cursor:
            document["score"] = 0.35
            results.append(document)
        return results

    async def fetch_repo_chunks(self, repo_name: str) -> list[dict]:
        cursor = self.mongo.chunks_collection.find(
            {"repo_name": repo_name},
            projection={
                "_id": 0,
                "repo_name": 1,
                "file_path": 1,
                "language": 1,
                "chunk_index": 1,
                "total_chunks": 1,
                "content": 1,
                "start_line": 1,
                "end_line": 1,
                "symbol_names": 1,
                "todo_count": 1,
                "complexity_score": 1,
                "file_size_bytes": 1,
            },
        )
        return [document async for document in cursor]

    async def latest_jobs(self, limit: int = 10) -> list[dict]:
        cursor = (
            self.mongo.jobs_collection.find(
                {},
                projection={
                    "_id": 0,
                    "job_id": 1,
                    "repo_name": 1,
                    "status": 1,
                    "files_total": 1,
                    "files_processed": 1,
                    "chunks_indexed": 1,
                    "updated_at": 1,
                },
            )
            .sort("updated_at", -1)
            .limit(limit)
        )
        return [document async for document in cursor]

    @staticmethod
    def dedupe_results(results: Iterable[dict], limit: int) -> list[dict]:
        deduped: list[dict] = []
        seen: set[tuple[str, str, int]] = set()
        for item in results:
            key = (item.get("repo_name", ""), item.get("file_path", ""), int(item.get("chunk_index", 0)))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= limit:
                break
        return deduped
