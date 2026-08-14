import asyncio
import time
import os
import logging
import numpy as np
import uvicorn
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging so timeline mixer info is visible in uvicorn console
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:     [%(name)s] %(message)s",
)

from backend.api.routes import router as api_router
from backend.engine.batch import batch_queue
from backend.engine.tts import tts_engine
from backend.engine.dsp import dsp_pipeline
from backend.engine.dictionary import dictionary_engine
from backend.engine.export import audio_exporter
from backend.engine.storage import storage_manager, TEMP_DIR

_batch_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="batch_processor")


def _process_batch_job_blocking(job: dict):
    """Synchronous batch job processor — runs in thread pool."""
    try:
        text = job.get("text", "")
        voice = job.get("voice", "af_bella")
        settings = job.get("settings") or {}
        dsp_settings = settings.get("dsp", {
            "silence_trim": True, "limiter": True, "normalize": True, "fade": True
        })
        speed = float(settings.get("speed", 1.0))
        lang = settings.get("lang", "en-us")
        sentence_gap = int(settings.get("sentence_gap_ms", 200))
        paragraph_gap = int(settings.get("paragraph_gap_ms", 400))

        chunks = tts_engine.chunk_text(text)
        total = len(chunks)
        job["total_chunks"] = total

        def on_progress(done, tot, chunk_text):
            job["progress"] = done
            job["current_chunk_text"] = chunk_text[:60]

        processed_text = dictionary_engine.apply_rules(text)
        raw_audio, sample_rate, render_time = tts_engine.generate_with_progress(
            processed_text, voice=voice, speed=speed, lang=lang,
            sentence_gap_ms=sentence_gap, paragraph_gap_ms=paragraph_gap,
            progress_callback=on_progress,
        )

        if raw_audio.size == 0:
            job["status"] = "failed"
            job["error"] = "No audio produced"
            return

        final_audio = dsp_pipeline.process(raw_audio, sample_rate, dsp_settings)
        audio_id = f"batch_{job['id']}_{int(time.time()*1000)}"
        wav_path = os.path.join(TEMP_DIR, f"{audio_id}.wav")
        audio_exporter.save_wav(final_audio, sample_rate, wav_path)

        duration = round(len(final_audio) / float(sample_rate), 2)
        job["status"] = "completed"
        job["progress"] = total
        job["output_file"] = wav_path
        job["audio_url"] = f"/api/audio/{audio_id}.wav"
        job["duration"] = duration
        job["render_time"] = round(render_time, 2)

        storage_manager.save_history_item({
            "id": audio_id,
            "timestamp": time.time(),
            "text": text[:100],
            "voice": voice,
            "duration": duration,
            "render_time": round(render_time, 2),
            "file_size": os.path.getsize(wav_path),
            "sample_rate": sample_rate,
            "file_path": wav_path,
            "audio_url": f"/api/audio/{audio_id}.wav",
        })

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)


async def batch_queue_worker():
    """Asyncio background worker — processes waiting batch jobs one at a time."""
    print("[BatchWorker] Queue worker started.")
    loop = asyncio.get_running_loop()
    while True:
        try:
            if not batch_queue.is_paused:
                waiting = [j for j in batch_queue.get_queue() if j["status"] == "waiting"]
                if waiting:
                    job = waiting[0]
                    job["status"] = "rendering"
                    print(f"[BatchWorker] Processing: {job['title']}")
                    await loop.run_in_executor(_batch_executor, _process_batch_job_blocking, job)
                    print(f"[BatchWorker] Done: {job['title']} → {job['status']}")
        except Exception as e:
            print(f"[BatchWorker] Error: {e}")
        await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import socket
    # Detect LAN IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        lan_ip = "127.0.0.1"

    print("=" * 50)
    print("  ProVoice Studio Engine — Online ")
    print("=" * 50)
    print(f"  Local:    http://127.0.0.1:8000")
    print(f"  Network:  http://{lan_ip}:8000")
    print("=" * 50)
    task = asyncio.create_task(batch_queue_worker())
    yield
    task.cancel()
    print("[Engine] Shutdown complete.")


app = FastAPI(
    title="ProVoice Studio Engine API",
    description="Offline CPU-optimized TTS & Audio Processing Server",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
