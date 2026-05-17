from app.celery_app import celery_app
import time
import redis
import json
import os

redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))

@celery_app.task(bind=True)
def mock_sd_generate(self, job_id: str, prompt: str):
    total_steps = 20
    for step in range(1, total_steps + 1):
        time.sleep(0.5) # Simulate processing 0.5s per step (total 10s)
        msg = {
            "type": "progress",
            "job_id": job_id,
            "step": step,
            "total_steps": total_steps
        }
        redis_client.publish(f"channel:{job_id}", json.dumps(msg))
    
    # Simulate done with a random pic
    dummy_image_url = f"https://picsum.photos/seed/{job_id}/512/512"
    msg = {
        "type": "done",
        "job_id": job_id,
        "image_url": dummy_image_url
    }
    redis_client.publish(f"channel:{job_id}", json.dumps(msg))
    
    return {"job_id": job_id, "status": "completed", "image_url": dummy_image_url}
