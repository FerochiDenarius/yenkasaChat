from __future__ import annotations

import asyncio
import logging
import json

from redis import Redis
from rq import Queue


LOGGER = logging.getLogger("yenkasa_ai_cloud.queue")


class QueueService:
    def __init__(self, settings) -> None:
        self.settings = settings
        self.connection: Redis | None = None
        self.repo_ingestion_queue: Queue | None = None

    @property
    def configured(self) -> bool:
        return bool(self.settings.redis_url)

    async def connect(self) -> None:
        if not self.configured:
            LOGGER.warning("Redis queue not configured; ingestion jobs cannot be enqueued.")
            return

        self.connection = Redis.from_url(self.settings.redis_url)
        await asyncio.to_thread(self.connection.ping)
        self.repo_ingestion_queue = Queue(
            self.settings.repo_ingestion_queue_name,
            connection=self.connection,
            default_timeout=self.settings.repo_ingestion_job_timeout_s,
        )
        LOGGER.info("Redis queue ready queue=%s", self.settings.repo_ingestion_queue_name)

    async def enqueue_repo_ingestion(self, ingestion_job_id: str) -> str:
        if self.repo_ingestion_queue is None:
            raise RuntimeError("Redis queue is not configured.")
        job = await asyncio.to_thread(
            self.repo_ingestion_queue.enqueue,
            "app.workers.tasks.ingest_repository_job",
            ingestion_job_id,
            job_id=f"repo-ingestion:{ingestion_job_id}",
            retry=None,
        )
        return job.id

    async def get_queue_length(self) -> int:
        if self.repo_ingestion_queue is None:
            return 0
        return await asyncio.to_thread(len, self.repo_ingestion_queue)

    async def ping(self) -> None:
        if self.connection is None:
            raise RuntimeError("Redis is not configured.")
        await asyncio.to_thread(self.connection.ping)

    async def increment_window(self, key: str, window_s: int) -> int:
        if self.connection is None:
            return 0

        def _increment() -> int:
            current = self.connection.incr(key)
            if current == 1:
                self.connection.expire(key, window_s)
            return int(current)

        return await asyncio.to_thread(_increment)

    async def set_json(self, key: str, value: dict, ttl_s: int) -> None:
        if self.connection is None:
            return
        await asyncio.to_thread(self.connection.setex, key, ttl_s, json.dumps(value))

    async def delete_key(self, key: str) -> None:
        if self.connection is None:
            return
        await asyncio.to_thread(self.connection.delete, key)

    async def close(self) -> None:
        if self.connection is not None:
            await asyncio.to_thread(self.connection.close)
