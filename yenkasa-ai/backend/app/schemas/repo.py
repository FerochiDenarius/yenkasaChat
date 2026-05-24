from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class RepoIngestionRequest(BaseModel):
    repo_path: str = Field(min_length=1)
    repo_name: str | None = None
    force_reingest: bool = False


class RepoIngestionJobResponse(BaseModel):
    job_id: str
    repo_name: str
    repo_path: str
    status: str
    files_total: int = 0
    files_processed: int = 0
    chunks_indexed: int = 0
    failed_files: list[str] = Field(default_factory=list)
    processed_file_paths: list[str] = Field(default_factory=list)
    last_error: str | None = None
    force_reingest: bool = False
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    updated_at: datetime


class RepoSearchResult(BaseModel):
    repo_name: str
    file_path: str
    language: str
    chunk_index: int
    total_chunks: int
    start_line: int
    end_line: int
    score: float
    excerpt: str
    symbols: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RepoSearchResponse(BaseModel):
    query: str
    repo_name: str | None = None
    mode: str
    count: int
    took_ms: int
    results: list[RepoSearchResult]


class RepoChatRequest(BaseModel):
    question: str = Field(min_length=1)
    repo_name: str | None = None
    top_k: int = Field(default=6, ge=1, le=20)
    include_sources: bool = True


class RepoChatSource(BaseModel):
    file_path: str
    language: str
    start_line: int
    end_line: int
    score: float
    excerpt: str


class RepoChatResponse(BaseModel):
    repo_name: str | None = None
    question: str
    answer: str
    sources: list[RepoChatSource] = Field(default_factory=list)
    timings: dict[str, int] = Field(default_factory=dict)
