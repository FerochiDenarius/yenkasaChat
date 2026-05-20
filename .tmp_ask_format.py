from __future__ import annotations

import argparse
import logging
import os
import time
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate


LOGGER = logging.getLogger("yenkasa_engineering_ai")
DEFAULT_HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_CHAT_MODEL = "gemini-2.5-flash"
DEFAULT_COLLECTION_NAME = "yenkasa_research"
DEFAULT_VERTEX_PROJECT_ID = "project-10405180-0afd-4ecc-9f8"
DEFAULT_VERTEX_LOCATION = "us-central1"

SYSTEM_PROMPT = """You are Yenkasa Engineering AI, a production-focused engineering assistant.

Your domain focus is:
- distributed systems
- livestream scalability
- Socket.IO architecture
- mobile optimization
- AI moderation
- social media infrastructure

Rules:
1. Base your answer primarily on the retrieved Yenkasa research context.
2. Synthesize and summarize instead of quoting long passages.
3. When the context supports a claim, cite the relevant source labels like [S1], [S2].
4. If the context is incomplete, say so directly and identify what is missing.
5. Prefer concrete engineering tradeoffs, bottlenecks, failure modes, and implementation guidance.
6. Keep answers cleanly structured and conversational, but technically rigorous.
7. Do not invent architecture details that are not supported by the retrieved context.
"""


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="Ask Yenkasa Engineering AI questions using Vertex AI Gemini + Chroma RAG."
    )
    parser.add_argument(
        "--persist-dir",
        default=os.getenv("CHROMA_PERSIST_DIR", str(script_dir / "chroma_db")),
        help="Directory where the Chroma vector database is stored.",
    )
    parser.add_argument(
        "--collection-name",
        default=os.getenv("CHROMA_COLLECTION_NAME", DEFAULT_COLLECTION_NAME),
        help="Chroma collection name.",
    )
    parser.add_argument(
        "--retrieval-k",
        type=int,
        default=int(os.getenv("RETRIEVAL_K", "5")),
        help="Number of chunks to retrieve from Chroma per query.",
    )
    parser.add_argument(
        "--embedding-model",
        default=os.getenv("EMBEDDING_MODEL", DEFAULT_HF_MODEL),
        help="HuggingFace embedding model used for query retrieval.",
    )
    parser.add_argument(
        "--chat-model",
        default=os.getenv("VERTEX_AI_MODEL", DEFAULT_CHAT_MODEL),
        help="Vertex AI Gemini chat model to use for answer generation.",
    )
    parser.add_argument(
        "--vertex-project-id",
        default=os.getenv("VERTEX_AI_PROJECT_ID", DEFAULT_VERTEX_PROJECT_ID),
        help="Google Cloud project ID for Vertex AI.",
    )
    parser.add_argument(
        "--vertex-location",
        default=os.getenv("VERTEX_AI_LOCATION", DEFAULT_VERTEX_LOCATION),
        help="Vertex AI region.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=float(os.getenv("VERTEX_AI_TEMPERATURE", "0.2")),
        help="Vertex AI Gemini generation temperature.",
    )
    parser.add_argument(
        "--max-history-turns",
        type=int,
        default=int(os.getenv("MAX_HISTORY_TURNS", "6")),
        help="How many previous Q/A turns to keep in prompt context.",
    )
    parser.add_argument(
        "--query",
        default=None,
        help="Optional one-shot query. If omitted, the script starts an interactive loop.",
    )
    parser.add_argument(
        "--verbose",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Show INFO-level operational logs and richer source diagnostics.",
    )
    parser.add_argument(
        "--debug",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Show DEBUG-level logs and detailed source chunk previews.",
    )
    parser.add_argument(
        "--log-level",
        default=None,
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
        help="Override logging verbosity explicitly.",
    )
    return parser.parse_args()


def resolve_log_level(args: argparse.Namespace) -> str:
    if args.log_level:
        return args.log_level.upper()
    if args.debug:
        return "DEBUG"
    if args.verbose:
        return "INFO"
    return os.getenv("LOG_LEVEL", "WARNING").upper()


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def load_environment(script_dir: Path) -> None:
    env_path = script_dir / ".env"
    load_dotenv(env_path)
    LOGGER.info("Environment loaded env_path=%s exists=%s", env_path, env_path.exists())


def get_huggingface_embeddings_class():
    try:
        from langchain_huggingface import HuggingFaceEmbeddings

        return HuggingFaceEmbeddings
    except ImportError:
        from langchain_community.embeddings import HuggingFaceEmbeddings

        LOGGER.warning(
            "langchain-huggingface is not installed; falling back to deprecated "
            "langchain_community.HuggingFaceEmbeddings."
        )
        return HuggingFaceEmbeddings


def build_embedding_function(model_name: str):
    started_at = time.perf_counter()
    try:
        chosen_model = model_name or DEFAULT_HF_MODEL
        HuggingFaceEmbeddings = get_huggingface_embeddings_class()
        embedding = HuggingFaceEmbeddings(
            model_name=chosen_model,
            model_kwargs={"device": "cpu"},
        )
        LOGGER.info(
            "Embedding backend ready provider=huggingface model=%s init_time=%.2fs",
            chosen_model,
            time.perf_counter() - started_at,
        )
        return embedding
    except Exception as exc:
        raise RuntimeError(
            "Failed to initialize HuggingFace embeddings. Ensure the model is cached locally "
            "or that network access to huggingface.co is available."
        ) from exc


def validate_vertex_adc(project_id: str) -> str:
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        LOGGER.warning(
            "Ignoring GOOGLE_API_KEY/GEMINI_API_KEY because Vertex AI uses Application Default Credentials."
        )

    try:
        import google.auth
    except ImportError as exc:
        raise RuntimeError("google-auth is not installed in the current virtualenv.") from exc

    try:
        credentials, detected_project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    except Exception as exc:
        raise RuntimeError(
            "Failed to load Application Default Credentials. Run "
            "'gcloud auth application-default login' and retry."
        ) from exc

    if credentials is None:
        raise RuntimeError(
            "Application Default Credentials resolved to None. Run "
            "'gcloud auth application-default login' and retry."
        )

    credential_type = type(credentials).__name__
    resolved_project = detected_project or project_id
    if detected_project and detected_project != project_id:
        LOGGER.warning(
            "ADC project mismatch adc_project=%s requested_project=%s credential_type=%s",
            detected_project,
            project_id,
            credential_type,
        )
    else:
        LOGGER.info(
            "Vertex ADC validated provider=gcloud_adc project=%s credential_type=%s",
            resolved_project,
            credential_type,
        )

    return credential_type


def build_chat_model(model_name: str, temperature: float, project_id: str, location: str):
    credential_type = validate_vertex_adc(project_id)

    try:
        from langchain_google_vertexai import ChatVertexAI
    except ImportError as exc:
        raise RuntimeError(
            "langchain-google-vertexai is not installed. Install it with: "
            "venv/bin/python -m pip install -U langchain-google-vertexai"
        ) from exc

    started_at = time.perf_counter()
    try:
        llm = ChatVertexAI(
            model=model_name,
            project=project_id,
            location=location,
            temperature=temperature,
        )
    except Exception as exc:
        raise RuntimeError(
            f"Failed to initialize Vertex AI chat model model={model_name} project={project_id} location={location}"
        ) from exc

    LOGGER.info(
        "Vertex AI Gemini chat model ready provider=vertex_ai auth=gcloud_adc model=%s project=%s location=%s credential_type=%s init_time=%.2fs",
        model_name,
        project_id,
        location,
        credential_type,
        time.perf_counter() - started_at,
    )
    return llm


def build_vector_store(persist_dir: Path, collection_name: str, embedding_function) -> Chroma:
    if not persist_dir.exists() or not persist_dir.is_dir():
        raise RuntimeError(f"Chroma persist directory does not exist: {persist_dir}")

    if not any(persist_dir.iterdir()):
        raise RuntimeError(f"Chroma persist directory is empty: {persist_dir}")

    started_at = time.perf_counter()
    vector_store = Chroma(
        persist_directory=str(persist_dir),
        collection_name=collection_name,
        embedding_function=embedding_function,
    )
    LOGGER.info(
        "Vector store ready persist_dir=%s collection=%s init_time=%.2fs",
        persist_dir,
        collection_name,
        time.perf_counter() - started_at,
    )
    return vector_store


def dedupe_results(results: Iterable[tuple], limit: int) -> list[tuple]:
    deduped: list[tuple] = []
    seen: set[str] = set()

    for document, score in results:
        metadata = getattr(document, "metadata", {}) or {}
        dedupe_key = (
            metadata.get("chunk_id")
            or f"{metadata.get('source_relative_path', '')}:{metadata.get('page_number', '')}:{hash(document.page_content)}"
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        deduped.append((document, score))
        if len(deduped) >= limit:
            break

    return deduped


def retrieve_chunks(vector_store: Chroma, query: str, retrieval_k: int) -> tuple[list[tuple], float]:
    started_at = time.perf_counter()
    raw_results = vector_store.similarity_search_with_score(query, k=retrieval_k)
    retrieval_elapsed = time.perf_counter() - started_at
    results = dedupe_results(raw_results, retrieval_k)
    LOGGER.info(
        "Retrieved chunks query_chars=%d requested_k=%d returned=%d elapsed=%.2fs",
        len(query),
        retrieval_k,
        len(results),
        retrieval_elapsed,
    )
    return results, retrieval_elapsed


def format_history(conversation_history: list[tuple[str, str]], max_turns: int) -> str:
    if not conversation_history:
        return "No previous conversation."

    recent_turns = conversation_history[-max_turns:]
    lines = []
    for index, (question, answer) in enumerate(recent_turns, start=1):
        lines.append(f"Turn {index} Question: {question}")
        lines.append(f"Turn {index} Answer: {answer}")
    return "\n".join(lines)


def format_context(results: list[tuple]) -> str:
    if not results:
        return "No relevant research context retrieved."

    blocks = []
    for index, (document, score) in enumerate(results, start=1):
        metadata = getattr(document, "metadata", {}) or {}
        block = (
            f"[S{index}] "
            f"file={metadata.get('source_file', 'unknown')} "
            f"path={metadata.get('source_relative_path', 'unknown')} "
            f"page={metadata.get('page_number', 'unknown')} "
            f"category={metadata.get('category', 'uncategorized')} "
            f"score={score:.6f}\n"
            f"{document.page_content.strip()}"
        )
        blocks.append(block)
    return "\n\n".join(blocks)


def build_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            (
                "human",
                "Conversation history:\n{history}\n\n"
                "User question:\n{question}\n\n"
                "Retrieved engineering research context:\n{context}\n\n"
                "Write a technically rigorous answer grounded in the retrieved context. "
                "Cite source labels like [S1] where relevant. "
                "If the context is insufficient, say what is missing.",
            ),
        ]
    )


def format_sources(results: list[tuple]) -> str:
    if not results:
        return "No sources retrieved."

    lines = []
    for index, (document, score) in enumerate(results, start=1):
        metadata = getattr(document, "metadata", {}) or {}
        lines.append(
            f"[S{index}] file={metadata.get('source_file', 'unknown')} | "
            f"path={metadata.get('source_relative_path', 'unknown')} | "
            f"page={metadata.get('page_number', 'unknown')} | "
            f"category={metadata.get('category', 'uncategorized')} | "
            f"chunk_id={metadata.get('chunk_id', 'unknown')} | "
            f"score={score:.6f}"
        )
    return "\n".join(lines)


def format_source_previews(results: list[tuple]) -> str:
    if not results:
        return "No source previews available."

    previews = []
    for index, (document, score) in enumerate(results, start=1):
        metadata = getattr(document, "metadata", {}) or {}
        preview_text = " ".join(document.page_content.strip().split())
        preview_text = preview_text[:280] + ("..." if len(preview_text) > 280 else "")
        previews.append(
            f"[S{index}] file={metadata.get('source_file', 'unknown')} "
            f"page={metadata.get('page_number', 'unknown')} score={score:.6f}\n"
            f"{preview_text}"
        )
    return "\n\n".join(previews)


def answer_query(
    query: str,
    vector_store: Chroma,
    llm,
    prompt: ChatPromptTemplate,
    conversation_history: list[tuple[str, str]],
    retrieval_k: int,
    max_history_turns: int,
) -> tuple[str, list[tuple], dict[str, float]]:
    total_started = time.perf_counter()

    results, retrieval_elapsed = retrieve_chunks(vector_store, query, retrieval_k)
    context = format_context(results)
    history = format_history(conversation_history, max_history_turns)

    generation_started = time.perf_counter()
    try:
        response = llm.invoke(
            prompt.format_messages(
                history=history,
                question=query,
                context=context,
            )
        )
    except Exception as exc:
        raise RuntimeError(f"Vertex AI generation failed: {exc}") from exc
    generation_elapsed = time.perf_counter() - generation_started
    total_elapsed = time.perf_counter() - total_started

    answer_text = getattr(response, "content", response)
    if isinstance(answer_text, list):
        answer_text = "\n".join(str(item) for item in answer_text)

    usage_metadata = getattr(response, "usage_metadata", None)
    if usage_metadata:
        LOGGER.info("Vertex AI token usage %s", usage_metadata)

    LOGGER.info(
        "Answered query provider=vertex_ai retrieval_elapsed=%.2fs generation_elapsed=%.2fs total_elapsed=%.2fs",
        retrieval_elapsed,
        generation_elapsed,
        total_elapsed,
    )
    return str(answer_text).strip(), results, {
        "retrieval_elapsed": retrieval_elapsed,
        "generation_elapsed": generation_elapsed,
        "total_elapsed": total_elapsed,
    }


def print_banner(
    persist_dir: Path,
    collection_name: str,
    retrieval_k: int,
    chat_model: str,
    project_id: str,
    location: str,
) -> None:
    print("\nYenkasa Engineering AI RAG Ready")
    print("Type /help for commands, /clear to reset chat history, /exit to quit.")
    print(f"Vector DB: {persist_dir}")
    print(f"Collection: {collection_name}")
    print(f"Top-K Retrieval: {retrieval_k}")
    print(f"Vertex AI Gemini Model: {chat_model}")
    print(f"Vertex Project: {project_id}")
    print(f"Vertex Location: {location}")
    print("Auth: Application Default Credentials (gcloud)")


def print_help() -> None:
    print("\nCommands:")
    print("  /help   Show available commands")
    print("  /clear  Clear conversation history")
    print("  /exit   Quit the assistant")


def print_response(
    answer: str,
    results: list[tuple],
    timings: dict[str, float],
    verbose: bool,
    debug: bool,
) -> None:
    print("\n" + "=" * 72)
    print("Answer:\n")
    print(answer or "No answer generated.")

    print("\nSources used:\n")
    print(format_sources(results))

    if verbose or debug:
        print("\nSource previews:\n")
        print(format_source_previews(results))

    print("\nLatency:\n")
    print(
        f"retrieval={timings['retrieval_elapsed']:.2f}s | "
        f"generation={timings['generation_elapsed']:.2f}s | "
        f"total={timings['total_elapsed']:.2f}s"
    )
    print("=" * 72)


def run() -> int:
    args = parse_args()
    configure_logging(resolve_log_level(args))

    script_dir = Path(__file__).resolve().parent
    load_environment(script_dir)

    persist_dir = Path(args.persist_dir).expanduser().resolve()

    try:
        embedding_function = build_embedding_function(model_name=args.embedding_model)
        vector_store = build_vector_store(
            persist_dir=persist_dir,
            collection_name=args.collection_name,
            embedding_function=embedding_function,
        )
        llm = build_chat_model(
            model_name=args.chat_model,
            temperature=args.temperature,
            project_id=args.vertex_project_id,
            location=args.vertex_location,
        )
    except Exception as exc:
        LOGGER.error("Startup failed: %s", exc)
        return 1

    prompt = build_prompt()
    conversation_history: list[tuple[str, str]] = []

    def handle_query(query: str) -> None:
        try:
            answer, results, timings = answer_query(
                query=query,
                vector_store=vector_store,
                llm=llm,
                prompt=prompt,
                conversation_history=conversation_history,
                retrieval_k=args.retrieval_k,
                max_history_turns=args.max_history_turns,
            )
        except Exception as exc:
            LOGGER.exception("Query handling failed.")
            print(f"\nError: {exc}")
            return

        conversation_history.append((query, answer))
        print_response(
            answer=answer,
            results=results,
            timings=timings,
            verbose=args.verbose,
            debug=args.debug,
        )

    if args.query:
        handle_query(args.query.strip())
        return 0

    print_banner(
        persist_dir=persist_dir,
        collection_name=args.collection_name,
        retrieval_k=args.retrieval_k,
        chat_model=args.chat_model,
        project_id=args.vertex_project_id,
        location=args.vertex_location,
    )

    while True:
        try:
            user_input = input("\nAsk YenkasaAI: ").strip()
        except EOFError:
            print("\nExiting.")
            break
        except KeyboardInterrupt:
            print("\nInterrupted. Exiting.")
            break

        if not user_input:
            continue
        if user_input.lower() in {"/exit", "exit", "quit"}:
            print("\nExiting.")
            break
        if user_input.lower() == "/help":
            print_help()
            continue
        if user_input.lower() == "/clear":
            conversation_history.clear()
            print("\nConversation history cleared.")
            continue

        handle_query(user_input)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(run())
    except KeyboardInterrupt:
        LOGGER.error("Interrupted by user.")
        raise SystemExit(130)
