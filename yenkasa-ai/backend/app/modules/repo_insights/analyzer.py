from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from app.models import RepoInsightDocument


def analyze_repository_chunks(repo_name: str, chunks: list[dict], large_file_threshold_lines: int) -> list[RepoInsightDocument]:
    per_file: dict[str, dict] = {}
    symbol_locations: dict[str, set[str]] = defaultdict(set)

    for chunk in chunks:
        file_path = chunk["file_path"]
        metrics = per_file.setdefault(
            file_path,
            {
                "repo_name": repo_name,
                "language": chunk["language"],
                "line_count": 0,
                "chunk_count": 0,
                "todo_count": 0,
                "complexity_score": 0.0,
                "file_size_bytes": int(chunk.get("file_size_bytes", 0)),
                "symbols": set(),
                "content_samples": [],
            },
        )
        metrics["line_count"] = max(metrics["line_count"], int(chunk.get("end_line", 0)))
        metrics["chunk_count"] += 1
        metrics["todo_count"] += int(chunk.get("todo_count", 0))
        metrics["complexity_score"] += float(chunk.get("complexity_score", 0.0))
        metrics["symbols"].update(chunk.get("symbol_names", []) or [])
        if len(metrics["content_samples"]) < 2:
            metrics["content_samples"].append(str(chunk.get("content", ""))[:800])

    for file_path, metrics in per_file.items():
        for symbol in metrics["symbols"]:
            symbol_locations[symbol].add(file_path)

    insights: list[RepoInsightDocument] = []
    now = datetime.utcnow()

    for file_path, metrics in per_file.items():
        avg_complexity = metrics["complexity_score"] / max(metrics["chunk_count"], 1)
        content_joined = "\n".join(metrics["content_samples"]).lower()

        if metrics["line_count"] >= large_file_threshold_lines:
            insights.append(
                RepoInsightDocument(
                    repo_name=repo_name,
                    insight_type="oversized_file",
                    severity="high",
                    title=f"{file_path} exceeds the maintainability threshold",
                    description=(
                        f"{file_path} spans roughly {metrics['line_count']} lines and should be decomposed into "
                        "smaller units before more logic accumulates."
                    ),
                    file_path=file_path,
                    metadata={"line_count": metrics["line_count"], "language": metrics["language"]},
                    created_at=now,
                )
            )

        if metrics["todo_count"] >= 3:
            insights.append(
                RepoInsightDocument(
                    repo_name=repo_name,
                    insight_type="technical_debt",
                    severity="medium",
                    title=f"{file_path} carries multiple unresolved debt markers",
                    description=(
                        f"{file_path} contains at least {metrics['todo_count']} TODO/FIXME/HACK markers, which usually "
                        "signals deferred cleanup in an already active code path."
                    ),
                    file_path=file_path,
                    metadata={"todo_count": metrics["todo_count"]},
                    created_at=now,
                )
            )

        if avg_complexity >= 8 or metrics["chunk_count"] >= 18:
            insights.append(
                RepoInsightDocument(
                    repo_name=repo_name,
                    insight_type="complexity",
                    severity="medium",
                    title=f"{file_path} shows elevated implementation complexity",
                    description=(
                        f"{file_path} has {metrics['chunk_count']} indexed chunks with an average complexity score "
                        f"of {avg_complexity:.1f}. This is a candidate for simplification or module extraction."
                    ),
                    file_path=file_path,
                    metadata={"chunk_count": metrics["chunk_count"], "avg_complexity": round(avg_complexity, 2)},
                    created_at=now,
                )
            )

        if any(term in file_path.lower() for term in ("fragment", "controller", "manager", "service")) and (
            metrics["line_count"] >= large_file_threshold_lines // 2 or avg_complexity >= 6
        ):
            insights.append(
                RepoInsightDocument(
                    repo_name=repo_name,
                    insight_type="architecture_concern",
                    severity="high",
                    title=f"{file_path} appears to aggregate too many responsibilities",
                    description=(
                        f"{file_path} mixes the responsibilities of a high-traffic orchestration component with "
                        "large implementation volume. Split orchestration from IO and domain logic."
                    ),
                    file_path=file_path,
                    metadata={"line_count": metrics["line_count"], "avg_complexity": round(avg_complexity, 2)},
                    created_at=now,
                )
            )

        if any(keyword in content_joined for keyword in ("thread.sleep", "time.sleep", "requests.", "subprocess", "os.system")):
            insights.append(
                RepoInsightDocument(
                    repo_name=repo_name,
                    insight_type="scaling_bottleneck",
                    severity="high",
                    title=f"{file_path} contains blocking or risky operational patterns",
                    description=(
                        "Blocking calls or shell-oriented execution paths were detected in a repository chunk. "
                        "These patterns deserve isolation before production automation expands."
                    ),
                    file_path=file_path,
                    metadata={},
                    created_at=now,
                )
            )

    for symbol, files in sorted(symbol_locations.items()):
        if len(files) < 2 or symbol.lower() in {"main", "test", "init"}:
            continue
        sorted_files = sorted(files)
        insights.append(
            RepoInsightDocument(
                repo_name=repo_name,
                insight_type="duplicated_responsibility",
                severity="medium",
                title=f"Symbol '{symbol}' appears across multiple files",
                description=(
                    f"The symbol '{symbol}' appears across {len(sorted_files)} files. Confirm whether this is deliberate "
                    "reuse or duplicated business responsibility."
                ),
                file_path=sorted_files[0],
                metadata={"files": sorted_files[:8], "symbol": symbol},
                created_at=now,
            )
        )
        if len(insights) >= 50:
            break

    return insights[:100]
