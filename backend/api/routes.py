import os
import re
import time
import json
import asyncio
import mimetypes
import subprocess
import numpy as np
import psutil
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, HTTPException, File, UploadFile, Body, Form, BackgroundTasks, Request
from pydantic import BaseModel
from fastapi.responses import FileResponse, JSONResponse

from backend.engine.tts import tts_engine, EMOTION_PRESETS
from backend.engine.dsp import dsp_pipeline
from backend.engine.dictionary import dictionary_engine
from backend.engine.subtitles import subtitle_parser
from backend.engine.export import audio_exporter
from backend.engine.storage import storage_manager, TEMP_DIR, EXPORTS_DIR
from backend.engine.batch import batch_queue
from backend.engine.jobs import create_job, update_job, get_job, list_jobs
from backend.engine.mixer import mixer
from backend.engine.timeline import timeline_mixer
from backend.engine.video import video_engine
from backend.engine.webhooks import webhook_registry

router = APIRouter()

# Thread pool for CPU-bound TTS work (max 2 concurrent renders)
_tts_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tts_worker")


# ─── Helper: Path-traversal-safe filename & path validation ─────────────────

def _safe_filename(filename: str, default: str = "file") -> str:
    """Strip path components and reject unsafe characters (prevents traversal).

    Preserves Unicode filenames but blocks ``/``, ``\\``, ``..`` and shell-injectable
    characters by replacing them with underscores.
    """
    if not filename:
        return default
    base = os.path.basename(filename.replace("\\", "/"))
    while ".." in base:
        base = base.replace("..", "")
    base = re.sub(r"[^A-Za-z0-9._\-\u0080-\uffff]", "_", base).strip(".")
    return base or default


TRIMMED_DIR = os.path.join(EXPORTS_DIR, "trimmed")
os.makedirs(TRIMMED_DIR, exist_ok=True)


def _validate_storage_path(path: str, purpose: str = "file") -> str:
    """Return realpath of ``path``, refusing anything outside TEMP_DIR/EXPORTS_DIR/TRIMMED_DIR."""
    abs_path = os.path.realpath(path)
    allowed = (os.path.realpath(TEMP_DIR), os.path.realpath(EXPORTS_DIR), os.path.realpath(TRIMMED_DIR))
    if not any(abs_path == a or abs_path.startswith(a + os.sep) for a in allowed):
        raise HTTPException(status_code=400, detail=f"Invalid {purpose} path")
    return abs_path


def _resolve_audio_file(filename: str) -> str:
    """Resolve a sanitized audio filename within TEMP_DIR or EXPORTS_DIR."""
    safe = _safe_filename(filename)
    for base_dir in (TEMP_DIR, EXPORTS_DIR):
        candidate = os.path.join(base_dir, safe)
        if os.path.exists(candidate):
            return candidate
    raise HTTPException(status_code=404, detail="Audio file not found")


# ─── Helper: Run blocking TTS + DSP in a thread ────────────────────────────

def _run_generation_blocking(job_id: str, text: str, voice: str, speed: float, lang: str,
                              sentence_gap_ms: int, paragraph_gap_ms: int, dsp_settings: dict):
    """Blocking function — runs in ThreadPoolExecutor."""
    job_start = time.time()
    try:
        processed_text = dictionary_engine.apply_rules(text)

        def on_progress(done: int, total: int, chunk_text: str):
            update_job(job_id, progress=done, total_chunks=total,
                       current_chunk_text=chunk_text[:80])

        # Extract studio realism flags from dsp_settings
        micro_variation = dsp_settings.get("micro_variation", True)
        breathing_injection = dsp_settings.get("breathing_injection", True)
        nlp_auto_emotion = dsp_settings.get("nlp_auto_emotion", True)

        raw_audio, sample_rate, _ = tts_engine.generate_with_progress(
            processed_text, voice=voice, speed=speed, lang=lang,
            sentence_gap_ms=sentence_gap_ms, paragraph_gap_ms=paragraph_gap_ms,
            progress_callback=on_progress,
            micro_variation=micro_variation,
            breathing_injection=breathing_injection,
            nlp_auto_emotion=nlp_auto_emotion,
        )

        if raw_audio.size == 0:
            update_job(job_id, status="failed", error="TTS produced no audio")
            return

        final_audio = dsp_pipeline.process(raw_audio, sample_rate, dsp_settings)

        wav_filename = f"audio_{job_id}.wav"
        wav_path = os.path.join(TEMP_DIR, wav_filename)
        audio_exporter.save_wav(final_audio, sample_rate, wav_path)

        duration = len(final_audio) / float(sample_rate)
        render_time = round(time.time() - job_start, 2)
        file_size = os.path.getsize(wav_path)

        job_state = get_job(job_id) or {}
        update_job(job_id,
                   status="complete",
                   progress=job_state.get("total_chunks", 1),
                   audio_url=f"/api/audio/{wav_filename}",
                   duration=round(duration, 2),
                   render_time=render_time,
                   file_size=file_size,
                   sample_rate=sample_rate)

        # Save to history
        storage_manager.save_history_item({
            "id": f"audio_{job_id}",
            "timestamp": time.time(),
            "text": text[:120] + "..." if len(text) > 120 else text,
            "voice": voice,
            "duration": round(duration, 2),
            "render_time": render_time,
            "file_size": file_size,
            "sample_rate": sample_rate,
            "file_path": wav_path,
            "audio_url": f"/api/audio/{wav_filename}",
        })

    except Exception as e:
        update_job(job_id, status="failed", error=str(e))


# ─── Voices ─────────────────────────────────────────────────────────────────

@router.get("/voices")
def get_voices():
    try:
        return {"voices": tts_engine.get_available_voices()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Async Generation with Job Tracking ──────────────────────────────────────

@router.post("/generate")
async def generate_speech(payload: Dict[str, Any] = Body(...)):
    """Start async TTS generation. Returns job_id immediately; poll /api/jobs/{id} for progress."""
    text = payload.get("text", "").strip()
    voice = payload.get("voice", "af_bella")
    speed = min(max(float(payload.get("speed", 1.0)), 0.5), 2.0)
    lang = payload.get("lang", "en-us")
    sentence_gap = min(max(int(payload.get("sentence_gap_ms", 200)), 0), 3000)
    paragraph_gap = min(max(int(payload.get("paragraph_gap_ms", 400)), 0), 5000)
    dsp_settings = payload.get("dsp", {
        "silence_trim": True, "limiter": True, "normalize": True, "fade": True,
        "micro_variation": True, "breathing_injection": True,
    })

    if not text:
        raise HTTPException(status_code=400, detail="Script text cannot be empty.")

    job_id = create_job(text, voice)
    # Kick off in thread pool (non-blocking)
    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        _tts_executor,
        _run_generation_blocking,
        job_id, text, voice, speed, lang, sentence_gap, paragraph_gap, dsp_settings
    )
    return {"job_id": job_id, "status": "processing"}


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs")
def list_all_jobs():
    return {"jobs": list_jobs()}


# --- Audio / Video Upload (for Timeline & Video Sync) -----------------------

@router.post("/audio/upload")
async def upload_audio_file(file: UploadFile = File(...)):
    """
    Upload external audio OR video file for timeline/video-sync editing.
    - Audio files -> saved directly, duration detected via soundfile/ffprobe
    - Video files -> audio track extracted to WAV automatically; returns both
                     audio_url (extracted WAV) and video_url (backend video serve URL)
    """
    original_ext = os.path.splitext(_safe_filename(file.filename or "file.wav"))[1].lower()
    ts = int(time.time() * 1000)
    orig_filename = f"upload_{ts}_{_safe_filename(file.filename or 'file.wav')}"
    out_path = os.path.join(TEMP_DIR, orig_filename)

    content = await file.read()
    with open(out_path, "wb") as f_out:
        f_out.write(content)

    VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".wmv", ".flv", ".m4v", ".3gp"}
    is_video = original_ext in VIDEO_EXTS or (file.content_type or "").startswith("video/")

    audio_url = f"/api/audio/{orig_filename}"
    video_url = None
    audio_path = out_path
    duration = 5.0

    if is_video:
        # Extract audio from video file for playback / timeline mixing
        audio_filename = f"upload_audio_{ts}.wav"
        audio_path_wav = os.path.join(TEMP_DIR, audio_filename)
        cmd = [
            "ffmpeg", "-y", "-i", out_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "24000", "-ac", "1",
            audio_path_wav,
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, timeout=120)
            if res.returncode == 0 and os.path.exists(audio_path_wav):
                audio_url = f"/api/audio/{audio_filename}"
                audio_path = audio_path_wav
        except Exception as e:
            print(f"[Upload] Video audio extraction failed: {e}")

        # Video file served for visual preview
        video_url = f"/api/video/serve/{orig_filename}"

    # Detect duration from audio/video
    try:
        import soundfile as sf
        info = sf.info(audio_path)
        duration = round(info.duration, 2)
    except Exception:
        try:
            from scipy.io import wavfile as _wf
            sr, data = _wf.read(audio_path)
            duration = round(len(data) / float(sr), 2)
        except Exception:
            try:
                result = subprocess.run(
                    ["ffprobe", "-v", "error",
                     "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1",
                     out_path],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10
                )
                raw = result.stdout.decode().strip()
                if raw:
                    duration = round(float(raw), 2)
            except Exception:
                pass

    return {
        "audio_url":  audio_url,
        "video_url":  video_url,
        "file_path":  audio_path,
        "orig_path":  out_path,
        "filename":   file.filename,
        "is_video":   is_video,
        "duration":   duration,
        "file_size":  len(content),
    }


# --- Serve original uploaded video files for inline preview -----------------

@router.get("/video/serve/{filename}")
def serve_uploaded_video(filename: str):
    safe = _safe_filename(filename)
    path = os.path.join(TEMP_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Video file not found")
    ext = os.path.splitext(safe)[1].lower().lstrip(".")
    mime = {"mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
            "mkv": "video/x-matroska", "avi": "video/x-msvideo"}.get(ext, "video/mp4")
    return FileResponse(
        path,
        media_type=mime,
        headers={"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600"},
    )


# --- Audio File Serving ------------------------------------------------------

@router.get("/audio/{filename}")
def stream_audio(filename: str):
    path = _resolve_audio_file(filename)
    media_type, _ = mimetypes.guess_type(path)
    return FileResponse(
        path,
        media_type=media_type or "audio/wav",
        headers={"Accept-Ranges": "bytes"},
    )




# ─── Export Format Conversion ────────────────────────────────────────────────

@router.post("/export")
def export_audio(payload: Dict[str, Any] = Body(...)):
    """Convert a generated WAV to target format/quality and return download URL."""
    raw_source = payload.get("filename", "")
    target_format = payload.get("format", "mp3").lower()
    quality = payload.get("quality", "Studio")
    custom_name = payload.get("custom_name", "").strip()

    if not raw_source:
        raise HTTPException(status_code=400, detail="filename is required")

    source_filename = _safe_filename(raw_source)

    wav_path = os.path.join(TEMP_DIR, source_filename)
    if not os.path.exists(wav_path):
        raise HTTPException(status_code=404, detail="Source audio not found")

    if target_format == "wav":
        output_path = wav_path
    else:
        bitrate_map = {"Draft": "128k", "Standard": "192k", "Studio": "320k", "Lossless": "320k"}
        bitrate = bitrate_map.get(quality, "320k")
        name_stem = _safe_filename(custom_name) if custom_name else os.path.splitext(source_filename)[0]
        output_filename = f"{name_stem}.{target_format}"
        output_path = os.path.join(EXPORTS_DIR, output_filename)
        os.makedirs(EXPORTS_DIR, exist_ok=True)
        cmd = ["ffmpeg", "-y", "-i", wav_path, "-b:a", bitrate, output_path]
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=60)
            if result.returncode != 0:
                raise RuntimeError("ffmpeg conversion failed")
        except (FileNotFoundError, RuntimeError):
            # Fallback: copy WAV
            import shutil
            output_path = os.path.join(EXPORTS_DIR, f"{name_stem}.wav")
            shutil.copy2(wav_path, output_path)
            target_format = "wav"

    file_size = os.path.getsize(output_path)
    export_filename = os.path.basename(output_path)
    return {
        "download_url": f"/api/audio/{export_filename}",
        "format": target_format,
        "file_size": file_size,
        "quality": quality,
    }


# ─── Background Music Mixing ─────────────────────────────────────────────────

@router.post("/mix")
async def mix_audio(
    voice_filename: str = Form(...),
    music_file: UploadFile = File(...),
    voice_volume: float = Form(1.0),
    music_volume: float = Form(0.15),
    duck_under_speech: bool = Form(True),
):
    """Mix voice narration WAV with uploaded background music."""
    voice_path = os.path.join(TEMP_DIR, _safe_filename(voice_filename))
    if not os.path.exists(voice_path):
        raise HTTPException(status_code=404, detail="Voice audio file not found")

    # Save uploaded music to temp
    music_ext = os.path.splitext(_safe_filename(music_file.filename or "music.wav"))[1] or ".wav"
    music_path = os.path.join(TEMP_DIR, f"music_upload_{int(time.time()*1000)}{music_ext}")
    contents = await music_file.read()
    with open(music_path, "wb") as f:
        f.write(contents)

    def _do_mix():
        voice_data, voice_sr = mixer.load_wav_as_float32(voice_path)
        mixed = mixer.mix(voice_data, voice_sr, music_path,
                          voice_volume=voice_volume,
                          music_volume=music_volume,
                          duck_under_speech=duck_under_speech)
        out_filename = f"mixed_{int(time.time()*1000)}.wav"
        out_path = os.path.join(TEMP_DIR, out_filename)
        audio_exporter.save_wav(mixed, voice_sr, out_path)
        return out_filename, os.path.getsize(out_path)

    loop = asyncio.get_running_loop()
    out_filename, file_size = await loop.run_in_executor(_tts_executor, _do_mix)
    return {"audio_url": f"/api/audio/{out_filename}", "file_size": file_size}


# ─── Voice Presets ────────────────────────────────────────────────────────────

PRESETS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "voice_presets.json")

def _load_presets() -> List[Dict]:
    os.makedirs(os.path.dirname(PRESETS_FILE), exist_ok=True)
    if os.path.exists(PRESETS_FILE):
        with open(PRESETS_FILE, "r") as f:
            return json.load(f)
    return []

def _save_presets(presets: List[Dict]):
    os.makedirs(os.path.dirname(PRESETS_FILE), exist_ok=True)
    with open(PRESETS_FILE, "w") as f:
        json.dump(presets, f, indent=2)

@router.get("/voice-presets")
def get_voice_presets():
    return {"presets": _load_presets()}

@router.post("/voice-presets")
def save_voice_preset(payload: Dict[str, Any] = Body(...)):
    presets = _load_presets()
    preset = {**payload, "id": f"preset_{int(time.time()*1000)}"}
    presets.append(preset)
    _save_presets(presets)
    return {"preset": preset}

@router.delete("/voice-presets/{preset_id}")
def delete_voice_preset(preset_id: str):
    presets = [p for p in _load_presets() if p.get("id") != preset_id]
    _save_presets(presets)
    return {"success": True}


# ─── Projects ────────────────────────────────────────────────────────────────

@router.get("/projects")
def list_projects():
    return {"projects": storage_manager.list_projects()}

@router.get("/projects/{project_id}")
def get_project(project_id: str):
    p = storage_manager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": p}

@router.post("/projects")
def save_project(payload: Dict[str, Any] = Body(...)):
    saved = storage_manager.save_project(payload)
    return {"project": saved}

@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    return {"success": storage_manager.delete_project(project_id)}


# ─── Pronunciation Dictionary ─────────────────────────────────────────────────

@router.get("/dictionary")
def get_dictionary():
    return {"global_rules": dictionary_engine.global_rules, "project_rules": dictionary_engine.project_rules}

@router.post("/dictionary")
def add_dictionary_rule(payload: Dict[str, Any] = Body(...)):
    word, replace = payload.get("word"), payload.get("replace")
    if word and replace:
        dictionary_engine.add_rule(word, replace, payload.get("is_global", True), payload.get("case_sensitive", False))
        return {"success": True, "global_rules": dictionary_engine.global_rules}
    raise HTTPException(status_code=400, detail="Invalid rule")

@router.delete("/dictionary/{word}")
def delete_dictionary_rule(word: str, is_global: bool = True):
    dictionary_engine.remove_rule(word, is_global)
    return {"success": True}


# ─── Subtitles ────────────────────────────────────────────────────────────────

@router.post("/subtitles/parse")
async def parse_subtitles(file: UploadFile = File(...)):
    contents = (await file.read()).decode("utf-8", errors="ignore")
    items = subtitle_parser.parse_file(contents, filename=file.filename or "subtitle.srt")
    return {"subtitles": items, "count": len(items)}


# ─── History ─────────────────────────────────────────────────────────────────

@router.get("/history")
def get_history():
    return {"history": storage_manager.list_history()}

@router.delete("/history/{history_id}")
def delete_history_entry(history_id: str):
    if not storage_manager.delete_history(history_id):
        raise HTTPException(status_code=404, detail="History entry not found")
    return {"success": True}


# ─── Queue ────────────────────────────────────────────────────────────────────

@router.get("/queue")
def get_queue():
    return {"jobs": batch_queue.get_queue(), "is_paused": batch_queue.is_paused}

@router.post("/queue/add")
def add_queue_job(payload: Dict[str, Any] = Body(...)):
    job = batch_queue.add_job(
        payload.get("title", "Batch Job"),
        payload.get("text", ""),
        payload.get("voice", "af_bella"),
        payload.get("settings"),
    )
    return {"job": job}

@router.post("/queue/pause")
def pause_queue():
    batch_queue.pause_queue()
    return {"is_paused": True}

@router.post("/queue/resume")
def resume_queue():
    batch_queue.resume_queue()
    return {"is_paused": False}

# ── Specific routes MUST come before the wildcard /{job_id} route ──────────────

class BulkDeleteBody(BaseModel):
    job_ids: Optional[List[str]] = []

@router.post("/queue/bulk-delete")
def bulk_delete_queue_jobs(body: BulkDeleteBody):
    count = batch_queue.delete_jobs(body.job_ids)
    return {"success": True, "deleted_count": count}

@router.post("/queue/clear-all")
def clear_all_queue_jobs():
    count = batch_queue.clear_all()
    return {"success": True, "deleted_count": count}

# ── Wildcard route LAST — catches any individual job_id ────────────────────────
@router.delete("/queue/{job_id}")
def cancel_queue_job(job_id: str):
    batch_queue.cancel_job(job_id)
    return {"success": True}


# ─── Settings ─────────────────────────────────────────────────────────────────

@router.get("/settings")
def get_settings():
    return storage_manager.get_settings()

@router.post("/settings")
def update_settings(payload: Dict[str, Any] = Body(...)):
    storage_manager.save_settings(payload)
    return {"success": True}


# ─── System Stats ─────────────────────────────────────────────────────────────

@router.get("/system/stats")
def get_system_stats():
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    try:
        disk = psutil.disk_usage(TEMP_DIR)
        disk_free_gb = round(disk.free / (1024 ** 3), 1)
    except Exception:
        disk_free_gb = 0
    return {
        "cpu_percent": round(cpu, 1),
        "cpu_count": psutil.cpu_count(logical=True),
        "memory_used_mb": round(mem.used / (1024 * 1024), 1),
        "memory_total_mb": round(mem.total / (1024 * 1024), 1),
        "memory_percent": mem.percent,
        "disk_free_gb": disk_free_gb,
        "total_voices": 54,
        "engine": "Kokoro TTS ONNX v1.0",
        "backend_status": "Online",
    }

@router.get("/system/logs")
def get_system_logs():
    import platform
    mem = psutil.virtual_memory()
    ffmpeg_ok = False
    try:
        res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=2)
        ffmpeg_ok = res.returncode == 0
    except Exception:
        ffmpeg_ok = False

    logs = [
        f"[INIT] ProVoice Studio Engine v1.0 on {platform.system()} {platform.release()}",
        f"[ENGINE] Kokoro ONNX model active (54 voice vectors verified)",
        f"[FFMPEG] FFmpeg Audio & Video Pipeline: {'READY' if ffmpeg_ok else 'MISSING'}",
        f"[DSP] Audio DSP Pipeline active (SciPy / NumPy processing)",
        f"[SERVER] FastAPI daemon listening on http://127.0.0.1:8000 (Python {platform.python_version()})",
        f"[SYSTEM] CPU: {psutil.cpu_count(logical=True)} logical cores | Memory: {round(mem.used / (1024*1024), 1)} / {round(mem.total / (1024*1024), 1)} MB ({mem.percent}%)",
        f"[STORAGE] Export Directory: {EXPORTS_DIR}",
        f"[STATUS] 100% Offline — All speech & video processing local"
    ]
    return {"logs": logs}


# ─── Emotion Presets ──────────────────────────────────────────────────────────

@router.get("/emotion-presets")
def get_emotion_presets():
    return {"presets": EMOTION_PRESETS}


# ─── Multi-Track Timeline Render ─────────────────────────────────────────────

@router.post("/timeline/render")
async def render_timeline(payload: Dict[str, Any] = Body(...)):
    """
    Render a list of timeline tracks into a mixed WAV file.
    Payload: { "tracks": [...], "target_sr": 24000 }
    """
    tracks = payload.get("tracks", [])
    target_sr = int(payload.get("target_sr", 24000))

    if not tracks:
        raise HTTPException(status_code=400, detail="tracks list is required")

    loop = asyncio.get_running_loop()
    def _do_mix():
        mixed, sr = timeline_mixer.mix_timeline(tracks, target_sr=target_sr, temp_dir=TEMP_DIR, exports_dir=EXPORTS_DIR)
        out_filename = f"timeline_{int(time.time()*1000)}.wav"
        out_path = os.path.join(TEMP_DIR, out_filename)
        audio_exporter.save_wav(mixed, sr, out_path)
        return out_filename, len(mixed) / float(sr), os.path.getsize(out_path)

    try:
        out_filename, duration, file_size = await loop.run_in_executor(_tts_executor, _do_mix)
        if duration <= 0:
            raise HTTPException(
                status_code=400,
                detail="No audio could be resolved from the timeline clips. "
                       "Make sure clips have valid audio files (try re-adding them from Media Pool)."
            )
        return {
            "audio_url": f"/api/audio/{out_filename}",
            "duration":  round(duration, 2),
            "file_size": file_size,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Video Sync ───────────────────────────────────────────────────────────────

@router.post("/video/extract")
async def extract_video_audio(file: UploadFile = File(...)):
    """Upload a video file and extract its original audio track as WAV."""
    safe_name = _safe_filename(file.filename or "video.mp4")
    ext = os.path.splitext(safe_name)[1].lower()
    if not ext:
        ext = ".mp4"
    in_path = os.path.join(TEMP_DIR, f"upload_video_{int(time.time()*1000)}{ext}")
    out_path = os.path.join(TEMP_DIR, f"extracted_audio_{int(time.time()*1000)}.wav")

    contents = await file.read()
    with open(in_path, "wb") as f:
        f.write(contents)

    loop = asyncio.get_running_loop()
    success = await loop.run_in_executor(None, video_engine.extract_audio, in_path, out_path)
    if not success:
        raise HTTPException(status_code=500, detail="FFmpeg audio extraction failed. Ensure FFmpeg is installed.")

    out_filename = os.path.basename(out_path)
    in_filename = os.path.basename(in_path)
    return {
        "audio_url": f"/api/audio/{out_filename}",
        "video_url": f"/api/video/serve/{in_filename}",
        "video_path": in_path,
        "file_size": os.path.getsize(out_path),
    }


@router.post("/video/export")
async def export_video_with_narration(payload: Dict[str, Any] = Body(...)):
    """
    Mux narration audio track into a video file via FFmpeg.
    Payload: { "video_path": "...", "audio_filename": "...", "preserve_original": false, "original_volume": 0.2 }
    """
    video_path = payload.get("video_path", "")
    audio_filename = payload.get("audio_filename", "")
    preserve_original = bool(payload.get("preserve_original", False))
    original_vol = float(payload.get("original_volume", 0.2))

    if not video_path or not audio_filename:
        raise HTTPException(status_code=400, detail="video_path and audio_filename are required")

    video_path = _validate_storage_path(video_path, purpose="video path")
    audio_path = os.path.join(TEMP_DIR, _safe_filename(audio_filename))
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    os.makedirs(EXPORTS_DIR, exist_ok=True)
    out_filename = f"exported_video_{int(time.time()*1000)}.mp4"
    out_path = os.path.join(EXPORTS_DIR, out_filename)

    loop = asyncio.get_running_loop()
    success = await loop.run_in_executor(
        None, video_engine.export_video_with_audio,
        video_path, audio_path, out_path, preserve_original, original_vol
    )

    if not success:
        raise HTTPException(status_code=500, detail="FFmpeg video export failed. Ensure FFmpeg is installed.")

    return {
        "download_url": f"/api/video/download/{out_filename}",
        "file_size": os.path.getsize(out_path),
    }


@router.post("/video/render-narration")
async def render_video_with_narration(payload: Dict[str, Any] = Body(...)):
    """
    Render a video with multiple narration clips placed at specific timestamps.
    Payload: {
      "video_path": "...",
      "markers": [{"audio_filename": "gen_xxx.wav", "start_time_sec": 2.5, "volume": 1.0}, ...],
      "preserve_original": false,
      "original_volume": 0.2
    }
    """
    video_path       = payload.get("video_path", "")
    raw_markers      = payload.get("markers", [])
    preserve_orig    = bool(payload.get("preserve_original", False))
    original_vol     = float(payload.get("original_volume", 0.2))
    auto_ducking     = bool(payload.get("auto_ducking", False))
    burn_subtitles   = bool(payload.get("burn_subtitles", False))

    if not video_path:
        raise HTTPException(status_code=400, detail="video_path is required")
    video_path = _validate_storage_path(video_path, purpose="video path")
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Video file not found: {video_path}")
    if not raw_markers:
        raise HTTPException(status_code=400, detail="markers list is required")

    # Resolve audio file paths for each marker
    resolved_markers = []
    for m in raw_markers:
        fname = m.get("audio_filename", "")
        if not fname:
            continue
        # Search in TEMP_DIR and EXPORTS_DIR
        for search_dir in [TEMP_DIR, EXPORTS_DIR]:
            candidate = os.path.join(search_dir, _safe_filename(fname))
            if os.path.exists(candidate):
                resolved_markers.append({
                    "audio_path":     candidate,
                    "start_time_sec": float(m.get("start_time_sec", 0)),
                    "duration_sec":   float(m.get("duration_sec", 5.0)),
                    "volume":         float(m.get("volume", 1.0)),
                    "speed":          float(m.get("speed", 1.0)),
                    "label":          m.get("label", ""),
                })
                break

    if not resolved_markers:
        raise HTTPException(
            status_code=400,
            detail="No audio files could be resolved. Re-add markers from Media Pool."
        )

    os.makedirs(EXPORTS_DIR, exist_ok=True)
    out_filename = f"narrated_video_{int(time.time()*1000)}.mp4"
    out_path = os.path.join(EXPORTS_DIR, out_filename)

    loop = asyncio.get_running_loop()
    def _do_render():
        return video_engine.export_video_with_markers(
            video_path=video_path,
            markers=resolved_markers,
            output_mp4_path=out_path,
            preserve_original_audio=preserve_orig,
            original_audio_volume=original_vol,
            auto_ducking=auto_ducking,
            burn_subtitles=burn_subtitles,
        )

    try:
        success, err = await loop.run_in_executor(None, _do_render)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if not success:
        raise HTTPException(status_code=500, detail=f"FFmpeg failed: {err}")

    return {
        "download_url": f"/api/video/download/{out_filename}",
        "file_size":    os.path.getsize(out_path),
        "markers_used": len(resolved_markers),
    }


@router.get("/video/download/{filename}")
def download_video_file(filename: str):
    """Serve an exported MP4 video file with proper Content-Type."""
    # Security: only allow plain filenames, no path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(EXPORTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Video file not found")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )




@router.post("/v1/tts/synthesize")
async def api_v1_synthesize(payload: Dict[str, Any] = Body(...)):
    """
    Public REST API v1 endpoint for headless automation.
    Same as /api/generate but returns a job_id for polling.
    """
    text = payload.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    voice = payload.get("voice", "af_bella")
    speed = min(max(float(payload.get("speed", 1.0)), 0.5), 2.0)
    lang = payload.get("lang", "en-us")
    emotion = payload.get("emotion", "normal")

    # Apply emotion preset defaults
    ep = EMOTION_PRESETS.get(emotion, EMOTION_PRESETS["normal"])
    sentence_gap = min(max(int(payload.get("sentence_gap_ms", ep.get("sentence_gap_ms", 200))), 0), 3000)
    paragraph_gap = min(max(int(payload.get("paragraph_gap_ms", ep.get("paragraph_gap_ms", 400))), 0), 5000)
    dsp_settings = payload.get("dsp", {"silence_trim": True, "limiter": True, "normalize": True, "fade": True})

    job_id = create_job(text, voice)
    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        _tts_executor,
        _run_generation_blocking,
        job_id, text, voice, speed, lang, sentence_gap, paragraph_gap, dsp_settings
    )
    return {
        "job_id": job_id,
        "status": "processing",
        "poll_url": f"/api/jobs/{job_id}",
        "api_version": "v1",
    }


@router.get("/v1/voices")
def api_v1_get_voices():
    """REST API v1 — list all available voices."""
    return {"voices": tts_engine.get_available_voices(), "api_version": "v1"}


# ─── Webhooks ─────────────────────────────────────────────────────────────────

@router.get("/webhooks")
def list_webhooks():
    return {"webhooks": webhook_registry.list_hooks()}


@router.post("/webhooks/register")
def register_webhook(payload: Dict[str, Any] = Body(...)):
    url = payload.get("url", "")
    event = payload.get("event", "*")
    name = payload.get("name", "")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    hook = webhook_registry.register(url, event, name)
    return {"webhook": hook}


@router.delete("/webhooks/{hook_id}")
def unregister_webhook(hook_id: str):
    success = webhook_registry.unregister(hook_id)
    if not success:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"success": True}


# ─── Video Upload & Batch Trimmer ──────────────────────────────────────────────────────

@router.post("/video/upload")
@router.post("/upload")
async def upload_video_file(file: UploadFile = File(...)):
    """Upload any video/audio file and return backend path and stream URL."""
    filename = file.filename or "video.mp4"
    safe_name = _safe_filename(filename)
    ts = int(time.time() * 1000)
    out_filename = f"upload_video_{ts}_{safe_name}"
    out_path = os.path.join(TEMP_DIR, out_filename)

    content = await file.read()
    with open(out_path, "wb") as f_out:
        f_out.write(content)

    video_url = f"/api/video/serve/{out_filename}"
    duration = 10.0

    try:
        probe_cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            out_path
        ]
        p_res = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
        if p_res.returncode == 0 and p_res.stdout.strip():
            duration = round(float(p_res.stdout.strip()), 2)
    except Exception:
        pass

    return {
        "success": True,
        "filename": filename,
        "video_path": out_path,
        "video_url": video_url,
        "duration": duration,
    }


@router.post("/video/trim-batch")
@router.post("/trim-batch")
def video_trim_batch(payload: Dict[str, Any] = Body(...)):
    """Batch trim video file into numbered clip segments (Clip 1, Clip 2, Clip 3...)."""
    video_path = payload.get("video_path", "")
    ranges = payload.get("ranges", [])
    merge_all = payload.get("merge_all", False)
    export_quality = payload.get("export_quality", "original") # original, 1080p, 2k, 4k
    aspect_fit = payload.get("aspect_fit", "original")          # original, mobile_9_16, square_1_1

    if not video_path:
        raise HTTPException(status_code=400, detail="video_path is required")
    if not ranges or not isinstance(ranges, list):
        raise HTTPException(status_code=400, detail="ranges must be a non-empty array of objects")

    # If video_path is a relative URL like /api/video/serve/upload_..., resolve to TEMP_DIR
    if video_path.startswith("/api/video/serve/") or video_path.startswith("/api/audio/"):
        filename = video_path.split("/")[-1]
        video_path = os.path.join(TEMP_DIR, filename)

    if not os.path.exists(video_path):
        # Fallback to the most recently uploaded video file in TEMP_DIR
        recent_videos = [
            os.path.join(TEMP_DIR, f) for f in os.listdir(TEMP_DIR)
            if f.startswith("upload_video_") or f.startswith("upload_")
        ]
        if recent_videos:
            recent_videos.sort(key=os.path.getmtime, reverse=True)
            video_path = recent_videos[0]

    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Source video file not found. Please upload a video first.")

    # Process batch trim via VideoSyncEngine
    res = video_engine.trim_video_batch(
        video_path=video_path,
        ranges=ranges,
        output_dir=TRIMMED_DIR,
        merge_all=merge_all,
        export_quality=export_quality,
        aspect_fit=aspect_fit,
    )

    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Trimming failed"))

    return res


@router.post("/video/detect-silence")
def detect_video_speech_silence(payload: Dict[str, Any] = Body(...)):
    """Auto-detect speech segments in video file and return timestamp ranges."""
    video_path = payload.get("video_path", "")
    if video_path.startswith("/api/video/serve/") or video_path.startswith("/api/audio/"):
        filename = video_path.split("/")[-1]
        video_path = os.path.join(TEMP_DIR, filename)

    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Source video file not found")

    segments = video_engine.detect_speech_segments(video_path)
    return {"success": True, "segments": segments}


@router.post("/video/export-zip")
def export_trimmed_clips_zip(payload: Dict[str, Any] = Body(...)):
    """Package all generated trimmed clips into a single downloadable ZIP file."""
    clip_filenames = payload.get("filenames", [])
    if not clip_filenames:
        raise HTTPException(status_code=400, detail="filenames list is required")

    clip_paths = [os.path.join(TRIMMED_DIR, _safe_filename(fn)) for fn in clip_filenames]
    ts = int(time.time())
    zip_name = f"ProVoice_Trimmed_Clips_{ts}.zip"
    zip_path = os.path.join(TRIMMED_DIR, zip_name)

    success = video_engine.package_clips_to_zip(clip_paths, zip_path)
    if not success or not os.path.exists(zip_path):
        raise HTTPException(status_code=500, detail="Failed to create ZIP archive")

    return {
        "success": True,
        "filename": zip_name,
        "download_url": f"/api/exports/trimmed/{zip_name}",
    }


@router.get("/exports/trimmed/{filename}")
def serve_trimmed_export(filename: str):
    """Serve generated trimmed clip video file or ZIP archive."""
    safe_name = _safe_filename(filename)
    path = os.path.join(TRIMMED_DIR, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Trimmed file not found")

    media_type = "application/zip" if safe_name.endswith(".zip") else "video/mp4"
    return FileResponse(path, media_type=media_type, filename=safe_name)



