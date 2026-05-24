from __future__ import annotations

import re
from pathlib import Path


def ensure_within_roots(candidate: str | Path, allowed_roots: list[Path]) -> Path:
    resolved = Path(candidate).expanduser().resolve(strict=True)
    for root in allowed_roots:
        root_resolved = root.expanduser().resolve()
        if resolved == root_resolved or root_resolved in resolved.parents:
            return resolved
    raise ValueError(f"Repository path '{resolved}' is outside the configured read-only sandbox.")


def build_repo_name(repo_name: str | None, repo_path: Path) -> str:
    raw_name = repo_name or repo_path.name
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", raw_name).strip("-")
    if not slug:
        raise ValueError("Repository name resolved to an empty slug.")
    return slug[:120]
