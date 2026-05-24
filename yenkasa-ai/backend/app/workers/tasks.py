from __future__ import annotations

import asyncio

from app.config import get_settings
from app.core.runtime import IntelligenceRuntime


def ingest_repository_job(job_id: str) -> dict:
    async def _runner() -> dict:
        settings = get_settings()
        runtime = IntelligenceRuntime(settings)
        await runtime.startup()
        try:
            response = await runtime.repo_ingestion.run_job(job_id)
            return response.model_dump(mode="json")
        finally:
            await runtime.shutdown()

    return asyncio.run(_runner())
