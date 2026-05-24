from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.models import AIConversationDocument


LANGUAGE_TERMS = {
    "python": "python",
    "typescript": "typescript",
    "javascript": "javascript",
    "kotlin": "kotlin",
    "java": "java",
    "fastapi": "python",
    "react": "javascript",
    "flutter": "dart",
}


class AITrackingService:
    def __init__(self, settings, mongo_service, user_service, yme_service) -> None:
        self.settings = settings
        self.mongo = mongo_service
        self.users = user_service
        self.yme = yme_service

    async def track_interaction(
        self,
        user,
        session,
        feature: str,
        request_path: str,
        prompt: str,
        response_text: str,
        response_time_ms: int,
        model_used: str,
        metadata: dict | None = None,
    ) -> AIConversationDocument:
        prompt_tokens = self._estimate_tokens(prompt)
        completion_tokens = self._estimate_tokens(response_text)
        topics = self._extract_topics(prompt)
        languages = self._extract_languages(prompt)
        conversation = AIConversationDocument(
            conversation_id=str(uuid4()),
            user_id=user.user_id,
            session_id=session.session_id,
            feature=feature,
            request_path=request_path,
            model_used=model_used,
            response_time_ms=response_time_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            topics=topics,
            coding_languages=languages,
            messages=[
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": response_text[:4000]},
            ],
            summary=response_text[:220],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await self.mongo.conversations_collection.insert_one(conversation.model_dump(mode="json"))
        await self.users.increment_ai_usage(user.user_id, conversation.total_tokens)
        await self.yme.record_event(
            event_type="ai_interaction",
            user_id=user.user_id,
            session_id=session.session_id,
            source=feature,
            metadata={
                "feature": feature,
                "topics": topics,
                "coding_languages": languages,
                "response_time_ms": response_time_ms,
                "total_tokens": conversation.total_tokens,
                **(metadata or {}),
            },
        )
        return conversation

    def _estimate_tokens(self, text: str) -> int:
        return max(1, len(text.split()) * 2 // 3)

    def _extract_topics(self, prompt: str) -> list[str]:
        lowered = prompt.lower()
        topics = []
        for keyword in ("architecture", "bug", "scaling", "security", "performance", "repository", "chat", "search"):
            if keyword in lowered:
                topics.append(keyword)
        return topics[:8]

    def _extract_languages(self, prompt: str) -> list[str]:
        lowered = prompt.lower()
        languages = [language for keyword, language in LANGUAGE_TERMS.items() if keyword in lowered]
        return sorted(set(languages))[:8]
