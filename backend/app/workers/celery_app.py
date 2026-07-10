from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "savanna_sentinel",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.autodiscover_tasks(["app.workers.tasks"])
