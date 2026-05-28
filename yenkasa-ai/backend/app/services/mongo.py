from __future__ import annotations

import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from pymongo import MongoClient


LOGGER = logging.getLogger("yenkasa_ai_cloud.mongo")


class MongoService:
    def __init__(self, settings) -> None:
        self.settings = settings
        self.async_client: AsyncIOMotorClient | None = None
        self.sync_client: MongoClient | None = None
        self.database = None
        self.operational_database = None
        self.sync_database = None

    @property
    def configured(self) -> bool:
        return bool(self.settings.mongodb_uri and self.settings.mongodb_database)

    @property
    def chunks_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_chunks_collection]

    @property
    def jobs_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_jobs_collection]

    @property
    def insights_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_insights_collection]

    @property
    def users_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_users_collection]

    @property
    def sessions_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_sessions_collection]

    @property
    def yme_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_yme_collection]

    @property
    def conversations_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_conversations_collection]

    @property
    def security_alerts_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_security_alerts_collection]

    @property
    def events_collection(self):
        if self.database is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.database[self.settings.mongodb_events_collection]

    @property
    def sync_chunks_collection(self):
        if self.sync_database is None:
            raise RuntimeError("MongoDB sync client is not connected.")
        return self.sync_database[self.settings.mongodb_chunks_collection]

    def get_database(self, name: str | None = None):
        if self.async_client is None:
            raise RuntimeError("MongoDB is not connected.")
        return self.async_client[name or self.settings.mongodb_database]

    def get_collection(self, name: str, *, operational: bool = False):
        database = self.operational_database if operational else self.database
        if database is None:
            raise RuntimeError("MongoDB is not connected.")
        return database[name]

    async def connect(self) -> None:
        if not self.configured:
            LOGGER.warning("MongoDB not configured; dev intelligence data APIs will stay degraded.")
            return

        self.async_client = AsyncIOMotorClient(
            self.settings.mongodb_uri,
            serverSelectionTimeoutMS=self.settings.mongodb_server_selection_timeout_ms,
        )
        self.sync_client = MongoClient(
            self.settings.mongodb_uri,
            serverSelectionTimeoutMS=self.settings.mongodb_server_selection_timeout_ms,
        )
        self.database = self.async_client[self.settings.mongodb_database]
        self.operational_database = self.async_client[self.settings.mongodb_operational_database]
        self.sync_database = self.sync_client[self.settings.mongodb_database]
        await self.ping()
        await self.ensure_indexes()
        LOGGER.info(
            "MongoDB ready database=%s operational_database=%s",
            self.settings.mongodb_database,
            self.settings.mongodb_operational_database,
        )

    async def ensure_indexes(self) -> None:
        if self.database is None:
            return

        await self.jobs_collection.create_index([("job_id", ASCENDING)], unique=True)
        await self.jobs_collection.create_index([("repo_name", ASCENDING), ("status", ASCENDING)])
        await self.chunks_collection.create_index(
            [("repo_name", ASCENDING), ("file_path", ASCENDING), ("chunk_index", ASCENDING)],
            unique=True,
        )
        await self.chunks_collection.create_index([("repo_name", ASCENDING), ("hash", ASCENDING)])
        await self.chunks_collection.create_index([("repo_name", ASCENDING), ("language", ASCENDING)])
        await self.insights_collection.create_index([("repo_name", ASCENDING), ("insight_type", ASCENDING)])
        await self.users_collection.create_index([("user_id", ASCENDING)], unique=True)
        await self.users_collection.create_index([("email", ASCENDING)], unique=True)
        await self.users_collection.create_index([("username", ASCENDING)], unique=True)
        await self.sessions_collection.create_index([("session_id", ASCENDING)], unique=True)
        await self.sessions_collection.create_index([("user_id", ASCENDING), ("status", ASCENDING)])
        await self.yme_collection.create_index([("user_id", ASCENDING), ("timestamp", ASCENDING)])
        await self.conversations_collection.create_index([("conversation_id", ASCENDING)], unique=True)
        await self.conversations_collection.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        await self.security_alerts_collection.create_index([("created_at", ASCENDING)])
        await self.events_collection.create_index([("event_type", ASCENDING), ("timestamp", ASCENDING)])

    async def ping(self) -> None:
        if self.async_client is None:
            raise RuntimeError("MongoDB is not configured.")
        await self.async_client.admin.command("ping")

    async def close(self) -> None:
        if self.async_client is not None:
            self.async_client.close()
        if self.sync_client is not None:
            await asyncio.to_thread(self.sync_client.close)
