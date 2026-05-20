from __future__ import annotations

from typing import Any
from typing import Literal

from pydantic import BaseModel
from pydantic import Field


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)
    audience: Literal["public", "engineering"] = "public"
    include_debug: bool = False


class SearchRequest(BaseModel):
    question: str = Field(min_length=1)
    audience: Literal["public", "engineering"] = "public"
    top_k: int | None = None


class SourceChunk(BaseModel):
    id: str
    label: str
    title: str
    area: str
    score: float
    rawScore: float
    excerpt: str
    citation: str
    metadata: dict[str, Any]


class AnswerCard(BaseModel):
    title: str
    category: str
    summary: str


class ChatResponse(BaseModel):
    provider: str
    model: str
    audience: str
    answer: str
    answer_cards: list[AnswerCard]
    suggested_follow_ups: list[str]
    sources: list[SourceChunk]
    timings: dict[str, int]
    debug: dict[str, Any] | None = None


class SearchResponse(BaseModel):
    audience: str
    count: int
    sources: list[SourceChunk]


class IngestResponse(BaseModel):
    accepted_files: int
    target_collection: str
    uploaded_to_gcs: bool
    chunks_inserted: int
    vector_db_path: str


class HealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    project_id: str
    location: str
    collections: dict[str, str]
    collection_stats: dict[str, dict[str, Any]] = Field(default_factory=dict)
    vector_db_path: str
    gcs_bucket: str
    snapshot: dict[str, Any] = Field(default_factory=dict)
    startup_timings: dict[str, float]
