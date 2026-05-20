from __future__ import annotations

from fastapi import APIRouter
from fastapi import File
from fastapi import HTTPException
from fastapi import Request
from fastapi import UploadFile

from app.models import ChatRequest
from app.models import ChatResponse
from app.models import HealthResponse
from app.models import IngestResponse
from app.models import SearchRequest
from app.models import SearchResponse


router = APIRouter()


def get_runtime(request: Request):
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise HTTPException(status_code=503, detail="YenkasaAI backend is not ready.")
    return runtime


@router.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    runtime = get_runtime(request)
    return runtime.health()


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    runtime = get_runtime(request)
    return runtime.chat(payload)


@router.post("/search", response_model=SearchResponse)
def search(payload: SearchRequest, request: Request) -> SearchResponse:
    runtime = get_runtime(request)
    return runtime.search(payload)


@router.post("/ingest", response_model=IngestResponse)
async def ingest(request: Request, files: list[UploadFile] = File(...), audience: str = "public") -> IngestResponse:
    runtime = get_runtime(request)
    return await runtime.ingest(files=files, audience=audience)
