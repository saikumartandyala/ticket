from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "lastminutepass",
    broker=settings.REDIS_URL or "redis://redis:6379/0",
    backend=settings.REDIS_URL or "redis://redis:6379/0",
    include=["app.workers.match_worker", "app.workers.expiry_worker"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "expire-listings": {
        "task": "app.workers.expiry_worker.expire_old_listings",
        "schedule": 1800.0,  # every 30 minutes
    },
    "expiry-warnings": {
        "task": "app.workers.expiry_worker.send_expiry_warnings",
        "schedule": 3600.0,  # every hour
    },
}
