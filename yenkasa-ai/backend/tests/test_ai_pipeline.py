from __future__ import annotations

import json
import unittest
from types import SimpleNamespace

from fastapi import HTTPException
from starlette.requests import Request

from api import routes as legacy_routes
from app.core.ai_pipeline import ensure_response_shape
from app.core.exception_handlers import unhandled_exception_handler
from app.models import ChatRequest
from app.models import ChatResponse


def build_request(path: str, app) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "headers": [],
        "query_string": b"",
        "scheme": "http",
        "server": ("testserver", 80),
        "client": ("127.0.0.1", 12345),
        "root_path": "",
        "state": {},
        "app": app,
    }
    request = Request(scope)
    request.state.request_id = "req-123"
    request.state.current_session = SimpleNamespace(session_id="session-1")
    return request


class _TrackingStub:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def track_interaction(self, **kwargs):
        self.calls.append(kwargs)
        return kwargs


class _SecurityStub:
    async def enforce_rate_limit(self, **_kwargs) -> None:
        return None


class _RuntimeStub:
    def __init__(self) -> None:
        self.settings = SimpleNamespace(vertex_model="vertex-model", embedding_model="embedding-model")
        self.received_extra_context = None

    def chat(self, _payload: ChatRequest, extra_context: str | None = None):
        self.received_extra_context = extra_context

        async def _response() -> ChatResponse:
            return ChatResponse(
                provider="vertex_ai",
                model="vertex-model",
                audience="public",
                answer="resolved answer",
                answer_cards=[],
                suggested_follow_ups=[],
                sources=[],
                timings={"totalMs": 1},
            )

        return _response()


class LegacyChatRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_chat_resolves_leaked_coroutine_response(self) -> None:
        tracking = _TrackingStub()
        live_ops = SimpleNamespace(build_context=self._build_live_context)
        runtime = _RuntimeStub()
        intelligence_runtime = SimpleNamespace(
            settings=SimpleNamespace(ai_request_rate_limit=10),
            security=_SecurityStub(),
            tracking=tracking,
            live_ops=live_ops,
        )
        app = SimpleNamespace(
            state=SimpleNamespace(
                runtime=runtime,
                intelligence_runtime=intelligence_runtime,
            )
        )
        request = build_request("/chat", app)
        current_user = SimpleNamespace(user_id="user-1")

        response = await legacy_routes.chat(
            ChatRequest(question="Hello", audience="public"),
            request,
            current_user=current_user,
        )

        self.assertEqual(response.answer, "resolved answer")
        self.assertEqual(tracking.calls[0]["response_text"], "resolved answer")
        self.assertIn("comments leaderboard", runtime.received_extra_context)

    async def test_ensure_response_shape_rejects_invalid_structure(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await ensure_response_shape(object(), label="legacy_chat", required_attr="answer", expected_type=str)
        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.detail, "Invalid AI response structure")

    async def test_unhandled_exception_handler_returns_clean_json(self) -> None:
        request = build_request("/chat", app=SimpleNamespace(state=SimpleNamespace()))

        response = await unhandled_exception_handler(request, RuntimeError("boom"))

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers["x-request-id"], "req-123")
        self.assertEqual(
            json.loads(response.body),
            {
                "success": False,
                "error": "AI processing failed",
                "request_id": "req-123",
            },
        )

    async def _build_live_context(self, _question: str) -> str:
        return "Recent app events:\n- comments leaderboard updated"


if __name__ == "__main__":
    unittest.main()
