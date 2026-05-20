# Embeddings Notes

This backend currently uses HuggingFace sentence-transformer embeddings for retrieval compatibility with the existing Yenkasa Chroma corpus.

## Current State

- retrieval embeddings: `sentence-transformers/all-MiniLM-L6-v2`
- generation: Vertex AI Gemini

## Cloud Strategy

- store the Chroma snapshot in Google Cloud Storage
- hydrate the local `/tmp` Chroma copy on startup
- upload the updated Chroma snapshot back to GCS after ingestion

## Future Upgrade Path

When Yenkasa moves retrieval to Gemini embeddings, rebuild the collection into a new Chroma snapshot rather than mixing embedding spaces.
