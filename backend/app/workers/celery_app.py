
from __future__ import annotations

import os
from celery import Celery

os.environ.setdefault("PYTHONPATH", ".")

from app.core.config import get_settings
settings = get_settings()

celery_app = Celery(
    "semenq_workers",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/1",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/2",
    include=["app.workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_concurrency=4,
)

celery_app.conf.beat_schedule = {
    "expire-reservations-every-minute": {
        "task": "app.workers.tasks.expire_reservations",
        "schedule": 60.0,
    },
    "process-low-stock-alerts-hourly": {
        "task": "app.workers.tasks.check_low_stock",
        "schedule": 3600.0,
    }
}
