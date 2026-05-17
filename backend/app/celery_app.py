from celery import Celery
import os

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "ai_image_editor",
    broker=redis_url,
    backend=redis_url,
    include=["app.workers.sd_worker"]
)

celery_app.conf.task_routes = {
    'app.workers.sd_worker.mock_sd_generate': {'queue': 'sd_queue'},
}
