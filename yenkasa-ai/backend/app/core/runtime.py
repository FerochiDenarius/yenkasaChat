from __future__ import annotations

import logging

from app.modules.analytics import AnalyticsService
from app.modules.auth import AuthService
from app.modules.crl import ConsciousReasoningLayer
from app.modules.embeddings import EmbeddingsService
from app.modules.events import EventService
from app.modules.live_ops import LiveOpsService
from app.modules.repo_chat import RepoChatService
from app.modules.repo_ingestion import RepoIngestionService
from app.modules.repo_ingestion import RepositoryScanner
from app.modules.repo_insights import RepoInsightsService
from app.modules.repo_search import RepoSearchService
from app.modules.security import PasswordService
from app.modules.security import SecurityService
from app.modules.security import TokenService
from app.modules.sessions import SessionService
from app.modules.tracking import AITrackingService
from app.modules.users import UserService
from app.modules.vector_search import MongoVectorSearchService
from app.modules.yme import YMETrackingService
from app.services import GeminiService
from app.services import MongoService
from app.services import QueueService


LOGGER = logging.getLogger("yenkasa_ai_cloud.intelligence_runtime")


class IntelligenceRuntime:
    def __init__(self, settings) -> None:
        self.settings = settings
        self.mongo = MongoService(settings)
        self.queue = QueueService(settings)
        self.gemini = GeminiService(settings)
        self.passwords = PasswordService()
        self.tokens = TokenService(settings)
        self.security = SecurityService(settings, self.mongo, self.queue, self.passwords, self.tokens)
        self.users = UserService(self.mongo, self.passwords)
        self.sessions = SessionService(settings, self.mongo, self.security)
        self.yme = YMETrackingService(self.mongo)
        self.tracking = AITrackingService(settings, self.mongo, self.users, self.yme)
        self.auth = AuthService(settings, self.users, self.sessions, self.security)
        self.analytics = AnalyticsService(self.mongo, self.users, self.sessions, self.security)
        self.embeddings = EmbeddingsService(settings, self.gemini)
        self.vector_search = MongoVectorSearchService(settings, self.mongo)
        self.repo_search = RepoSearchService(settings, self.embeddings, self.vector_search)
        self.repo_insights = RepoInsightsService(settings, self.mongo, self.vector_search)
        self.repo_chat = RepoChatService(self.repo_search, self.gemini)
        self.repo_ingestion = RepoIngestionService(
            settings=settings,
            mongo_service=self.mongo,
            queue_service=self.queue,
            scanner=RepositoryScanner(settings),
            embeddings_service=self.embeddings,
            vector_service=self.vector_search,
            insights_service=self.repo_insights,
        )
        self.events = EventService(self.mongo)
        self.live_ops = LiveOpsService(self.mongo)
        self.crl = ConsciousReasoningLayer(self.mongo)

    async def startup(self) -> None:
        if not self.settings.dev_intelligence_enabled:
            LOGGER.warning("Dev intelligence runtime disabled by configuration.")
            return

        await self.mongo.connect()
        await self.queue.connect()
        await self.vector_search.ensure_indexes()

    async def shutdown(self) -> None:
        await self.queue.close()
        await self.mongo.close()

    async def system_health(self) -> dict:
        components: dict[str, dict] = {}
        status = "operational"

        try:
            await self.mongo.ping()
            components["mongodb"] = {
                "status": "operational",
                "detail": "MongoDB Atlas connection healthy.",
                "metrics": {"database": self.settings.mongodb_database},
            }
        except Exception as exc:
            status = "degraded"
            components["mongodb"] = {"status": "degraded", "detail": str(exc), "metrics": {}}

        try:
            await self.queue.ping()
            components["redis"] = {
                "status": "operational",
                "detail": "Redis queue reachable.",
                "metrics": {"queue": self.settings.repo_ingestion_queue_name},
            }
        except Exception as exc:
            status = "degraded"
            components["redis"] = {"status": "degraded", "detail": str(exc), "metrics": {}}

        components["gemini"] = {
            "status": "operational" if self.gemini.configured else "degraded",
            "detail": (
                f"Gemini models configured ({self.settings.gemini_reasoning_model}, {self.settings.gemini_embedding_model})."
                if self.gemini.configured
                else "Gemini configuration is incomplete."
            ),
            "metrics": {},
        }
        components["auth"] = {
            "status": "operational" if bool(self.settings.jwt_secret_key and self.settings.mongodb_uri) else "degraded",
            "detail": "JWT identity layer configured." if self.settings.jwt_secret_key else "JWT secret is missing.",
            "metrics": {},
        }

        queue_depth = await self.queue.get_queue_length() if self.queue.configured else 0
        latest_jobs = await self.vector_search.latest_jobs(limit=5) if self.mongo.configured else []

        if not self.settings.dev_intelligence_enabled:
            status = "disabled"

        return {
            "status": status,
            "allowed_roots": [str(path) for path in self.settings.repo_allowed_roots],
            "components": components,
            "queues": {self.settings.repo_ingestion_queue_name: queue_depth},
            "latest_jobs": latest_jobs,
        }
