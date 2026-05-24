from __future__ import annotations


def build_vector_index_definition(settings) -> dict:
    return {
        "fields": [
            {
                "type": "vector",
                "path": "embedding",
                "numDimensions": settings.mongodb_vector_dimensions,
                "similarity": "cosine",
            },
            {"type": "filter", "path": "repo_name"},
            {"type": "filter", "path": "language"},
            {"type": "filter", "path": "file_path"},
        ]
    }
