from __future__ import annotations

from pathlib import Path


SUPPORTED_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".java": "java",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".md": "markdown",
}

IGNORED_DIRECTORIES = {
    ".git",
    ".gradle",
    ".idea",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "binaries",
    "build",
    "caches",
    "dist",
    "images",
    "node_modules",
    "videos",
}

BINARY_EXTENSIONS = {
    ".7z",
    ".bin",
    ".class",
    ".dll",
    ".dylib",
    ".exe",
    ".gif",
    ".gz",
    ".ico",
    ".jar",
    ".jpeg",
    ".jpg",
    ".mov",
    ".mp3",
    ".mp4",
    ".pdf",
    ".png",
    ".so",
    ".tar",
    ".wav",
    ".webm",
    ".zip",
}


def detect_language(path: Path) -> str | None:
    return SUPPORTED_EXTENSIONS.get(path.suffix.lower())


def is_supported_path(path: Path) -> bool:
    return detect_language(path) is not None


def is_binary_file(path: Path) -> bool:
    if path.suffix.lower() in BINARY_EXTENSIONS:
        return True

    try:
        with path.open("rb") as handle:
            return b"\0" in handle.read(2048)
    except OSError:
        return True
