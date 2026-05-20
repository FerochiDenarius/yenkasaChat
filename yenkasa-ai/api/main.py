from __future__ import annotations

import hashlib
import importlib.util
import logging
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from tempfile import mkdtemp
from typing import Any
from typing import Literal
from uuid import uuid4

from fastapi import BackgroundTasks
from fastapi import FastAPI
from fastapi import File
from fastapi import HTTPException
from fastapi import UploadFile
from fastapi.middleware.cors import CORSMiddleware
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

ENGINEERING_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "yenkasa_research")
PUBLIC_COLLECTION_NAME = os.getenv("CHROMA_PUBLIC_COLLECTION_NAME", "yenkasa_platform_knowledge")
DEFAULT_PERSIST_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", str(RAG_DIR / "chroma_db"))).resolve()
DEFAULT_PROJECT_ID = os.getenv("VERTEX_AI_PROJECT_ID", "project-10405180-0afd-4ecc-9f8")
DEFAULT_LOCATION = os.getenv("VERTEX_AI_LOCATION", "us-central1")
DEFAULT_MODEL = os.getenv("VERTEX_AI_MODEL", "gemini-2.5-flash")
DEFAULT_EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
DEFAULT_RETRIEVAL_K = int(os.getenv("RETRIEVAL_K", "5"))
DEFAULT_MAX_HISTORY_TURNS = int(os.getenv("MAX_HISTORY_TURNS", "6"))
PUBLIC_CHUNK_SIZE = int(os.getenv("PUBLIC_DOC_CHUNK_SIZE", "950"))
PUBLIC_CHUNK_OVERLAP = int(os.getenv("PUBLIC_DOC_CHUNK_OVERLAP", "140"))

PUBLIC_SYSTEM_PROMPT = """You are YenkasaAI, a public-facing assistant for the Yenkasa platform.

Your job is to explain Yenkasa clearly to ordinary users.

Primary topics:
- what Yenkasa is
- Yenkasa Coin (YKC)
- rewards and milestones
- verification and ranks
- Live Arena and livestream competitions
- communities
- creator growth tools
- moderation and user safety

Rules:
1. Base your answer on the retrieved Yenkasa platform context.
2. Use simple, beginner-friendly language before technical language.
3. Give a direct answer first, then short supporting points if useful.
4. Cite source labels like [S1], [S2] when the context supports a claim.
5. Do not expose internal moderation thresholds, abuse tactics, exploit paths, or security-sensitive details.
6. If a question asks how to cheat, bypass, game, spam, exploit, or evade, refuse briefly and redirect to safe guidance.
7. If the context is incomplete, say so plainly instead of guessing.
8. Keep the tone helpful, clear, and product-focused.
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
        self.engineering_prompt: Any | None = None
        self.public_prompt: Any | None = None
        self.ready = False
        self.startup_error: str | None = None
        self.startup_timings: dict[str, float] = {}
        self.jobs: dict[str, dict[str, Any]] = {}
        self.lock = threading.Lock()


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


def build_public_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", PUBLIC_SYSTEM_PROMPT),
            (
                "human",
                "Conversation history:\n{history}\n\n"
                "User question:\n{question}\n\n"
                "Retrieved Yenkasa platform context:\n{context}\n\n"
                "Write a clear answer for a normal Yenkasa user. "
                "Start with a direct answer, then use short bullets if that helps. "
                "Cite source labels like [S1] where useful. "
                "Do not reveal exploit guidance or moderation bypass details.",
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
    state.engineering_prompt = ask_module.build_prompt()
    state.public_prompt = build_public_prompt()

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


def write_job(job_id: str, **updates: Any) -> dict[str, Any]:
    with state.lock:
        current = state.jobs.get(job_id, {})
        current.update(updates)
        state.jobs[job_id] = current
        return dict(current)


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
        return [
            "What are the main scaling risks in this subsystem?",
            "Which routes or sockets own this behavior today?",
            "What should be refactored first to reduce operational risk?",
        ]

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


def format_public_context(results: list[tuple]) -> str:
    if not results:
        return "No relevant Yenkasa platform context retrieved."

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


def answer_public_query(question: str, history_pairs: list[tuple[str, str]]) -> dict[str, Any]:
    if public_query_is_unsafe(question):
        return safe_public_refusal()

    total_started = time.perf_counter()
    results, retrieval_elapsed = state.ask_module.retrieve_chunks(
        state.public_vector_store,
        question,
        DEFAULT_RETRIEVAL_K,
    )
    context = format_public_context(results)
    history = state.ask_module.format_history(history_pairs, DEFAULT_MAX_HISTORY_TURNS)

    generation_started = time.perf_counter()
    try:
        response = state.llm.invoke(
            state.public_prompt.format_messages(
                history=history,
                question=question,
                context=context,
            )
        )
    except Exception as exc:
        raise RuntimeError(f"Vertex AI generation failed: {exc}") from exc
    generation_elapsed = time.perf_counter() - generation_started
    total_elapsed = time.perf_counter() - total_started

    answer = state.ask_module.extract_answer_text(response)
    if not answer:
        answer = (
            "I found relevant Yenkasa platform knowledge, but the final answer came back empty. "
            "Please ask again or try a more specific question."
        )

    return {
        "provider": "vertex_ai",
        "model": DEFAULT_MODEL,
        "audience": "public",
        "answer": answer,
        "answerCards": build_answer_cards(results),
        "suggestedFollowUps": build_suggested_follow_ups(results, "public"),
        "sources": format_api_sources(results),
        "timings": {
            "retrievalMs": round(retrieval_elapsed * 1000),
            "generationMs": round(generation_elapsed * 1000),
            "totalMs": round(total_elapsed * 1000),
        },
        "safetyMode": "public",
    }


def answer_engineering_query(question: str, history_pairs: list[tuple[str, str]]) -> dict[str, Any]:
    answer, results, timings = state.ask_module.answer_query(
        query=question,
        vector_store=state.engineering_vector_store,
        llm=state.llm,
        prompt=state.engineering_prompt,
        conversation_history=history_pairs,
        retrieval_k=DEFAULT_RETRIEVAL_K,
        max_history_turns=DEFAULT_MAX_HISTORY_TURNS,
    )
    return {
        "provider": "vertex_ai",
        "model": DEFAULT_MODEL,
        "audience": "engineering",
        "answer": answer,
        "answerCards": build_answer_cards(results),
        "suggestedFollowUps": build_suggested_follow_ups(results, "engineering"),
        "sources": format_api_sources(results),
        "timings": {
            "retrievalMs": round(timings["retrieval_elapsed"] * 1000),
            "generationMs": round(timings["generation_elapsed"] * 1000),
            "totalMs": round(timings["total_elapsed"] * 1000),
        },
        "safetyMode": "engineering",
    }


def run_ingestion_job(job_id: str, upload_dir: Path) -> None:
    write_job(job_id, status="Running", progress=18, eta="Embedding in progress")

    try:
        command = [
            str(RAG_VENV_PYTHON),
            str(INGEST_SCRIPT),
            "--pdf-folder",
            str(upload_dir),
            "--persist-dir",
            str(DEFAULT_PERSIST_DIR),
            "--collection-name",
            ENGINEERING_COLLECTION_NAME,
            "--embedding-provider",
            "huggingface",
            "--tag-metadata",
            "--log-level",
            "INFO",
        ]
        LOGGER.info("Starting ingestion job job_id=%s command=%s", job_id, command)
        started = time.perf_counter()
        completed = subprocess.run(
            command,
            cwd=str(RAG_DIR),
            capture_output=True,
            text=True,
            env=os.environ.copy(),
            check=False,
        )
        elapsed = time.perf_counter() - started

        if completed.returncode != 0:
            raise RuntimeError(
                f"Ingestion failed rc={completed.returncode} stderr={completed.stderr.strip()[:600]}"
            )

        write_job(
            job_id,
            status="Completed",
            progress=100,
            eta="Done",
            durationSeconds=round(elapsed, 2),
            stdout=completed.stdout[-4000:],
        )
        LOGGER.info("Ingestion job completed job_id=%s elapsed=%.2fs", job_id, elapsed)
    except Exception as exc:
        LOGGER.exception("Ingestion job failed job_id=%s", job_id)
        write_job(job_id, status="Failed", progress=100, eta="Failed", error=str(exc))
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

    for upload in files:
        if not upload.filename:
            continue
        target = upload_dir / sanitize_filename(upload.filename)
        with target.open("wb") as handle:
            shutil.copyfileobj(upload.file, handle)
        accepted_files += 1

    if accepted_files == 0:
        shutil.rmtree(upload_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="No valid files were uploaded.")

    job = write_job(
        job_id,
        id=job_id,
        name=f"ingest_{job_id}",
        status="Queued",
        progress=0,
        eta="Queued",
        target=ENGINEERING_COLLECTION_NAME,
        acceptedFiles=accepted_files,
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
    return {"jobs": list(state.jobs.values())}
