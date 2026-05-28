from __future__ import annotations

import logging

from app.modules.crl.behavioral_reasoner import BehavioralReasoner
from app.modules.crl.context_builder import ConsciousContextBuilder
from app.modules.crl.context_ranker import ConsciousContextRanker
from app.modules.crl.context_retriever import ConsciousContextRetriever
from app.modules.crl.prompt_injector import ConsciousPromptInjector
from app.modules.crl.repo_reasoner import RepoReasoner
from app.modules.crl.runtime_correlator import RuntimeCorrelator


LOGGER = logging.getLogger("yenkasa_ai_cloud.crl")

CRL_TERMS = (
    "alert",
    "bug",
    "comment",
    "comments",
    "community",
    "crash",
    "creator",
    "current",
    "debug",
    "deploy",
    "deployment",
    "engagement",
    "error",
    "event",
    "events",
    "fail",
    "health",
    "happening",
    "incident",
    "leader",
    "leading",
    "live",
    "memory",
    "moderation",
    "operational",
    "performance",
    "repo",
    "retention",
    "right now",
    "runtime",
    "security",
    "server",
    "server.js",
    "unstable",
    "watch",
)


class ConsciousReasoningLayer:
    def __init__(self, mongo_service) -> None:
        self.mongo = mongo_service
        self.retriever = ConsciousContextRetriever(mongo_service)
        self.ranker = ConsciousContextRanker()
        self.behavioral = BehavioralReasoner()
        self.repo_reasoner = RepoReasoner()
        self.correlator = RuntimeCorrelator()
        self.builder = ConsciousContextBuilder()
        self.injector = ConsciousPromptInjector()

    def should_include(self, question: str) -> bool:
        lowered = question.lower()
        return any(term in lowered for term in CRL_TERMS)

    async def build_context(self, question: str, *, user_id: str | None = None) -> str | None:
        if not self.mongo.configured or not self.should_include(question):
            return None

        bundles = await self.retriever.retrieve(question, user_id=user_id)
        ranked_items = self.ranker.rank(question, bundles)
        behavioral_notes = self.behavioral.summarize(
            yme_items=bundles.get("yme", []),
            memory_items=bundles.get("memory_logs", []),
            conversations=bundles.get("conversations", []),
            app_events=bundles.get("app_events", []),
            user_memory_items=bundles.get("user_memory", []),
            chat_summaries=bundles.get("chat_summaries", []),
            engagement_patterns=bundles.get("engagement_patterns", []),
            ai_profiles=bundles.get("ai_profiles", []),
            recommendation_signals=bundles.get("recommendation_signals", []),
        )
        repo_notes = self.repo_reasoner.summarize(question, bundles.get("insights", []))
        correlations = self.correlator.correlate(question, ranked_items)

        if not ranked_items and not behavioral_notes and not repo_notes and not correlations:
            LOGGER.info("CRL found no relevant context question=%s", question)
            return None

        context = self.builder.build(
            question=question,
            ranked_items=ranked_items,
            behavioral_notes=behavioral_notes,
            repo_notes=repo_notes,
            correlations=correlations,
        )
        LOGGER.info(
            "CRL context built question=%s ranked_items=%s behavior_notes=%s repo_notes=%s correlations=%s",
            question,
            len(ranked_items),
            len(behavioral_notes),
            len(repo_notes),
            len(correlations),
        )
        return self.injector.inject(context)
