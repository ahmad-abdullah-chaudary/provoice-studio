import time
import os
from typing import List, Dict, Any, Optional

class BatchQueueManager:
    """Async Job Queue Manager for batch rendering audio scripts."""

    def __init__(self):
        self.jobs: List[Dict[str, Any]] = []
        self.is_processing = False
        self.is_paused = False

    def add_job(self, title: str, text: str, voice: str = "af_bella", settings: Dict[str, Any] = None) -> Dict[str, Any]:
        job = {
            "id": f"job_{int(time.time() * 1000)}_{len(self.jobs) + 1}",
            "title": title,
            "text": text,
            "voice": voice,
            "settings": settings or {},
            "status": "waiting",  # waiting, rendering, completed, paused, failed
            "progress": 0,
            "created_at": time.time(),
            "duration": 0.0,
            "output_file": None,
            "error": None
        }
        self.jobs.append(job)
        return job

    def get_queue(self) -> List[Dict[str, Any]]:
        return self.jobs

    def pause_queue(self):
        self.is_paused = True

    def clear_all(self):
        count = len(self.jobs)
        self.jobs = []
        return count

    def cancel_job(self, job_id: str) -> bool:
        original_len = len(self.jobs)
        self.jobs = [j for j in self.jobs if j["id"] != job_id]
        return len(self.jobs) < original_len

    def delete_jobs(self, job_ids: List[str]) -> int:
        if not job_ids:
            return self.clear_all()
        target_set = set(job_ids)
        original_len = len(self.jobs)
        self.jobs = [j for j in self.jobs if j["id"] not in target_set]
        return original_len - len(self.jobs)

batch_queue = BatchQueueManager()
