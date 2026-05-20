from __future__ import annotations

import hashlib
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_text_splitters import RecursiveCharacterTextSplitter


def build_section_path(metadata: dict) -> str:
    parts = [metadata.get("h1"), metadata.get("h2"), metadata.get("h3")]
    return " > ".join(part.strip() for part in parts if isinstance(part, str) and part.strip())


def infer_category(source_path: Path, root: Path) -> str:
    try:
        relative = source_path.relative_to(root)
        if len(relative.parts) > 1:
            return relative.parts[0]
    except ValueError:
        pass
    return source_path.stem.split("_", 1)[0].replace("-", "_").lower() or "uncategorized"


def chunk_documents(documents: list[Document], chunk_size: int = 950, chunk_overlap: int = 140) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n### ", "\n## ", "\n- ", "\n", " "],
    )
    return splitter.split_documents(documents)


def load_markdown_documents(markdown_path: Path, root: Path, audience: str) -> list[Document]:
    raw_text = markdown_path.read_text(encoding="utf-8").strip()
    if not raw_text:
        return []

    file_hash = hashlib.sha256(raw_text.encode("utf-8", errors="ignore")).hexdigest()
    category = infer_category(markdown_path, root)
    relative_path = str(markdown_path.relative_to(root))

    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")],
        strip_headers=False,
    )
    header_docs = header_splitter.split_text(raw_text) or [Document(page_content=raw_text, metadata={})]

    normalized: list[Document] = []
    for document in header_docs:
        content = (document.page_content or "").strip()
        if not content:
            continue
        metadata = dict(document.metadata or {})
        metadata.update(
            {
                "source_path": str(markdown_path.resolve()),
                "source_relative_path": relative_path,
                "source_file": markdown_path.name,
                "file_sha256": file_hash,
                "category": category,
                "audience": audience,
                "section_path": build_section_path(metadata) or markdown_path.stem.replace("_", " "),
            }
        )
        normalized.append(Document(page_content=content, metadata=metadata))

    chunks = chunk_documents(normalized)
    prepared: list[Document] = []
    for chunk_index, chunk in enumerate(chunks, start=1):
        content = (chunk.page_content or "").strip()
        if not content:
            continue
        metadata = dict(chunk.metadata or {})
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


def load_pdf_documents(pdf_path: Path, root: Path, audience: str) -> list[Document]:
    loader = PyPDFLoader(str(pdf_path))
    raw_documents = loader.load()
    category = infer_category(pdf_path, root)
    relative_path = str(pdf_path.relative_to(root))
    prepared: list[Document] = []
    for page_index, document in enumerate(raw_documents, start=1):
        content = (document.page_content or "").strip()
        if not content:
            continue
        metadata = dict(document.metadata or {})
        metadata.update(
            {
                "source_path": str(pdf_path.resolve()),
                "source_relative_path": relative_path,
                "source_file": pdf_path.name,
                "category": category,
                "audience": audience,
                "page_number": metadata.get("page", page_index - 1) + 1,
                "section_path": f"Page {metadata.get('page', page_index - 1) + 1}",
            }
        )
        prepared.append(Document(page_content=content, metadata=metadata))

    chunks = chunk_documents(prepared, chunk_size=1000, chunk_overlap=180)
    for chunk_index, chunk in enumerate(chunks, start=1):
        content = (chunk.page_content or "").strip()
        metadata = dict(chunk.metadata or {})
        raw_chunk_id = (
            f"{metadata.get('source_relative_path', '')}:{metadata.get('page_number', '')}:{chunk_index}:"
            f"{hashlib.sha256(content.encode('utf-8', errors='ignore')).hexdigest()}"
        )
        metadata["chunk_id"] = hashlib.sha256(raw_chunk_id.encode("utf-8")).hexdigest()
        chunk.metadata = metadata
    return chunks
