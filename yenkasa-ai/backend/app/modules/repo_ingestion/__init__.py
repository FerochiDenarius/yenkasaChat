__all__ = [
    "ChunkedSegment",
    "RepoIngestionService",
    "RepositoryFile",
    "RepositoryScanner",
    "chunk_file_content",
]


def __getattr__(name: str):
    if name in {"ChunkedSegment", "chunk_file_content"}:
        from app.modules.repo_ingestion.chunker import ChunkedSegment
        from app.modules.repo_ingestion.chunker import chunk_file_content

        return {"ChunkedSegment": ChunkedSegment, "chunk_file_content": chunk_file_content}[name]
    if name in {"RepositoryFile", "RepositoryScanner"}:
        from app.modules.repo_ingestion.scanner import RepositoryFile
        from app.modules.repo_ingestion.scanner import RepositoryScanner

        return {"RepositoryFile": RepositoryFile, "RepositoryScanner": RepositoryScanner}[name]
    if name == "RepoIngestionService":
        from app.modules.repo_ingestion.service import RepoIngestionService

        return RepoIngestionService
    raise AttributeError(name)
