from __future__ import annotations

from redis import Redis
from rq import Connection
from rq import Worker

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL must be configured before starting the RQ worker.")

    connection = Redis.from_url(settings.redis_url)
    with Connection(connection):
        worker = Worker([settings.repo_ingestion_queue_name])
        worker.work()


if __name__ == "__main__":
    main()
