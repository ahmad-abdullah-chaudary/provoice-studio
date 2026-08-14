import time
from typing import Dict, Any, Optional, List

# In-memory job store (survives for session lifetime)
_jobs: Dict[str, Dict[str, Any]] = {}


def create_job(text: str, voice: str, job_type: str = "generate") -> str:
    job_id = f"job_{int(time.time() * 1000)}"
    _jobs[job_id] = {
        "id": job_id,
        "type": job_type,          # "generate" | "batch"
        "status": "processing",    # processing | complete | failed
        "progress": 0,
        "total_chunks": 0,
        "current_chunk_text": "",
        "audio_url": None,
        "duration": None,
        "render_time": None,
        "file_size": None,
        "sample_rate": None,
        "error": None,
        "created_at": time.time(),
        "voice": voice,
        "text_preview": text[:80] + "..." if len(text) > 80 else text,
    }
    return job_id


def update_job(job_id: str, **kwargs):
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


def get_job(job_id: str) -> Optional[Dict]:
    return _jobs.get(job_id)


def list_jobs() -> List[Dict]:
    return list(_jobs.values())


def delete_old_jobs(max_age_seconds: int = 3600):
    """Remove completed jobs older than max_age_seconds."""
    now = time.time()
    stale = [jid for jid, j in _jobs.items()
             if j["status"] in ("complete", "failed")
             and (now - j["created_at"]) > max_age_seconds]
    for jid in stale:
        del _jobs[jid]
