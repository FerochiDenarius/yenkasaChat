from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field


class RepoChunkDocument(BaseModel):
    repo_name: str
    file_path: str
    language: str
    chunk_index: int
    total_chunks: int
    last_modified: datetime
    hash: str
    content: str
    embedding: list[float] = Field(default_factory=list)
    start_line: int = 1
    end_line: int = 1
    file_size_bytes: int = 0
    symbol_names: list[str] = Field(default_factory=list)
    todo_count: int = 0
    complexity_score: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RepoIngestionJobDocument(BaseModel):
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RepoInsightDocument(BaseModel):
    repo_name: str
    insight_type: str
    severity: str
    title: str
    description: str
    file_path: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
