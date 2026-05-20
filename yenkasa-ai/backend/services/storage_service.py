from __future__ import annotations

import logging
from pathlib import Path


LOGGER = logging.getLogger("yenkasa_ai_cloud.storage")


class GCSStorageService:
    def __init__(self, project_id: str, bucket_name: str, chroma_prefix: str, knowledge_prefix: str) -> None:
        self.project_id = project_id
        self.bucket_name = bucket_name
        self.chroma_prefix = chroma_prefix.strip("/")
        self.knowledge_prefix = knowledge_prefix.strip("/")
        self._client = None

    @property
    def configured(self) -> bool:
        return bool(self.bucket_name)

    def _get_client(self):
        if not self.configured:
            return None
        if self._client is None:
            from google.cloud import storage

            self._client = storage.Client(project=self.project_id)
        return self._client

    def download_directory(self, prefix: str, target_dir: Path) -> int:
        if not self.configured:
            LOGGER.info("GCS storage not configured; skipping download for prefix=%s", prefix)
            return 0

        bucket = self._get_client().bucket(self.bucket_name)
        target_dir.mkdir(parents=True, exist_ok=True)
        downloaded = 0
        prefix = prefix.strip("/")

        for blob in bucket.list_blobs(prefix=prefix):
            relative_name = blob.name[len(prefix) :].lstrip("/")
            if not relative_name:
                continue
            destination = target_dir / relative_name
            destination.parent.mkdir(parents=True, exist_ok=True)
            blob.download_to_filename(destination)
            downloaded += 1

        LOGGER.info("Downloaded %d files from gs://%s/%s", downloaded, self.bucket_name, prefix)
        return downloaded

    def upload_directory(self, local_dir: Path, prefix: str) -> int:
        if not self.configured:
            LOGGER.info("GCS storage not configured; skipping upload for prefix=%s", prefix)
            return 0

        bucket = self._get_client().bucket(self.bucket_name)
        uploaded = 0
        prefix = prefix.strip("/")
        for path in local_dir.rglob("*"):
            if not path.is_file():
                continue
            blob_name = f"{prefix}/{path.relative_to(local_dir).as_posix()}"
            bucket.blob(blob_name).upload_from_filename(path)
            uploaded += 1

        LOGGER.info("Uploaded %d files to gs://%s/%s", uploaded, self.bucket_name, prefix)
        return uploaded

    def upload_file(self, local_path: Path, blob_name: str) -> bool:
        if not self.configured:
            return False
        bucket = self._get_client().bucket(self.bucket_name)
        bucket.blob(blob_name).upload_from_filename(local_path)
        return True
