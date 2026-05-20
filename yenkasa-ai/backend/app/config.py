from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


HF_SNAPSHOT_ROOT = (
    Path.home()
    / ".cache"
    / "huggingface"
    / "hub"
    / "models--sentence-transformers--all-MiniLM-L6-v2"
    / "snapshots"
)


def parse_csv(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


def resolve_embedding_model() -> str:
    configured = os.getenv("EMBEDDING_MODEL")
    if configured:
        return configured

    if HF_SNAPSHOT_ROOT.exists():
        snapshots = sorted(path for path in HF_SNAPSHOT_ROOT.iterdir() if path.is_dir())
        if snapshots:
            return str(snapshots[-1].resolve())

    return "sentence-transformers/all-MiniLM-L6-v2"


@dataclass(frozen=True)
class Settings:
    app_name: str
    environment: str
    log_level: str
    host: str
    port: int
    cors_allow_origins: list[str]
    vertex_project_id: str
    vertex_location: str
    vertex_model: str
    vertex_temperature: float
    retrieval_k: int
    max_history_turns: int
    engineering_collection_name: str
    public_collection_name: str
    embedding_model: str
    local_workdir: Path
    local_chroma_dir: Path
    local_upload_dir: Path
    gcs_bucket: str
    gcs_chroma_prefix: str
    gcs_knowledge_prefix: str
    public_bootstrap_dir: Path | None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    local_workdir = Path(os.getenv("LOCAL_WORKDIR", "/tmp/yenkasa-ai")).resolve()
    bootstrap_dir_raw = os.getenv("PUBLIC_KNOWLEDGE_BOOTSTRAP_DIR")
    bootstrap_dir = Path(bootstrap_dir_raw).resolve() if bootstrap_dir_raw else None

    return Settings(
        app_name=os.getenv("APP_NAME", "YenkasaAI Cloud Backend"),
        environment=os.getenv("APP_ENV", "development"),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8080")),
        cors_allow_origins=parse_csv(
            os.getenv("CORS_ALLOW_ORIGINS"),
            ["http://localhost:5174", "http://127.0.0.1:5174"],
        ),
        vertex_project_id=os.getenv("VERTEX_AI_PROJECT_ID", "project-10405180-0afd-4ecc-9f8"),
        vertex_location=os.getenv("VERTEX_AI_LOCATION", "us-central1"),
        vertex_model=os.getenv("VERTEX_AI_MODEL", "gemini-2.5-flash"),
        vertex_temperature=float(os.getenv("VERTEX_AI_TEMPERATURE", "0.2")),
        retrieval_k=int(os.getenv("RETRIEVAL_K", "5")),
        max_history_turns=int(os.getenv("MAX_HISTORY_TURNS", "6")),
        engineering_collection_name=os.getenv("CHROMA_COLLECTION_NAME", "yenkasa_research"),
        public_collection_name=os.getenv("CHROMA_PUBLIC_COLLECTION_NAME", "yenkasa_platform_knowledge"),
        embedding_model=resolve_embedding_model(),
        local_workdir=local_workdir,
        local_chroma_dir=(local_workdir / "chroma_db"),
        local_upload_dir=(local_workdir / "uploads"),
        gcs_bucket=os.getenv("GCS_BUCKET", ""),
        gcs_chroma_prefix=os.getenv("GCS_CHROMA_PREFIX", "yenkasa-ai/chroma"),
        gcs_knowledge_prefix=os.getenv("GCS_KNOWLEDGE_PREFIX", "yenkasa-ai/knowledge"),
        public_bootstrap_dir=bootstrap_dir,
    )
