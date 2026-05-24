from __future__ import annotations

import asyncio
import hashlib
import importlib.util
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from copy import deepcopy
from pathlib import Path
from tempfile import mkdtemp
from typing import Any
from typing import AsyncIterator
from typing import Literal
from uuid import uuid4

from fastapi import BackgroundTasks
from fastapi import FastAPI
from fastapi import File
from fastapi import HTTPException
from fastapi import Request
from fastapi import UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel
from pydantic import Field


LOGGER = logging.getLogger("yenkasa_ai_fastapi")
ROOT_DIR = Path(__file__).resolve().parents[2]
RAG_DIR = Path("/Users/kofibright/Desktop/YenkasaResearch/yenkasa-ai").resolve()
RAG_VENV_PYTHON = RAG_DIR / "venv" / "bin" / "python"
ASK_SCRIPT = RAG_DIR / "ask.py"
INGEST_SCRIPT = RAG_DIR / "ingest.py"
PUBLIC_KNOWLEDGE_DIR = ROOT_DIR / "yenkasa_knowledge" / "public"
LOCAL_API_CHROMA_DIR = ROOT_DIR / "yenkasa-ai" / "chroma_db"
HF_MODEL_CACHE_ROOT = (
    Path.home()
    / ".cache"
    / "huggingface"
    / "hub"
    / "models--sentence-transformers--all-MiniLM-L6-v2"
    / "snapshots"
)


def resolve_default_embedding_model() -> str:
    configured = os.getenv("EMBEDDING_MODEL")
    if configured:
        return configured

    if HF_MODEL_CACHE_ROOT.exists():
        snapshots = sorted(path for path in HF_MODEL_CACHE_ROOT.iterdir() if path.is_dir())
        if snapshots:
            return str(snapshots[-1].resolve())

    return "sentence-transformers/all-MiniLM-L6-v2"

ENGINEERING_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "yenkasa_research")
PUBLIC_COLLECTION_NAME = os.getenv("CHROMA_PUBLIC_COLLECTION_NAME", "yenkasa_platform_knowledge")
DEFAULT_PERSIST_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", str(LOCAL_API_CHROMA_DIR))).resolve()
DEFAULT_PROJECT_ID = os.getenv("VERTEX_AI_PROJECT_ID", "project-10405180-0afd-4ecc-9f8")
DEFAULT_LOCATION = os.getenv("VERTEX_AI_LOCATION", "us-central1")
DEFAULT_MODEL = os.getenv("VERTEX_AI_MODEL", "gemini-2.5-flash")
DEFAULT_EMBEDDING_MODEL = resolve_default_embedding_model()
DEFAULT_RETRIEVAL_K = int(os.getenv("RETRIEVAL_K", "5"))
DEFAULT_MAX_HISTORY_TURNS = int(os.getenv("MAX_HISTORY_TURNS", "6"))
PUBLIC_CHUNK_SIZE = int(os.getenv("PUBLIC_DOC_CHUNK_SIZE", "950"))
PUBLIC_CHUNK_OVERLAP = int(os.getenv("PUBLIC_DOC_CHUNK_OVERLAP", "140"))
CLOUD_RUN_BACKEND_URL = os.getenv(
    "YENKASA_AI_CLOUD_BACKEND_URL",
    "https://yenkasa-ai-496173204476.europe-west1.run.app",
).rstrip("/")

HYBRID_SYSTEM_PROMPT = """You are Yenkasa-AI.

You are the intelligent ecosystem assistant for Yenkasa.

You deeply understand:
- Yenkasa history
- founder biography
- ecosystem philosophy
- social architecture
- creator economy
- technical infrastructure
- reward systems
- livestream systems
- AI systems
- engineering evolution
- roadmap and vision

Founder:
Bright Kofi Ofosu Menya

Developer identity:
Ferochi Denarius

Company:
Yenkasa Soft-O-Tech

You are both:
- the official Yenkasa assistant
- a technical ecosystem advisor
- a project historian
- a senior software engineering advisor

You answer:
- Yenkasa ecosystem questions
- software engineering questions
- backend architecture questions
- scalability questions
- Flutter, Kotlin, Node.js, API, and cloud questions
- AI engineering questions
- startup architecture questions
- product design questions
- investor and roadmap questions

Response policy:
1. Prioritize retrieved Yenkasa knowledge when it directly answers the question.
2. Use retrieved engineering knowledge and uploaded documents next.
3. When the knowledge base is incomplete or silent, use general engineering reasoning and modern best practices.
4. Never refuse a normal engineering, architecture, product, or ecosystem question simply because retrieval is thin.
5. Be explicit when guidance is based on general engineering best practice rather than retrieved Yenkasa evidence.
6. Distinguish clearly between current implementation, legacy design documentation, and roadmap aspirations when they differ.
7. Preserve project history, founder context, and ecosystem philosophy when they are relevant to the answer.
8. Cite source labels like [S1], [S2] when retrieved context supports a claim.
9. Keep answers practical, modern, and concrete.
10. Do not invent Yenkasa-specific facts that are not supported by retrieved context.
11. Do not expose internal moderation thresholds, abuse tactics, exploit paths, or security-sensitive details.
12. If a question asks how to cheat, bypass, game, spam, exploit, or evade, refuse briefly and redirect to safe guidance.
"""

PUBLIC_UNSAFE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bbypass\b.*\bmoderation\b",
        r"\bevad(e|ing)\b.*\bmoderation\b",
        r"\bcheat\b.*\b(rank|ykc|reward|verification|leaderboard)\b",
        r"\bfarm\b.*\b(ykc|reward|rank)\b",
        r"\bspam\b.*\b(without|and not)\b.*\b(ban|moderation|detection)\b",
        r"\bfake\b.*\b(verification|rank|reward|engagement)\b",
        r"\bexploit\b",
    ]
]

PUBLIC_FOLLOW_UPS = {
    "platform": [
        "What is Yenkasa Coin and how do I earn it?",
        "How do communities work on Yenkasa?",
        "How does rank progression work?",
    ],
    "rewards": [
        "How do I earn more YKC on Yenkasa?",
        "What milestones should I aim for next?",
        "How do YKC rewards connect to ranks?",
    ],
    "ranks": [
        "What are the main ranks in Yenkasa?",
        "How does verification help rank progression?",
        "What do leaderboards and titles mean?",
    ],
    "livestreams": [
        "What is Yenkasa Live Arena?",
        "How do livestream duels work?",
        "What live titles can users earn?",
    ],
    "moderation": [
        "How does Yenkasa protect users?",
        "Why are some features role-gated?",
        "How does moderation affect livestreams and communities?",
    ],
    "creator-tools": [
        "How does the Yenkasa creator economy work?",
        "Which creator roles exist on Yenkasa?",
        "How do communities and livestreams help creators grow?",
    ],
}

ENGINEERING_FOLLOW_UPS = [
    "How does this compare with standard social platform architecture?",
    "What should be refactored first to reduce scaling risk?",
    "Which parts should stay monolithic and which should split out?",
]

HYBRID_GENERAL_FOLLOW_UPS = [
    "How does this compare with engineering best practice?",
    "What are the biggest scaling risks here?",
    "What would you improve first if this had to grow fast?",
]

ENGINEERING_INTENT_TERMS = (
    "api",
    "architecture",
    "backend",
    "cache",
    "cloud run",
    "code",
    "database",
    "deploy",
    "engineering",
    "feed",
    "flutter",
    "infrastructure",
    "kotlin",
    "latency",
    "microservice",
    "mobile",
    "node",
    "performance",
    "queue",
    "redis",
    "scal",
    "socket",
    "system design",
)

JOB_LOG_LIMIT = 120
INGEST_STAGE_ORDER = {
    "queued": 0,
    "validating": 1,
    "chunking": 2,
    "embedding": 3,
    "persisting": 4,
    "refreshing": 5,
    "confirming": 6,
    "completed": 7,
    "failed": 7,
}
INGEST_START_RE = re.compile(r"Starting ingestion pdf_root=.* total_candidate_pdfs=(\d+)")
INGEST_INSPECT_RE = re.compile(r"\[(\d+)/(\d+)\] Inspecting PDF (.+)$")
INGEST_LOADED_RE = re.compile(
    r"\[(\d+)/(\d+)\] Loaded PDF (.+?) pages=(\d+) raw_pages=(\d+) chunks=(\d+) inserted=(\d+) skipped_existing=(\d+) chunk_failures=(\d+)"
)
INGEST_DUPLICATE_RE = re.compile(r"\[(\d+)/(\d+)\] Skipping duplicate PDF (.+?) duplicate_of=(.+)$")
INGEST_EMPTY_RE = re.compile(
    r"\[(\d+)/(\d+)\] Skipping (?:empty PDF file|PDF with no extractable text|PDF with no chunks after splitting) (.+?)(?:\s|$)"
)
INGEST_FAILED_FILE_RE = re.compile(r"\[(\d+)/(\d+)\] Failed to process PDF (.+)$")
INGEST_SUMMARY_RE = re.compile(
    r"Ingestion summary candidate=(\d+) successful=(\d+) failed=(\d+) duplicates=(\d+) empty=(\d+) "
    r"pages=(\d+) chunks_created=(\d+) chunks_inserted=(\d+) chunks_skipped_existing=(\d+) chunk_failures=(\d+)"
)
INGEST_PERSIST_RE = re.compile(r"Chroma persistence elapsed=([0-9.]+)s files=(\d+)")
INGEST_VECTOR_DB_RE = re.compile(r"Vector database path: (.+)$")


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)
    audience: Literal["public", "engineering"] = "public"


class HealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    project_id: str
    location: str
    vector_db: str
    collection_name: str
    embeddings: str
    rag_dir: str
    collections: dict[str, str]
    public_knowledge_dir: str


class AppState:
    def __init__(self) -> None:
        self.ask_module: Any | None = None
        self.embedding_function: Any | None = None
        self.engineering_vector_store: Any | None = None
        self.public_vector_store: Any | None = None
        self.llm: Any | None = None
        self.hybrid_prompt: Any | None = None
        self.engineering_prompt: Any | None = None
        self.public_prompt: Any | None = None
        self.ready = False
        self.startup_error: str | None = None
        self.startup_timings: dict[str, float] = {}
        self.jobs: dict[str, dict[str, Any]] = {}
        self.jobs_version = 0
        self.lock = threading.Condition()


state = AppState()


def configure_logging() -> None:
    if logging.getLogger().handlers:
        return
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def load_ask_module():
    if not ASK_SCRIPT.exists():
        raise RuntimeError(f"ask.py not found at {ASK_SCRIPT}")

    spec = importlib.util.spec_from_file_location("yenkasa_rag_ask", ASK_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load ask.py from {ASK_SCRIPT}")

    module = importlib.util.module_from_spec(spec)
    sys.modules["yenkasa_rag_ask"] = module
    spec.loader.exec_module(module)
    return module


def build_hybrid_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", HYBRID_SYSTEM_PROMPT),
            (
                "human",
                "Requested response mode:\n{audience_mode}\n\n"
                "Conversation history:\n{history}\n\n"
                "User question:\n{question}\n\n"
                "Combined retrieval context:\n{context}\n\n"
                "Retrieval status:\n{retrieval_status}\n\n"
                "Write the best possible answer.\n"
                "- Prioritize retrieved Yenkasa facts when they directly apply.\n"
                "- Use retrieved engineering context when it helps with architecture or implementation advice.\n"
                "- If the retrieved knowledge is partial or missing, still answer using general engineering and product best practices.\n"
                "- Preserve founder, ecosystem, and historical context when relevant to the question.\n"
                "- Make it clear when something is current production behavior, legacy documentation, or roadmap direction.\n"
                "- When you rely on general reasoning instead of retrieved Yenkasa evidence, say so plainly.\n"
                "- Cite [S1] style labels when a retrieved source supports a claim.",
            ),
        ]
    )


def collection_count(vector_store: Any) -> int:
    try:
        return int(vector_store._collection.count())  # noqa: SLF001
    except Exception:
        LOGGER.exception("Failed to read collection count")
        return 0


def startup_rag() -> None:
    configure_logging()
    LOGGER.info("Starting YenkasaAI FastAPI bridge rag_dir=%s", RAG_DIR)
    started = time.perf_counter()

    ask_module = load_ask_module()
    ask_module.configure_logging(os.getenv("LOG_LEVEL", "INFO"))
    ask_module.load_environment(RAG_DIR)

    if Path(DEFAULT_EMBEDDING_MODEL).exists():
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        LOGGER.info("Using local embedding snapshot path=%s offline_mode=true", DEFAULT_EMBEDDING_MODEL)

    embedding_start = time.perf_counter()
    embedding_function = ask_module.build_embedding_function(DEFAULT_EMBEDDING_MODEL)
    state.startup_timings["embedding_init_s"] = time.perf_counter() - embedding_start

    vector_start = time.perf_counter()
    engineering_vector_store = ask_module.build_vector_store(
        persist_dir=DEFAULT_PERSIST_DIR,
        collection_name=ENGINEERING_COLLECTION_NAME,
        embedding_function=embedding_function,
    )
    public_vector_store = ask_module.build_vector_store(
        persist_dir=DEFAULT_PERSIST_DIR,
        collection_name=PUBLIC_COLLECTION_NAME,
        embedding_function=embedding_function,
    )
    state.startup_timings["vector_store_init_s"] = time.perf_counter() - vector_start

    llm_start = time.perf_counter()
    llm = ask_module.build_chat_model(
        model_name=DEFAULT_MODEL,
        temperature=float(os.getenv("VERTEX_AI_TEMPERATURE", "0.2")),
        project_id=DEFAULT_PROJECT_ID,
        location=DEFAULT_LOCATION,
    )
    state.startup_timings["llm_init_s"] = time.perf_counter() - llm_start

    state.ask_module = ask_module
    state.embedding_function = embedding_function
    state.engineering_vector_store = engineering_vector_store
    state.public_vector_store = public_vector_store
    state.llm = llm
    state.hybrid_prompt = build_hybrid_prompt()
    state.engineering_prompt = ask_module.build_prompt()
    state.public_prompt = build_hybrid_prompt()

    if PUBLIC_KNOWLEDGE_DIR.exists() and collection_count(public_vector_store) == 0:
        sync_public_knowledge(force=False, skip_ready_check=True)

    state.ready = True
    state.startup_error = None
    state.startup_timings["total_startup_s"] = time.perf_counter() - started
    LOGGER.info(
        "YenkasaAI FastAPI bridge ready timings=%s engineering_collection=%s public_collection=%s",
        state.startup_timings,
        ENGINEERING_COLLECTION_NAME,
        PUBLIC_COLLECTION_NAME,
    )


def ensure_ready() -> None:
    if state.ready:
        return
    message = state.startup_error or "YenkasaAI backend is still starting."
    raise HTTPException(status_code=503, detail=message)


def history_to_pairs(history: list[ChatTurn]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    pending_question: str | None = None

    for turn in history:
        content = turn.content.strip()
        if not content:
            continue
        role = turn.role.lower().strip()
        if role == "user":
            pending_question = content
            continue
        if role == "assistant" and pending_question:
            pairs.append((pending_question, content))
            pending_question = None

    return pairs[-DEFAULT_MAX_HISTORY_TURNS :]


def sanitize_filename(name: str) -> str:
    safe = "".join(character if character.isalnum() or character in {"-", "_", "."} else "_" for character in name)
    return safe or f"upload-{uuid4().hex}.pdf"


def clone_job(job: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(job)


def list_jobs_snapshot() -> tuple[list[dict[str, Any]], int]:
    with state.lock:
        jobs = sorted(
            (clone_job(job) for job in state.jobs.values()),
            key=lambda item: (item.get("createdAt", 0), item.get("updatedAt", 0)),
            reverse=True,
        )
        return jobs, state.jobs_version


def get_job_snapshot(job_id: str) -> dict[str, Any]:
    with state.lock:
        return clone_job(state.jobs.get(job_id, {}))


def wait_for_job_update(previous_version: int, timeout: float = 15.0) -> int:
    with state.lock:
        if state.jobs_version != previous_version:
            return state.jobs_version
        state.lock.wait(timeout=timeout)
        return state.jobs_version


def mutate_job(job_id: str, mutator) -> dict[str, Any]:
    with state.lock:
        current = clone_job(state.jobs.get(job_id, {}))
        mutator(current)
        current.setdefault("id", job_id)
        current["updatedAt"] = int(time.time())
        state.jobs[job_id] = current
        state.jobs_version += 1
        state.lock.notify_all()
        return clone_job(current)


def write_job(job_id: str, **updates: Any) -> dict[str, Any]:
    return mutate_job(job_id, lambda current: current.update(updates))


def append_job_log(job: dict[str, Any], line: str) -> None:
    log_tail = list(job.get("logTail") or [])
    log_tail.append(line)
    job["logTail"] = log_tail[-JOB_LOG_LIMIT:]


def upsert_selected_file(job: dict[str, Any], storage_name: str, **updates: Any) -> dict[str, Any]:
    selected_files = list(job.get("selectedFiles") or [])
    for selected in selected_files:
        if selected.get("storageName") == storage_name:
            selected.update(updates)
            job["selectedFiles"] = selected_files
            return selected

    created = {"name": storage_name, "storageName": storage_name}
    created.update(updates)
    selected_files.append(created)
    job["selectedFiles"] = selected_files
    return created


def set_stage(job: dict[str, Any], stage_key: str, label: str, progress: int | None = None, eta: str | None = None) -> None:
    current_stage_key = str(job.get("stageKey") or "queued")
    if INGEST_STAGE_ORDER.get(stage_key, 0) >= INGEST_STAGE_ORDER.get(current_stage_key, 0):
        job["stageKey"] = stage_key
        job["currentStage"] = label

    if progress is not None:
        job["progress"] = max(int(job.get("progress", 0)), progress)
    if eta is not None:
        job["eta"] = eta


def file_progress(file_index: int, total_files: int, start: int, end: int) -> int:
    if total_files <= 0:
        return start
    ratio = max(0.0, min(file_index / total_files, 1.0))
    return start + round((end - start) * ratio)


def build_unique_upload_path(upload_dir: Path, filename: str) -> Path:
    safe_name = sanitize_filename(filename)
    candidate = upload_dir / safe_name
    if not candidate.exists():
        return candidate

    stem = candidate.stem or f"upload-{uuid4().hex[:8]}"
    suffix = candidate.suffix
    counter = 2
    while True:
        candidate = upload_dir / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def build_cloud_backend_url(path: str) -> str:
    normalized = path if path.startswith("/") else f"/{path}"
    return f"{CLOUD_RUN_BACKEND_URL}{normalized}"


def run_curl_json(command: list[str]) -> dict[str, Any]:
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        errors="replace",
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"curl failed rc={completed.returncode} stderr={completed.stderr.strip()[:800]}")

    payload = (completed.stdout or "").strip()
    if not payload:
        raise RuntimeError("curl returned an empty response body.")

    try:
        body, http_status = payload.rsplit("\n", 1)
    except ValueError as exc:
        raise RuntimeError(f"curl response did not include an HTTP status: {payload[:800]}") from exc

    if http_status.strip() != "200":
        raise RuntimeError(f"Cloud backend request failed http={http_status.strip()} body={body[:1200]}")

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Cloud backend returned invalid JSON: {body[:1200]}") from exc


def fetch_cloud_backend_health() -> dict[str, Any]:
    return run_curl_json(
        [
            "curl",
            "-sS",
            "-w",
            "\n%{http_code}",
            build_cloud_backend_url("/health"),
        ]
    )


def ingest_files_via_cloud_backend(upload_dir: Path) -> dict[str, Any]:
    pdf_files = sorted(path for path in upload_dir.iterdir() if path.is_file() and path.suffix.lower() == ".pdf")
    if not pdf_files:
        raise RuntimeError("No PDF files were staged for the Cloud Run ingest request.")

    command = [
        "curl",
        "-sS",
        "-w",
        "\n%{http_code}",
        "-X",
        "POST",
        build_cloud_backend_url("/ingest?audience=engineering"),
    ]
    for pdf_file in pdf_files:
        command.extend(["-F", f"files=@{pdf_file}"])

    return run_curl_json(command)


def build_engineering_vector_store_snapshot():
    if state.ask_module is None or state.embedding_function is None:
        raise RuntimeError("Engineering vector store cannot be refreshed before startup completes.")
    return state.ask_module.build_vector_store(
        persist_dir=DEFAULT_PERSIST_DIR,
        collection_name=ENGINEERING_COLLECTION_NAME,
        embedding_function=state.embedding_function,
    )


def refresh_engineering_vector_store() -> tuple[Any, int]:
    vector_store = build_engineering_vector_store_snapshot()
    total_chunks = collection_count(vector_store)
    with state.lock:
        state.engineering_vector_store = vector_store
    return vector_store, total_chunks


def confirm_selected_files_in_db(vector_store: Any, selected_files: list[dict[str, Any]]) -> dict[str, Any]:
    collection = vector_store._collection  # noqa: SLF001
    confirmed_files = 0
    total_confirmed_chunks = 0
    files: list[dict[str, Any]] = []

    for selected in selected_files:
        storage_name = str(selected.get("storageName") or selected.get("name") or "")
        result = collection.get(where={"source_file": storage_name}, include=[])
        chunk_ids = result.get("ids") or []
        chunk_count = len(chunk_ids)
        present = chunk_count > 0
        if present:
            confirmed_files += 1
            total_confirmed_chunks += chunk_count
        files.append(
            {
                "storageName": storage_name,
                "present": present,
                "dbChunkCount": chunk_count,
            }
        )

    return {
        "confirmedFiles": confirmed_files,
        "totalFiles": len(selected_files),
        "totalConfirmedChunks": total_confirmed_chunks,
        "files": files,
        "collectionName": ENGINEERING_COLLECTION_NAME,
        "vectorDbPath": str(DEFAULT_PERSIST_DIR),
        "collectionCount": collection_count(vector_store),
    }


def attach_db_confirmation(job_id: str, db_confirmation: dict[str, Any]) -> None:
    confirmation_by_storage = {
        item["storageName"]: item for item in db_confirmation.get("files", []) if item.get("storageName")
    }

    def _mutate(current: dict[str, Any]) -> None:
        current["dbConfirmation"] = db_confirmation
        for selected in list(current.get("selectedFiles") or []):
            storage_name = selected.get("storageName")
            confirmation = confirmation_by_storage.get(storage_name)
            if not confirmation:
                continue
            selected["dbChunkCount"] = confirmation["dbChunkCount"]
            selected["inVectorDb"] = confirmation["present"]

    mutate_job(job_id, _mutate)


def parse_ingest_summary(line: str) -> dict[str, int] | None:
    match = INGEST_SUMMARY_RE.search(line)
    if not match:
        return None
    keys = (
        "candidate",
        "successful",
        "failed",
        "duplicates",
        "empty",
        "pages",
        "chunksCreated",
        "chunksInserted",
        "chunksSkippedExisting",
        "chunkFailures",
    )
    return {key: int(value) for key, value in zip(keys, match.groups())}


def update_job_from_ingest_log(job_id: str, raw_line: str) -> None:
    line = raw_line.strip()
    if not line:
        return

    def _mutate(current: dict[str, Any]) -> None:
        append_job_log(current, line)

        if "Embedding provider ready" in line:
            set_stage(current, "embedding", "Generating embeddings", progress=24, eta="Embedding backend ready")

        if "Embedded batch" in line or "Skipped already-ingested batch" in line:
            set_stage(current, "embedding", "Generating embeddings", progress=38, eta="Writing batches to Chroma")

        start_match = INGEST_START_RE.search(line)
        if start_match:
            total_files = int(start_match.group(1))
            current["totalFiles"] = total_files
            set_stage(current, "validating", "Validating files", progress=8, eta=f"Scanning {total_files} file(s)")
            return

        inspect_match = INGEST_INSPECT_RE.search(line)
        if inspect_match:
            file_index = int(inspect_match.group(1))
            total_files = int(inspect_match.group(2))
            file_name = inspect_match.group(3).strip()
            current["currentFile"] = file_name
            current["totalFiles"] = total_files
            upsert_selected_file(current, file_name, status="Processing")
            set_stage(
                current,
                "chunking",
                "Chunking documents",
                progress=file_progress(max(file_index - 1, 0), total_files, 12, 48),
                eta=f"Processing {file_index} of {total_files}",
            )
            return

        loaded_match = INGEST_LOADED_RE.search(line)
        if loaded_match:
            file_index = int(loaded_match.group(1))
            total_files = int(loaded_match.group(2))
            file_name = loaded_match.group(3).strip()
            pages = int(loaded_match.group(4))
            raw_pages = int(loaded_match.group(5))
            chunks_created = int(loaded_match.group(6))
            chunks_inserted = int(loaded_match.group(7))
            chunks_skipped_existing = int(loaded_match.group(8))
            chunk_failures = int(loaded_match.group(9))
            current["processedFiles"] = max(int(current.get("processedFiles", 0)), file_index)
            upsert_selected_file(
                current,
                file_name,
                status="Indexed",
                pages=pages,
                rawPages=raw_pages,
                chunksCreated=chunks_created,
                chunksInserted=chunks_inserted,
                chunksSkippedExisting=chunks_skipped_existing,
                chunkFailures=chunk_failures,
            )
            set_stage(
                current,
                "embedding",
                "Generating embeddings",
                progress=file_progress(file_index, total_files, 18, 78),
                eta=f"Indexed {file_index} of {total_files}",
            )
            return

        duplicate_match = INGEST_DUPLICATE_RE.search(line)
        if duplicate_match:
            file_index = int(duplicate_match.group(1))
            total_files = int(duplicate_match.group(2))
            file_name = duplicate_match.group(3).strip()
            duplicate_of = duplicate_match.group(4).strip()
            current["processedFiles"] = max(int(current.get("processedFiles", 0)), file_index)
            upsert_selected_file(current, file_name, status="Duplicate", duplicateOf=duplicate_of, inVectorDb=True)
            set_stage(
                current,
                "validating",
                "Validating files",
                progress=file_progress(file_index, total_files, 12, 40),
                eta=f"Validated {file_index} of {total_files}",
            )
            return

        empty_match = INGEST_EMPTY_RE.search(line)
        if empty_match:
            file_index = int(empty_match.group(1))
            total_files = int(empty_match.group(2))
            file_name = empty_match.group(3).strip()
            current["processedFiles"] = max(int(current.get("processedFiles", 0)), file_index)
            upsert_selected_file(current, file_name, status="Skipped")
            set_stage(
                current,
                "validating",
                "Validating files",
                progress=file_progress(file_index, total_files, 12, 40),
                eta=f"Validated {file_index} of {total_files}",
            )
            return

        failed_match = INGEST_FAILED_FILE_RE.search(line)
        if failed_match:
            file_index = int(failed_match.group(1))
            total_files = int(failed_match.group(2))
            file_name = failed_match.group(3).strip()
            current["processedFiles"] = max(int(current.get("processedFiles", 0)), file_index)
            upsert_selected_file(current, file_name, status="Failed")
            set_stage(
                current,
                "chunking",
                "Chunking documents",
                progress=file_progress(file_index, total_files, 18, 70),
                eta=f"Processed {file_index} of {total_files}",
            )
            return

        summary = parse_ingest_summary(line)
        if summary:
            current["summary"] = summary
            set_stage(current, "persisting", "Persisting to Chroma", progress=84, eta="Writing Chroma snapshot")
            return

        persist_match = INGEST_PERSIST_RE.search(line)
        if persist_match:
            current["persistSeconds"] = float(persist_match.group(1))
            current["persistedFiles"] = int(persist_match.group(2))
            set_stage(current, "persisting", "Persisting to Chroma", progress=90, eta="Chroma snapshot persisted")
            return

        vector_db_match = INGEST_VECTOR_DB_RE.search(line)
        if vector_db_match:
            current["vectorDbPath"] = vector_db_match.group(1).strip()
            set_stage(current, "refreshing", "Refreshing runtime", progress=94, eta="Reloading vector store")

    mutate_job(job_id, _mutate)


def build_section_path(metadata: dict[str, Any]) -> str:
    parts = [metadata.get("h1"), metadata.get("h2"), metadata.get("h3")]
    return " > ".join(part.strip() for part in parts if isinstance(part, str) and part.strip())


def public_collection_category_for_path(path: Path) -> str:
    try:
        relative = path.relative_to(PUBLIC_KNOWLEDGE_DIR)
    except ValueError:
        return "platform"
    return relative.parts[0] if len(relative.parts) > 1 else "platform"


def iter_public_markdown_files() -> list[Path]:
    if not PUBLIC_KNOWLEDGE_DIR.exists():
        return []
    return sorted(
        path
        for path in PUBLIC_KNOWLEDGE_DIR.rglob("*.md")
        if path.is_file() and path.name.lower() != "readme.md"
    )


def build_public_documents_for_file(markdown_path: Path) -> list[Document]:
    raw_text = markdown_path.read_text(encoding="utf-8").strip()
    if not raw_text:
        return []

    category = public_collection_category_for_path(markdown_path)
    relative_path = str(markdown_path.relative_to(PUBLIC_KNOWLEDGE_DIR))
    file_hash = hashlib.sha256(raw_text.encode("utf-8", errors="ignore")).hexdigest()

    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")],
        strip_headers=False,
    )
    section_docs = header_splitter.split_text(raw_text) or [Document(page_content=raw_text, metadata={})]

    normalized_sections: list[Document] = []
    for section in section_docs:
        content = (section.page_content or "").strip()
        if not content:
            continue
        metadata = dict(section.metadata or {})
        metadata.update(
            {
                "source_path": str(markdown_path.resolve()),
                "source_relative_path": relative_path,
                "source_file": markdown_path.name,
                "file_sha256": file_hash,
                "category": category,
                "retrieval_category": category,
                "audience": "public",
                "filename_stem": markdown_path.stem,
            }
        )
        metadata["section_path"] = build_section_path(metadata) or markdown_path.stem.replace("_", " ")
        normalized_sections.append(Document(page_content=content, metadata=metadata))

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=PUBLIC_CHUNK_SIZE,
        chunk_overlap=PUBLIC_CHUNK_OVERLAP,
        separators=["\n### ", "\n## ", "\n- ", "\n", " "],
    )
    chunks = splitter.split_documents(normalized_sections)

    prepared: list[Document] = []
    for chunk_index, chunk in enumerate(chunks, start=1):
        content = (chunk.page_content or "").strip()
        if not content:
            continue
        metadata = dict(chunk.metadata or {})
        metadata["section_path"] = metadata.get("section_path") or build_section_path(metadata)
        raw_chunk_id = (
            f"{metadata.get('file_sha256', '')}:"
            f"{metadata.get('source_relative_path', '')}:"
            f"{metadata.get('section_path', '')}:"
            f"{chunk_index}:"
            f"{hashlib.sha256(content.encode('utf-8', errors='ignore')).hexdigest()}"
        )
        metadata["chunk_id"] = hashlib.sha256(raw_chunk_id.encode("utf-8")).hexdigest()
        prepared.append(Document(page_content=content, metadata=metadata))

    return prepared


def sync_public_knowledge(force: bool, skip_ready_check: bool = False) -> dict[str, Any]:
    if not skip_ready_check:
        ensure_ready()

    if state.public_vector_store is None:
        raise RuntimeError("Public vector store is not initialized.")

    markdown_files = iter_public_markdown_files()
    summary = {
        "collection": PUBLIC_COLLECTION_NAME,
        "knowledgeDir": str(PUBLIC_KNOWLEDGE_DIR),
        "filesSeen": len(markdown_files),
        "filesProcessed": 0,
        "filesSkipped": 0,
        "chunksInserted": 0,
        "startedAt": int(time.time()),
    }

    for markdown_path in markdown_files:
        relative_path = str(markdown_path.relative_to(PUBLIC_KNOWLEDGE_DIR))
        try:
            chunks = build_public_documents_for_file(markdown_path)
            if not chunks:
                summary["filesSkipped"] += 1
                LOGGER.warning("Skipping empty public knowledge doc %s", relative_path)
                continue

            if force:
                try:
                    state.public_vector_store.delete(where={"source_relative_path": relative_path})
                except Exception:
                    LOGGER.exception("Failed deleting prior chunks for %s before re-sync", relative_path)

            chunk_ids = [chunk.metadata["chunk_id"] for chunk in chunks]
            state.public_vector_store.add_documents(chunks, ids=chunk_ids)
            summary["filesProcessed"] += 1
            summary["chunksInserted"] += len(chunks)
            LOGGER.info(
                "Synced public knowledge doc file=%s category=%s chunks=%d",
                relative_path,
                chunks[0].metadata.get("category", "platform"),
                len(chunks),
            )
        except Exception:
            summary["filesSkipped"] += 1
            LOGGER.exception("Failed syncing public knowledge doc %s", relative_path)

    summary["completedAt"] = int(time.time())
    summary["collectionCount"] = collection_count(state.public_vector_store)
    return summary


def public_query_is_unsafe(question: str) -> bool:
    return any(pattern.search(question) for pattern in PUBLIC_UNSAFE_PATTERNS)


def safe_public_refusal() -> dict[str, Any]:
    answer = (
        "I can explain how Yenkasa safety, rewards, ranks, and moderation work, but I cannot help with bypassing "
        "moderation, gaming rewards, or exploiting platform systems.\n\n"
        "If you want, ask about the safe version instead, such as how verification works, how YKC is earned, "
        "or what Live Arena is."
    )
    return {
        "provider": "vertex_ai",
        "model": DEFAULT_MODEL,
        "audience": "public",
        "answer": answer,
        "answerCards": [
            {
                "title": "Safe help available",
                "category": "moderation",
                "summary": "Ask about YKC, verification, ranks, communities, Live Arena, or creator growth instead.",
            }
        ],
        "suggestedFollowUps": [
            "What is Yenkasa Coin and how do I earn it?",
            "How does verification work on Yenkasa?",
            "What is Yenkasa Live Arena?",
        ],
        "sources": [],
        "timings": {"retrievalMs": 0, "generationMs": 0, "totalMs": 0},
        "safetyMode": "public-filtered",
    }


def format_api_sources(results: list[tuple]) -> list[dict[str, Any]]:
    formatted = []
    for index, (document, score) in enumerate(results, start=1):
        metadata = dict(getattr(document, "metadata", {}) or {})
        numeric_score = float(score) if score is not None else 0.0
        relevance = 1 / (1 + max(0.0, numeric_score))
        section_path = metadata.get("section_path") or build_section_path(metadata) or "Overview"
        relative_path = metadata.get("source_relative_path", "Indexed source")
        formatted.append(
            {
                "id": metadata.get("chunk_id") or f"s{index}",
                "label": f"S{index}",
                "title": metadata.get("source_file", "unknown"),
                "area": metadata.get("category", "uncategorized"),
                "score": round(relevance, 6),
                "rawScore": round(numeric_score, 6),
                "chunks": 1,
                "freshness": relative_path,
                "excerpt": (document.page_content or "").strip()[:320],
                "citation": f"{metadata.get('source_file', 'unknown')} > {section_path}",
                "sectionPath": section_path,
                "metadata": metadata,
            }
        )
    return formatted


def build_answer_cards(results: list[tuple]) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    seen: set[str] = set()

    for document, _score in results:
        metadata = dict(getattr(document, "metadata", {}) or {})
        card_key = f"{metadata.get('source_relative_path')}::{metadata.get('section_path')}"
        if card_key in seen:
            continue
        seen.add(card_key)
        excerpt = " ".join((document.page_content or "").strip().split())
        cards.append(
            {
                "title": metadata.get("section_path") or metadata.get("source_file", "Reference"),
                "category": metadata.get("category", "platform"),
                "summary": excerpt[:200] + ("..." if len(excerpt) > 200 else ""),
                "sourceFile": metadata.get("source_file", "unknown"),
            }
        )
        if len(cards) >= 3:
            break

    return cards


def build_suggested_follow_ups(results: list[tuple], audience: str) -> list[str]:
    if audience == "engineering":
        return ENGINEERING_FOLLOW_UPS

    categories: list[str] = []
    for document, _score in results:
        metadata = dict(getattr(document, "metadata", {}) or {})
        category = metadata.get("category")
        if category and category not in categories:
            categories.append(category)

    suggestions: list[str] = []
    for category in categories:
        for item in PUBLIC_FOLLOW_UPS.get(category, []):
            if item not in suggestions:
                suggestions.append(item)

    if not suggestions:
        suggestions = PUBLIC_FOLLOW_UPS["platform"]

    return suggestions[:3]


def is_engineering_question(question: str) -> bool:
    lowered = question.lower()
    return any(term in lowered for term in ENGINEERING_INTENT_TERMS)


def merge_results_by_priority(*result_groups: list[tuple], limit: int) -> list[tuple]:
    merged: list[tuple] = []
    seen: set[str] = set()
    for results in result_groups:
        for document, score in results:
            metadata = dict(getattr(document, "metadata", {}) or {})
            chunk_id = metadata.get("chunk_id") or metadata.get("source_relative_path")
            dedupe_key = f"{chunk_id}:{hash((document.page_content or '').strip())}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            merged.append((document, score))
            if len(merged) >= limit:
                return merged
    return merged


def format_context_block(results: list[tuple], empty_message: str) -> str:
    if not results:
        return empty_message

    blocks = []
    for index, (document, score) in enumerate(results, start=1):
        metadata = dict(getattr(document, "metadata", {}) or {})
        block = (
            f"[S{index}] "
            f"file={metadata.get('source_file', 'unknown')} "
            f"category={metadata.get('category', 'platform')} "
            f"section={metadata.get('section_path', 'Overview')} "
            f"path={metadata.get('source_relative_path', 'unknown')} "
            f"score={float(score):.6f}\n"
            f"{document.page_content.strip()}"
        )
        blocks.append(block)
    return "\n\n".join(blocks)


def best_relevance(results: list[tuple]) -> float:
    if not results:
        return 0.0
    return max(1 / (1 + max(0.0, float(score or 0.0))) for _document, score in results)


def filter_results_for_context(results: list[tuple], min_relevance: float = 0.34) -> list[tuple]:
    filtered = [
        (document, score)
        for document, score in results
        if (1 / (1 + max(0.0, float(score or 0.0)))) >= min_relevance
    ]
    return filtered


def build_combined_context(public_results: list[tuple], engineering_results: list[tuple]) -> str:
    public_context = format_context_block(
        public_results,
        "No direct Yenkasa platform passages were retrieved for this question.",
    )
    engineering_context = format_context_block(
        engineering_results,
        "No direct engineering or uploaded-document passages were retrieved for this question.",
    )
    return (
        "YENKASA KNOWLEDGE:\n"
        f"{public_context}\n\n"
        "ENGINEERING KNOWLEDGE:\n"
        f"{engineering_context}"
    )


def build_retrieval_status(public_results: list[tuple], engineering_results: list[tuple]) -> str:
    public_relevance = best_relevance(public_results)
    engineering_relevance = best_relevance(engineering_results)

    if not public_results and not engineering_results:
        return (
            "No high-confidence knowledge-base matches were retrieved. "
            "Answer using general engineering and product reasoning, and clearly mark that the answer is best-practice guidance."
        )

    status = [
        f"Yenkasa retrieval relevance: {public_relevance:.2f}",
        f"Engineering retrieval relevance: {engineering_relevance:.2f}",
    ]
    if public_relevance < 0.38 and engineering_relevance < 0.38:
        status.append(
            "Both retrieval channels are weak. Lean on general reasoning while avoiding unsupported Yenkasa-specific claims."
        )
    elif public_relevance < 0.38:
        status.append(
            "Yenkasa retrieval is weak. Use engineering reasoning where needed and be explicit when advice is not grounded in Yenkasa docs."
        )
    elif engineering_relevance < 0.38:
        status.append(
            "Engineering retrieval is weak. Prioritize Yenkasa context, then general best practices if extra implementation advice is needed."
        )
    else:
        status.append("Both retrieval channels have usable signal. Combine them thoughtfully.")
    return "\n".join(status)


def build_hybrid_follow_ups(
    question: str,
    public_results: list[tuple],
    engineering_results: list[tuple],
    audience: str,
) -> list[str]:
    if (
        audience == "engineering"
        or best_relevance(engineering_results) >= 0.38
        or is_engineering_question(question)
    ):
        return ENGINEERING_FOLLOW_UPS

    public_suggestions = build_suggested_follow_ups(public_results, "public")
    merged: list[str] = []
    for suggestion in [*public_suggestions, *HYBRID_GENERAL_FOLLOW_UPS]:
        if suggestion not in merged:
            merged.append(suggestion)
    return merged[:3]


def answer_hybrid_query(
    question: str,
    history_pairs: list[tuple[str, str]],
    audience: Literal["public", "engineering"],
) -> dict[str, Any]:
    if audience == "public" and public_query_is_unsafe(question):
        return safe_public_refusal()

    total_started = time.perf_counter()
    public_results, public_retrieval_elapsed = state.ask_module.retrieve_chunks(
        state.public_vector_store,
        question,
        DEFAULT_RETRIEVAL_K,
    )
    engineering_results, engineering_retrieval_elapsed = state.ask_module.retrieve_chunks(
        state.engineering_vector_store,
        question,
        DEFAULT_RETRIEVAL_K,
    )
    public_results = filter_results_for_context(public_results)
    engineering_results = filter_results_for_context(engineering_results)
    combined_results = merge_results_by_priority(
        public_results,
        engineering_results,
        limit=max(DEFAULT_RETRIEVAL_K * 2, 8),
    )
    context = build_combined_context(public_results, engineering_results)
    retrieval_status = build_retrieval_status(public_results, engineering_results)
    history = state.ask_module.format_history(history_pairs, DEFAULT_MAX_HISTORY_TURNS)

    generation_started = time.perf_counter()
    try:
        response = state.llm.invoke(
            state.hybrid_prompt.format_messages(
                audience_mode=(
                    "Engineering advisor mode: be technically rigorous, concrete, and comparison-friendly."
                    if audience == "engineering"
                    else "Product assistant mode: stay clear and accessible, but still answer engineering questions when asked."
                ),
                history=history,
                question=question,
                context=context,
                retrieval_status=retrieval_status,
            )
        )
    except Exception as exc:
        raise RuntimeError(f"Vertex AI generation failed: {exc}") from exc
    generation_elapsed = time.perf_counter() - generation_started
    total_elapsed = time.perf_counter() - total_started

    answer = state.ask_module.extract_answer_text(response)
    if not answer:
        answer = (
            "I could not turn the retrieved context into a final answer, but I should still be able to help. "
            "Please ask again and I will answer using both Yenkasa context and general engineering reasoning."
        )

    return {
        "provider": "vertex_ai",
        "model": DEFAULT_MODEL,
        "audience": audience,
        "answer": answer,
        "answerCards": build_answer_cards(combined_results),
        "suggestedFollowUps": build_hybrid_follow_ups(
            question,
            public_results,
            engineering_results,
            audience,
        ),
        "sources": format_api_sources(combined_results),
        "timings": {
            "retrievalMs": round((public_retrieval_elapsed + engineering_retrieval_elapsed) * 1000),
            "publicRetrievalMs": round(public_retrieval_elapsed * 1000),
            "engineeringRetrievalMs": round(engineering_retrieval_elapsed * 1000),
            "generationMs": round(generation_elapsed * 1000),
            "totalMs": round(total_elapsed * 1000),
        },
        "safetyMode": audience,
        "retrievalMode": "hybrid_reasoning",
    }


def answer_public_query(question: str, history_pairs: list[tuple[str, str]]) -> dict[str, Any]:
    return answer_hybrid_query(question, history_pairs, "public")


def answer_engineering_query(question: str, history_pairs: list[tuple[str, str]]) -> dict[str, Any]:
    return answer_hybrid_query(question, history_pairs, "engineering")


def run_ingestion_job(job_id: str, upload_dir: Path) -> None:
    write_job(
        job_id,
        status="Running",
        progress=4,
        stageKey="validating",
        currentStage="Validating files",
        eta="Starting worker",
        startedAt=int(time.time()),
    )

    try:
        upload_paths = sorted(path for path in upload_dir.iterdir() if path.is_file() and path.suffix.lower() == ".pdf")
        if not upload_paths:
            raise RuntimeError("No PDF files were staged for ingestion.")

        def _mark_processing(current: dict[str, Any]) -> None:
            current["workerMode"] = "cloud_run"
            current["backendUrl"] = CLOUD_RUN_BACKEND_URL
            for selected in list(current.get("selectedFiles") or []):
                selected["status"] = "Processing"

        mutate_job(job_id, _mark_processing)
        write_job(
            job_id,
            progress=18,
            stageKey="chunking",
            currentStage="Uploading to production backend",
            eta=f"Sending {len(upload_paths)} PDFs to Cloud Run",
        )
        write_job(
            job_id,
            progress=48,
            stageKey="embedding",
            currentStage="Production backend is chunking and embedding",
            eta="Waiting for Cloud Run ingest",
        )

        started = time.perf_counter()
        LOGGER.info(
            "Starting Cloud Run ingestion job job_id=%s backend=%s files=%d",
            job_id,
            CLOUD_RUN_BACKEND_URL,
            len(upload_paths),
        )
        ingest_response = ingest_files_via_cloud_backend(upload_dir)
        elapsed = time.perf_counter() - started
        accepted_files = int(ingest_response.get("accepted_files") or 0)
        chunks_inserted = int(ingest_response.get("chunks_inserted") or 0)
        target_collection = str(ingest_response.get("target_collection") or ENGINEERING_COLLECTION_NAME)
        write_job(
            job_id,
            progress=86,
            stageKey="persisting",
            currentStage="Persisting production snapshot",
            eta="Waiting for backend storage sync",
            durationSeconds=round(elapsed, 2),
        )

        write_job(
            job_id,
            progress=96,
            stageKey="confirming",
            currentStage="Refreshing production health",
            eta="Checking engineering collection stats",
            durationSeconds=round(elapsed, 2),
        )

        health_warning: str | None = None
        collection_count_after_refresh: int | None = None
        health_payload: dict[str, Any] | None = None
        try:
            health_payload = fetch_cloud_backend_health()
            engineering_stats = ((health_payload.get("collection_stats") or {}).get("engineering") or {})
            vector_count = engineering_stats.get("vectorCount")
            collection_count_after_refresh = int(vector_count) if vector_count is not None else None
        except Exception as exc:
            LOGGER.exception("Cloud backend health confirmation failed job_id=%s", job_id)
            health_warning = (
                "Upload completed, but the post-ingest production health check failed. "
                f"Details: {exc}"
            )

        selected_files = list(get_job_snapshot(job_id).get("selectedFiles") or [])
        all_confirmed = accepted_files == len(selected_files)
        warning_parts = []
        if accepted_files != len(upload_paths):
            warning_parts.append(
                f"Cloud Run accepted {accepted_files} of {len(upload_paths)} uploaded files."
            )
        if health_warning:
            warning_parts.append(health_warning)
        combined_warning = " ".join(warning_parts) if warning_parts else None

        db_confirmation = {
            "confirmedFiles": accepted_files if all_confirmed else 0,
            "totalFiles": len(selected_files),
            "totalConfirmedChunks": chunks_inserted,
            "files": [
                {
                    "storageName": str(selected.get("storageName") or selected.get("name") or ""),
                    "present": all_confirmed,
                    "dbChunkCount": None,
                }
                for selected in selected_files
            ],
            "collectionName": target_collection,
            "vectorDbPath": str(
                (health_payload or {}).get("vector_db_path")
                or ingest_response.get("vector_db_path")
                or DEFAULT_PERSIST_DIR
            ),
            "collectionCount": collection_count_after_refresh,
            "uploadedToGcs": bool(ingest_response.get("uploaded_to_gcs")),
        }

        def _mark_completed(current: dict[str, Any]) -> None:
            current["status"] = "Completed"
            current["progress"] = 100
            current["stageKey"] = "completed"
            current["currentStage"] = (
                "Confirmed in production backend" if not combined_warning else "Completed with warning"
            )
            current["eta"] = "Done" if not combined_warning else "Done with warning"
            current["durationSeconds"] = round(elapsed, 2)
            current["collectionCount"] = collection_count_after_refresh
            current["dbConfirmation"] = db_confirmation
            current["backendResponse"] = ingest_response
            current["warning"] = combined_warning
            current["completedAt"] = int(time.time())
            append_job_log(
                current,
                f"Cloud Run accepted {accepted_files} files and inserted {chunks_inserted} chunks into {target_collection}.",
            )
            for selected in list(current.get("selectedFiles") or []):
                selected["status"] = "Indexed" if all_confirmed else "Uploaded"
                selected["inVectorDb"] = all_confirmed
                selected["dbChunkCount"] = None

        mutate_job(job_id, _mark_completed)
        LOGGER.info(
            "Ingestion job completed via cloud backend job_id=%s elapsed=%.2fs accepted=%d chunks=%d",
            job_id,
            elapsed,
            accepted_files,
            chunks_inserted,
        )
    except Exception as exc:
        LOGGER.exception("Ingestion job failed job_id=%s", job_id)
        def _mark_failed(current: dict[str, Any]) -> None:
            current["status"] = "Failed"
            current["progress"] = 100
            current["eta"] = "Failed"
            current["error"] = str(exc)
            current["completedAt"] = int(time.time())
            current["currentStage"] = f"{current.get('currentStage') or 'Ingestion'} failed"

        mutate_job(job_id, _mark_failed)
    finally:
        shutil.rmtree(upload_dir, ignore_errors=True)


startup_exception: Exception | None = None
try:
    startup_rag()
except Exception as exc:  # pragma: no cover - startup path
    startup_exception = exc
    state.startup_error = str(exc)
    LOGGER.exception("Failed to initialize YenkasaAI FastAPI bridge")


app = FastAPI(title="YenkasaAI API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4174",
        "http://127.0.0.1:4174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/ai/health", response_model=HealthResponse)
def health() -> HealthResponse:
    status = "operational" if state.ready else "degraded"
    if startup_exception:
        raise HTTPException(status_code=503, detail=str(startup_exception))
    return HealthResponse(
        status=status,
        provider="vertex_ai",
        model=DEFAULT_MODEL,
        project_id=DEFAULT_PROJECT_ID,
        location=DEFAULT_LOCATION,
        vector_db=str(DEFAULT_PERSIST_DIR),
        collection_name=ENGINEERING_COLLECTION_NAME,
        embeddings=DEFAULT_EMBEDDING_MODEL,
        rag_dir=str(RAG_DIR),
        collections={
            "engineering": ENGINEERING_COLLECTION_NAME,
            "public": PUBLIC_COLLECTION_NAME,
        },
        public_knowledge_dir=str(PUBLIC_KNOWLEDGE_DIR),
    )


@app.post("/api/ai/chat")
def chat(request: ChatRequest) -> dict[str, Any]:
    ensure_ready()

    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    history_pairs = history_to_pairs(request.history)
    LOGGER.info(
        "Chat request audience=%s question_chars=%d history_pairs=%d",
        request.audience,
        len(question),
        len(history_pairs),
    )

    try:
        if request.audience == "engineering":
            response = answer_engineering_query(question, history_pairs)
        else:
            response = answer_public_query(question, history_pairs)
    except Exception as exc:
        LOGGER.exception("RAG query failed audience=%s", request.audience)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return response


@app.post("/api/ai/knowledge/sync-public")
def sync_public_collection() -> dict[str, Any]:
    ensure_ready()
    try:
        summary = sync_public_knowledge(force=True)
    except Exception as exc:
        LOGGER.exception("Public knowledge sync failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return summary


@app.post("/api/ai/ingest")
async def ingest(background_tasks: BackgroundTasks, files: list[UploadFile] = File(...)) -> dict[str, Any]:
    ensure_ready()
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required.")

    job_id = f"job-{uuid4().hex[:8]}"
    upload_dir = Path(mkdtemp(prefix=f"{job_id}-", dir=str(ROOT_DIR / "yenkasa-ai" / "api")))
    accepted_files = 0
    selected_files: list[dict[str, Any]] = []

    for upload in files:
        if not upload.filename:
            continue
        if not upload.filename.lower().endswith(".pdf"):
            continue
        target = build_unique_upload_path(upload_dir, upload.filename)
        with target.open("wb") as handle:
            shutil.copyfileobj(upload.file, handle)
        selected_files.append(
            {
                "name": upload.filename,
                "storageName": target.name,
                "sizeBytes": target.stat().st_size,
                "status": "Queued",
            }
        )
        accepted_files += 1

    if accepted_files == 0:
        shutil.rmtree(upload_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported for ingestion.")

    job = write_job(
        job_id,
        id=job_id,
        name=f"ingest_{job_id}",
        status="Queued",
        progress=0,
        stageKey="queued",
        currentStage="Queued",
        eta="Queued",
        target=ENGINEERING_COLLECTION_NAME,
        acceptedFiles=accepted_files,
        selectedFiles=selected_files,
        totalFiles=accepted_files,
        createdAt=int(time.time()),
    )
    background_tasks.add_task(run_ingestion_job, job_id, upload_dir)

    return {
        "accepted": accepted_files,
        "targetCollection": ENGINEERING_COLLECTION_NAME,
        "nextJob": job,
        "mode": "fastapi",
        "endpoint": "/api/ai/ingest",
    }


@app.get("/api/ai/ingest/jobs")
def ingest_jobs() -> dict[str, Any]:
    jobs, version = list_jobs_snapshot()
    return {"jobs": jobs, "version": version}


async def ingest_job_event_stream(request: Request) -> AsyncIterator[str]:
    jobs, version = list_jobs_snapshot()
    yield f"data: {json.dumps({'jobs': jobs, 'version': version})}\n\n"
    current_version = version

    while True:
        if await request.is_disconnected():
            break

        new_version = await asyncio.to_thread(wait_for_job_update, current_version, 15.0)
        if await request.is_disconnected():
            break

        jobs, snapshot_version = list_jobs_snapshot()
        if snapshot_version == current_version:
            yield ": keep-alive\n\n"
            continue

        current_version = snapshot_version
        yield f"data: {json.dumps({'jobs': jobs, 'version': snapshot_version})}\n\n"


@app.get("/api/ai/ingest/jobs/stream")
async def ingest_jobs_stream(request: Request) -> StreamingResponse:
    return StreamingResponse(
        ingest_job_event_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
