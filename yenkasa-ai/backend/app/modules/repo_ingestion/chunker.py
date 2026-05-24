from __future__ import annotations

import re
from dataclasses import dataclass


SYMBOL_PATTERNS = [
    re.compile(r"^\s*(?:async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE),
    re.compile(r"^\s*(?:function|class|interface|type)\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE),
    re.compile(r"^\s*(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=", re.MULTILINE),
    re.compile(r"^\s*(?:fun|class|object)\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE),
]

COMPLEXITY_TOKENS = (" if ", " elif ", " else:", " for ", " while ", " case ", " switch ", " catch ", " except ")


@dataclass(slots=True)
class ChunkedSegment:
    chunk_index: int
    total_chunks: int
    content: str
    start_line: int
    end_line: int
    symbol_names: list[str]
    todo_count: int
    complexity_score: float


def chunk_file_content(content: str, language: str, max_lines: int, overlap_lines: int) -> list[ChunkedSegment]:
    if language == "markdown":
        markdown_chunks = _chunk_markdown(content, max_lines=max_lines)
        if markdown_chunks:
            return markdown_chunks

    lines = content.splitlines()
    if not lines:
        return []

    chunks: list[ChunkedSegment] = []
    step = max(1, max_lines - overlap_lines)
    for start in range(0, len(lines), step):
        window = lines[start : start + max_lines]
        if not window:
            continue
        chunk_text = "\n".join(window).strip()
        if not chunk_text:
            continue
        chunks.append(
            ChunkedSegment(
                chunk_index=len(chunks),
                total_chunks=0,
                content=chunk_text,
                start_line=start + 1,
                end_line=min(start + len(window), len(lines)),
                symbol_names=_extract_symbols(chunk_text),
                todo_count=_count_todos(chunk_text),
                complexity_score=_estimate_complexity(chunk_text),
            )
        )
        if start + max_lines >= len(lines):
            break

    total = len(chunks)
    return [
        ChunkedSegment(
            chunk_index=chunk.chunk_index,
            total_chunks=total,
            content=chunk.content,
            start_line=chunk.start_line,
            end_line=chunk.end_line,
            symbol_names=chunk.symbol_names,
            todo_count=chunk.todo_count,
            complexity_score=chunk.complexity_score,
        )
        for chunk in chunks
    ]


def _chunk_markdown(content: str, max_lines: int) -> list[ChunkedSegment]:
    lines = content.splitlines()
    if not lines or "#" not in content:
        return []

    chunks: list[ChunkedSegment] = []
    buffer: list[str] = []
    start_line = 1
    for idx, line in enumerate(lines, start=1):
        if line.startswith("#") and buffer:
            chunk_text = "\n".join(buffer).strip()
            if chunk_text:
                chunks.append(
                    ChunkedSegment(
                        chunk_index=len(chunks),
                        total_chunks=0,
                        content=chunk_text,
                        start_line=start_line,
                        end_line=idx - 1,
                        symbol_names=_extract_symbols(chunk_text),
                        todo_count=_count_todos(chunk_text),
                        complexity_score=_estimate_complexity(chunk_text),
                    )
                )
            buffer = [line]
            start_line = idx
            continue

        buffer.append(line)
        if len(buffer) >= max_lines:
            chunk_text = "\n".join(buffer).strip()
            if chunk_text:
                chunks.append(
                    ChunkedSegment(
                        chunk_index=len(chunks),
                        total_chunks=0,
                        content=chunk_text,
                        start_line=start_line,
                        end_line=idx,
                        symbol_names=_extract_symbols(chunk_text),
                        todo_count=_count_todos(chunk_text),
                        complexity_score=_estimate_complexity(chunk_text),
                    )
                )
            buffer = []
            start_line = idx + 1

    if buffer:
        chunk_text = "\n".join(buffer).strip()
        if chunk_text:
            chunks.append(
                ChunkedSegment(
                    chunk_index=len(chunks),
                    total_chunks=0,
                    content=chunk_text,
                    start_line=start_line,
                    end_line=len(lines),
                    symbol_names=_extract_symbols(chunk_text),
                    todo_count=_count_todos(chunk_text),
                    complexity_score=_estimate_complexity(chunk_text),
                )
            )

    total = len(chunks)
    return [
        ChunkedSegment(
            chunk_index=chunk.chunk_index,
            total_chunks=total,
            content=chunk.content,
            start_line=chunk.start_line,
            end_line=chunk.end_line,
            symbol_names=chunk.symbol_names,
            todo_count=chunk.todo_count,
            complexity_score=chunk.complexity_score,
        )
        for chunk in chunks
    ]


def _extract_symbols(content: str) -> list[str]:
    names: set[str] = set()
    for pattern in SYMBOL_PATTERNS:
        names.update(pattern.findall(content))
    return sorted(name for name in names if len(name) > 2)[:25]


def _count_todos(content: str) -> int:
    lowered = content.lower()
    return lowered.count("todo") + lowered.count("fixme") + lowered.count("hack")


def _estimate_complexity(content: str) -> float:
    lowered = f" {content.lower()} "
    return float(sum(lowered.count(token.strip()) for token in COMPLEXITY_TOKENS))
