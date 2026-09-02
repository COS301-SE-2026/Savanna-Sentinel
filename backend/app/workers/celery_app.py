from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "savanna_sentinel",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.autodiscover_tasks(["app.workers"])

celery_app.conf.beat_schedule = {
    "score-heatmap-every-6-hours": {
        "task": "risk.score_heatmap",
        "schedule": crontab(hour="0,6,12,18", minute=0),
        "args": (settings.PARK_ID,),
    },
}

# Single source for Celery state
CELERY_STATUS_MAP = {
    "PENDING": "queued",
    "RECEIVED": "queued",
    "STARTED": "processing",
    "RETRY": "processing",
    "SUCCESS": "completed",
    "FAILURE": "failed",
}
