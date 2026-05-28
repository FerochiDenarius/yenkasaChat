from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin_routes import router as admin_router
from app.api.auth_routes import router as auth_router
from api.routes import router
from app.config import get_settings
from app.api.intelligence_routes import router as intelligence_router
from app.core.exception_handlers import http_exception_handler
from app.core.exception_handlers import unhandled_exception_handler
from app.core.exception_handlers import validation_exception_handler
from app.core.logging import configure_logging
from app.core.runtime import IntelligenceRuntime
from app.middleware import AuthContextMiddleware
from app.middleware import RequestContextMiddleware
from services.rag_service import RagRuntime


LOGGER = logging.getLogger("yenkasa_ai_cloud.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    runtime = RagRuntime(settings)
    intelligence_runtime = IntelligenceRuntime(settings)
    runtime.startup()
    try:
        await intelligence_runtime.startup()
    except Exception:
        LOGGER.exception("Dev intelligence startup failed; core chat endpoints will remain available.")
    app.state.settings = settings
    app.state.runtime = runtime
    app.state.intelligence_runtime = intelligence_runtime
    try:
        yield
    finally:
        try:
            await intelligence_runtime.shutdown()
        except Exception:
            LOGGER.exception("Dev intelligence shutdown failed")
        runtime.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AuthContextMiddleware)
    app.add_middleware(RequestContextMiddleware)
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(intelligence_router)
    return app


app = create_app()
