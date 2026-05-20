# Knowledge Storage

This directory is the Cloud Run backend knowledge placeholder.

## Purpose

- documents can be staged into Google Cloud Storage under `GCS_KNOWLEDGE_PREFIX`
- local bootstrap docs can optionally be mounted through `PUBLIC_KNOWLEDGE_BOOTSTRAP_DIR`
- production persistence should come from GCS, not the container filesystem

## Recommended Layout in GCS

- `yenkasa-ai/knowledge/public/`
- `yenkasa-ai/knowledge/engineering/`

## Notes

Cloud Run instances are stateless. Do not treat this directory as long-term storage.
