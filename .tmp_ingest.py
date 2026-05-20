from __future__ import annotations

import argparse
import hashlib
import logging
import os
import sys
import time
from pathlib import Path
from typing import Iterable

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter


LOGGER = logging.getLogger("yenkasa_rag_ingest")
DEFAULT_HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_GEMINI_MODEL = "models/text-embedding-004"


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(
        description="Ingest research PDFs into a Chroma vector database."
    )
    parser.add_argument(
        "--pdf-folder",
        default=str(script_dir / "pdfs"),
        help="Folder containing PDFs. Subdirectories are scanned recursively.",
    )
    parser.add_argument(
        "--persist-dir",
        default=str(script_dir / "chroma_db"),
        help="Directory where Chroma will persist the vector database.",
    )
    parser.add_argument(
        "--collection-name",
        default="yenkasa_research",
        help="Chroma collection name.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="Chunk size for RecursiveCharacterTextSplitter.",
    )
    parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=200,
        help="Chunk overlap for RecursiveCharacterTextSplitter.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=128,
        help="Number of chunks to embed per Chroma add batch.",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Optional cap for processed PDFs, useful for testing.",
    )
    parser.add_argument(
        "--embedding-provider",
        choices=("huggingface", "gemini"),
        default="huggingface",
        help="Embedding backend to use. Gemini support is prepared for migration.",
    )
    parser.add_argument(
        "--embedding-model",
        default=DEFAULT_HF_MODEL,
        help="Embedding model name for the selected provider.",
    )
    parser.add_argument(
        "--tag-metadata",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Attach filename/category metadata to each chunk.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
        help="Logging verbosity.",
    )
    return parser.parse_args()


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def iter_pdf_files(pdf_root: Path) -> list[Path]:
    return sorted(
        path
        for path in pdf_root.rglob("*")
        if path.is_file() and path.suffix.lower() == ".pdf"
    )


def sha256_for_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            data = handle.read(chunk_size)
            if not data:
                break
            digest.update(data)
    return digest.hexdigest()


def infer_category(pdf_path: Path, pdf_root: Path) -> str:
    try:
        relative_parent = pdf_path.relative_to(pdf_root).parent
    except ValueError:
        relative_parent = pdf_path.parent

    if str(relative_parent) not in ("", "."):
        return relative_parent.parts[0]

    stem = pdf_path.stem.strip()
    if not stem:
        return "uncategorized"

    normalized = stem.replace("-", "_").replace(" ", "_")
    return normalized.split("_", 1)[0].lower() or "uncategorized"


def build_embedding_function(provider: str, model_name: str):
    started_at = time.perf_counter()
    try:
        if provider == "huggingface":
            chosen_model = model_name or DEFAULT_HF_MODEL
            embedding = HuggingFaceEmbeddings(
                model_name=chosen_model,
                model_kwargs={"device": "cpu"},
            )
            LOGGER.info(
                "Embedding provider ready provider=%s model=%s init_time=%.2fs",
                provider,
                chosen_model,
                time.perf_counter() - started_at,
            )
            return embedding

        if provider == "gemini":
            chosen_model = (
                model_name if model_name and model_name != DEFAULT_HF_MODEL else DEFAULT_GEMINI_MODEL
            )
            google_api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if not google_api_key:
                raise RuntimeError(
                    "Gemini embeddings requested but GOOGLE_API_KEY/GEMINI_API_KEY is not set."
                )

            try:
                from langchain_google_genai import GoogleGenerativeAIEmbeddings
            except ImportError as exc:
                raise RuntimeError(
                    "Gemini embeddings requested but langchain-google-genai is not installed."
                ) from exc

            embedding = GoogleGenerativeAIEmbeddings(
                model=chosen_model,
                google_api_key=google_api_key,
            )
            LOGGER.info(
                "Embedding provider ready provider=%s model=%s init_time=%.2fs",
                provider,
                chosen_model,
                time.perf_counter() - started_at,
            )
            return embedding

        raise ValueError(f"Unsupported embedding provider: {provider}")
    except Exception as exc:
        provider_hint = (
            "Ensure the HuggingFace model is cached locally or that network access to huggingface.co is available."
            if provider == "huggingface"
            else "Ensure GOOGLE_API_KEY/GEMINI_API_KEY is set and langchain-google-genai is installed."
        )
        raise RuntimeError(
            f"Failed to initialize embedding provider '{provider}'. {provider_hint}"
        ) from exc


def non_empty_documents(documents: Iterable, pdf_path: Path, pdf_root: Path, file_hash: str, tag_metadata: bool) -> list:
    prepared = []
    category = infer_category(pdf_path, pdf_root)
    relative_path = str(pdf_path.relative_to(pdf_root))

    for page_index, document in enumerate(documents, start=1):
        page_content = (getattr(document, "page_content", "") or "").strip()
        if not page_content:
            continue

        metadata = dict(getattr(document, "metadata", {}) or {})
        metadata["source_path"] = str(pdf_path.resolve())
        metadata["source_relative_path"] = relative_path
        metadata["source_file"] = pdf_path.name
        metadata["file_sha256"] = file_hash
        metadata["page_number"] = metadata.get("page", page_index - 1) + 1

        if tag_metadata:
            metadata["category"] = category
            metadata["filename_stem"] = pdf_path.stem

        document.metadata = metadata
        prepared.append(document)

    return prepared


def build_chunk_id(document, chunk_index: int) -> str:
    metadata = getattr(document, "metadata", {}) or {}
    file_hash = metadata.get("file_sha256", "")
    page_number = metadata.get("page_number", 0)
    content_hash = hashlib.sha256(document.page_content.encode("utf-8", errors="ignore")).hexdigest()
    raw_id = f"{file_hash}:{page_number}:{chunk_index}:{content_hash}"
    return hashlib.sha256(raw_id.encode("utf-8")).hexdigest()


def existing_ids_for_batch(vector_store: Chroma, batch_ids: list[str]) -> set[str]:
    if not batch_ids:
        return set()

    try:
        existing = vector_store.get(ids=batch_ids, include=[])
    except Exception:
        LOGGER.exception("Failed to query existing chunk IDs for batch dedupe. Continuing without pre-check.")
        return set()

    ids = existing.get("ids") or []
    return {chunk_id for chunk_id in ids if chunk_id}


def add_documents_to_store(
    vector_store: Chroma,
    documents: list,
    document_ids: list[str],
    batch_size: int,
    file_label: str,
) -> tuple[int, int, int, float]:
    inserted_chunks = 0
    skipped_existing_chunks = 0
    failed_chunks = 0
    embedding_elapsed_total = 0.0

    total_batches = (len(documents) + batch_size - 1) // batch_size
    for batch_number, start_index in enumerate(range(0, len(documents), batch_size), start=1):
        batch_docs = documents[start_index : start_index + batch_size]
        batch_ids = document_ids[start_index : start_index + batch_size]
        existing_ids = existing_ids_for_batch(vector_store, batch_ids)

        docs_to_add = []
        ids_to_add = []
        for document, chunk_id in zip(batch_docs, batch_ids):
            if chunk_id in existing_ids:
                skipped_existing_chunks += 1
                continue
            docs_to_add.append(document)
            ids_to_add.append(chunk_id)

        if not docs_to_add:
            LOGGER.info(
                "Skipped already-ingested batch file=%s batch=%d/%d batch_size=%d",
                file_label,
                batch_number,
                total_batches,
                len(batch_docs),
            )
            continue

        batch_started = time.perf_counter()
        try:
            vector_store.add_texts(
                texts=[document.page_content for document in docs_to_add],
                metadatas=[document.metadata for document in docs_to_add],
                ids=ids_to_add,
            )
            batch_elapsed = time.perf_counter() - batch_started
            embedding_elapsed_total += batch_elapsed
            inserted_chunks += len(docs_to_add)
            docs_per_second = len(docs_to_add) / batch_elapsed if batch_elapsed > 0 else float("inf")
            LOGGER.info(
                "Embedded batch file=%s batch=%d/%d new_chunks=%d skipped_existing=%d elapsed=%.2fs docs_per_second=%.2f",
                file_label,
                batch_number,
                total_batches,
                len(docs_to_add),
                len(batch_docs) - len(docs_to_add),
                batch_elapsed,
                docs_per_second,
            )
            continue
        except Exception:
            LOGGER.exception(
                "Batch embed/write failed file=%s batch=%d/%d size=%d. Retrying per chunk.",
                file_label,
                batch_number,
                total_batches,
                len(docs_to_add),
            )

        for document, chunk_id in zip(docs_to_add, ids_to_add):
            if chunk_id in existing_ids_for_batch(vector_store, [chunk_id]):
                skipped_existing_chunks += 1
                continue

            single_started = time.perf_counter()
            try:
                vector_store.add_texts(
                    texts=[document.page_content],
                    metadatas=[document.metadata],
                    ids=[chunk_id],
                )
                single_elapsed = time.perf_counter() - single_started
                embedding_elapsed_total += single_elapsed
                inserted_chunks += 1
                LOGGER.debug(
                    "Embedded single chunk fallback file=%s chunk_id=%s elapsed=%.2fs",
                    file_label,
                    chunk_id,
                    single_elapsed,
                )
            except Exception:
                failed_chunks += 1
                LOGGER.exception(
                    "Failed to embed/write chunk file=%s chunk_id=%s",
                    file_label,
                    chunk_id,
                )

    return inserted_chunks, skipped_existing_chunks, failed_chunks, embedding_elapsed_total


def ingest() -> int:
    args = parse_args()
    configure_logging(args.log_level)

    pdf_root = Path(args.pdf_folder).expanduser().resolve()
    persist_dir = Path(args.persist_dir).expanduser().resolve()

    if not pdf_root.exists() or not pdf_root.is_dir():
        LOGGER.error("PDF folder does not exist: %s", pdf_root)
        return 1

    pdf_files = iter_pdf_files(pdf_root)
    if args.max_files is not None:
        pdf_files = pdf_files[: args.max_files]

    if not pdf_files:
        LOGGER.error("No PDF files found in %s", pdf_root)
        return 1

    LOGGER.info("Starting ingestion pdf_root=%s total_candidate_pdfs=%d", pdf_root, len(pdf_files))

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )

    try:
        embedding = build_embedding_function(
            provider=args.embedding_provider,
            model_name=args.embedding_model,
        )
    except Exception:
        LOGGER.exception("Embedding backend initialization failed.")
        return 1

    persist_dir.mkdir(parents=True, exist_ok=True)
    try:
        vector_store = Chroma(
            collection_name=args.collection_name,
            embedding_function=embedding,
            persist_directory=str(persist_dir),
        )
    except Exception:
        LOGGER.exception("Failed to initialize Chroma vector store persist_dir=%s", persist_dir)
        return 1

    seen_hashes: dict[str, str] = {}

    successful_files = 0
    failed_files = 0
    duplicate_files = 0
    empty_files = 0
    total_pages = 0
    total_chunks_created = 0
    total_chunks_inserted = 0
    total_chunks_skipped_existing = 0
    total_chunk_failures = 0
    embedding_elapsed_total = 0.0

    load_started = time.perf_counter()

    for index, pdf_path in enumerate(pdf_files, start=1):
        file_started = time.perf_counter()
        LOGGER.info("[%d/%d] Inspecting PDF %s", index, len(pdf_files), pdf_path.name)

        try:
            file_size = pdf_path.stat().st_size
            if file_size <= 0:
                empty_files += 1
                LOGGER.warning("[%d/%d] Skipping empty PDF file %s", index, len(pdf_files), pdf_path)
                continue

            file_hash = sha256_for_file(pdf_path)
            if file_hash in seen_hashes:
                duplicate_files += 1
                LOGGER.warning(
                    "[%d/%d] Skipping duplicate PDF %s duplicate_of=%s",
                    index,
                    len(pdf_files),
                    pdf_path.name,
                    seen_hashes[file_hash],
                )
                continue

            seen_hashes[file_hash] = str(pdf_path.relative_to(pdf_root))

            pdf_load_started = time.perf_counter()
            loader = PyPDFLoader(str(pdf_path))
            raw_documents = loader.load()
            pdf_load_elapsed = time.perf_counter() - pdf_load_started

            prepared_documents = non_empty_documents(
                documents=raw_documents,
                pdf_path=pdf_path,
                pdf_root=pdf_root,
                file_hash=file_hash,
                tag_metadata=args.tag_metadata,
            )

            if not prepared_documents:
                empty_files += 1
                LOGGER.warning(
                    "[%d/%d] Skipping PDF with no extractable text %s load_time=%.2fs",
                    index,
                    len(pdf_files),
                    pdf_path.name,
                    pdf_load_elapsed,
                )
                continue

            split_started = time.perf_counter()
            file_chunks = splitter.split_documents(prepared_documents)
            split_elapsed = time.perf_counter() - split_started

            if not file_chunks:
                empty_files += 1
                LOGGER.warning(
                    "[%d/%d] Skipping PDF with no chunks after splitting %s",
                    index,
                    len(pdf_files),
                    pdf_path.name,
                )
                continue

            file_chunk_ids: list[str] = []
            for file_chunk_index, chunk in enumerate(file_chunks, start=1):
                if args.tag_metadata:
                    chunk.metadata["chunk_index"] = file_chunk_index
                chunk_id = build_chunk_id(chunk, file_chunk_index)
                chunk.metadata["chunk_id"] = chunk_id
                file_chunk_ids.append(chunk_id)

            embed_started = time.perf_counter()
            inserted_chunks, skipped_existing_chunks, failed_chunks, embed_elapsed = add_documents_to_store(
                vector_store=vector_store,
                documents=file_chunks,
                document_ids=file_chunk_ids,
                batch_size=args.batch_size,
                file_label=pdf_path.name,
            )
            embedding_elapsed_total += embed_elapsed
            total_chunks_created += len(file_chunks)
            total_chunks_inserted += inserted_chunks
            total_chunks_skipped_existing += skipped_existing_chunks
            total_chunk_failures += failed_chunks

            successful_files += 1
            total_pages += len(prepared_documents)
            LOGGER.info(
                "[%d/%d] Loaded PDF %s pages=%d raw_pages=%d chunks=%d inserted=%d skipped_existing=%d chunk_failures=%d load_time=%.2fs split_time=%.2fs embed_time=%.2fs total_time=%.2fs",
                index,
                len(pdf_files),
                pdf_path.name,
                len(prepared_documents),
                len(raw_documents),
                len(file_chunks),
                inserted_chunks,
                skipped_existing_chunks,
                failed_chunks,
                pdf_load_elapsed,
                split_elapsed,
                time.perf_counter() - embed_started,
                time.perf_counter() - file_started,
            )
        except Exception:
            failed_files += 1
            LOGGER.exception("[%d/%d] Failed to process PDF %s", index, len(pdf_files), pdf_path)

    load_elapsed = time.perf_counter() - load_started
    LOGGER.info(
        "PDF loading finished successful=%d failed=%d duplicates=%d empty=%d pages=%d chunks_created=%d chunks_inserted=%d chunks_skipped_existing=%d chunk_failures=%d elapsed=%.2fs",
        successful_files,
        failed_files,
        duplicate_files,
        empty_files,
        total_pages,
        total_chunks_created,
        total_chunks_inserted,
        total_chunks_skipped_existing,
        total_chunk_failures,
        load_elapsed,
    )

    if total_chunks_created == 0:
        LOGGER.error("No chunks were created. Nothing will be written to Chroma.")
        return 1

    persist_started = time.perf_counter()
    persist_callable = getattr(vector_store, "persist", None)
    if callable(persist_callable):
        persist_callable()
    persist_elapsed = time.perf_counter() - persist_started

    persisted_files = [path for path in persist_dir.rglob("*") if path.is_file()]
    if not persisted_files:
        LOGGER.warning("Chroma persist directory exists but contains no files: %s", persist_dir)

    LOGGER.info("Embedding total_elapsed=%.2fs provider=%s", embedding_elapsed_total, args.embedding_provider)
    LOGGER.info("Chroma persistence elapsed=%.2fs files=%d", persist_elapsed, len(persisted_files))
    LOGGER.info("Vector database path: %s", persist_dir)
    LOGGER.info(
        "Ingestion summary candidate=%d successful=%d failed=%d duplicates=%d empty=%d pages=%d chunks_created=%d chunks_inserted=%d chunks_skipped_existing=%d chunk_failures=%d",
        len(pdf_files),
        successful_files,
        failed_files,
        duplicate_files,
        empty_files,
        total_pages,
        total_chunks_created,
        total_chunks_inserted,
        total_chunks_skipped_existing,
        total_chunk_failures,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(ingest())
    except KeyboardInterrupt:
        LOGGER.error("Ingestion interrupted by user.")
        raise SystemExit(130)
