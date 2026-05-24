from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from app.utils.hashing import sha256_file
from app.utils.language import IGNORED_DIRECTORIES
from app.utils.language import detect_language
from app.utils.language import is_binary_file
from app.utils.language import is_supported_path


@dataclass(slots=True)
class RepositoryFile:
    repo_name: str
    repo_path: Path
    relative_path: str
    language: str
    content: str
    last_modified: datetime
    file_hash: str
    file_size_bytes: int


class RepositoryScanner:
    def __init__(self, settings) -> None:
        self.settings = settings

    def scan(self, repo_path: Path, repo_name: str) -> list[RepositoryFile]:
        files: list[RepositoryFile] = []
        for path in sorted(repo_path.rglob("*")):
            if not path.is_file():
                continue
            if any(part in IGNORED_DIRECTORIES for part in path.parts):
                continue
            if path.stat().st_size > self.settings.repo_file_size_limit_bytes:
                continue
            if not is_supported_path(path) or is_binary_file(path):
                continue

            language = detect_language(path)
            if language is None:
                continue

            relative_path = str(path.relative_to(repo_path))
            content = path.read_text(encoding="utf-8", errors="ignore")
            if not content.strip():
                continue
            stat = path.stat()
            files.append(
                RepositoryFile(
                    repo_name=repo_name,
                    repo_path=repo_path,
                    relative_path=relative_path,
                    language=language,
                    content=content,
                    last_modified=datetime.utcfromtimestamp(stat.st_mtime),
                    file_hash=sha256_file(path),
                    file_size_bytes=stat.st_size,
                )
            )
        return files
