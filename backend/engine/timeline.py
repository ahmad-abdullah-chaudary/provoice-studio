import os
import numpy as np
from typing import List, Dict, Any, Tuple
from scipy.io import wavfile
import logging

log = logging.getLogger("timeline")

class MultiTrackTimelineMixer:
    """DAW Multi-track audio mixer for layering voice, music, SFX, and video audio clips."""

    @staticmethod
    def load_audio_file(file_path: str) -> Tuple[np.ndarray, int]:
        """Load any audio format (WAV, MP3, OGG, FLAC, AIFF…) → (mono float32, sample_rate)."""
        import tempfile, subprocess as _sp

        # ── 1. soundfile: handles WAV, FLAC, OGG, AIFF natively ──────────────
        try:
            import soundfile as sf
            data, sr = sf.read(file_path, dtype="float32", always_2d=False)
            if data.ndim == 2:
                data = data.mean(axis=1)
            return data.astype(np.float32), int(sr)
        except Exception:
            pass

        # ── 2. ffmpeg: decode MP3 / any format to a temp WAV ─────────────────
        try:
            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp.close()
            res = _sp.run(
                ["ffmpeg", "-y", "-i", file_path,
                 "-ar", "24000", "-ac", "1", "-f", "wav", tmp.name],
                stdout=_sp.PIPE, stderr=_sp.PIPE, timeout=60,
            )
            if res.returncode == 0 and os.path.exists(tmp.name):
                sr, data = wavfile.read(tmp.name)
                try:
                    os.unlink(tmp.name)
                except Exception:
                    pass
                if data.dtype == np.int16:
                    data = data.astype(np.float32) / 32768.0
                elif data.dtype == np.int32:
                    data = data.astype(np.float32) / 2147483648.0
                elif data.dtype != np.float32:
                    data = data.astype(np.float32)
                if data.ndim == 2:
                    data = data.mean(axis=1)
                return data, int(sr)
            try:
                os.unlink(tmp.name)
            except Exception:
                pass
        except Exception:
            pass

        # ── 3. scipy wavfile: last resort (WAV/RIFF only) ────────────────────
        sr, data = wavfile.read(file_path)
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / 2147483648.0
        elif data.dtype != np.float32:
            data = data.astype(np.float32)
        if data.ndim == 2:
            data = data.mean(axis=1)
        return data, int(sr)

    @staticmethod
    def resample(audio: np.ndarray, src_sr: int, target_sr: int) -> np.ndarray:
        if src_sr == target_sr:
            return audio
        ratio = target_sr / src_sr
        new_len = int(len(audio) * ratio)
        indices = np.linspace(0, len(audio) - 1, new_len)
        return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)

    @staticmethod
    def apply_speed(audio: np.ndarray, sr: int, speed: float) -> np.ndarray:
        """
        Time-stretch audio by the given speed factor using FFmpeg atempo.
        speed > 1.0 = faster (shorter output), speed < 1.0 = slower (longer output).
        atempo only handles 0.5–2.0 per filter, so chain filters for extremes.
        """
        if abs(speed - 1.0) < 0.01:
            return audio  # No change needed

        import tempfile, subprocess as _sp

        tmp_in  = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_in.close(); tmp_out.close()

        try:
            # Write input as WAV
            from scipy.io.wavfile import write as wav_write
            pcm = (audio * 32767).astype(np.int16)
            wav_write(tmp_in.name, sr, pcm)

            # Build atempo filter chain (FFmpeg clamps each filter to 0.5–2.0)
            if speed <= 0.5:
                atempo = f"atempo=0.5,atempo={speed / 0.5:.4f}"
            elif speed >= 2.0:
                atempo = f"atempo=2.0,atempo={speed / 2.0:.4f}"
            else:
                atempo = f"atempo={speed:.4f}"

            res = _sp.run(
                ["ffmpeg", "-y", "-i", tmp_in.name,
                 "-filter:a", atempo,
                 "-ar", str(sr), "-ac", "1", "-f", "wav", tmp_out.name],
                stdout=_sp.PIPE, stderr=_sp.PIPE, timeout=60,
            )
            if res.returncode == 0 and os.path.exists(tmp_out.name):
                from scipy.io.wavfile import read as wav_read
                _, data = wav_read(tmp_out.name)
                if data.dtype == np.int16:
                    data = data.astype(np.float32) / 32768.0
                elif data.dtype == np.int32:
                    data = data.astype(np.float32) / 2147483648.0
                return data.astype(np.float32)
        except Exception as exc:
            log.warning(f"[apply_speed] FFmpeg atempo failed (speed={speed}): {exc}")
        finally:
            for p in (tmp_in.name, tmp_out.name):
                try: os.unlink(p)
                except Exception: pass

        # Fallback: naive resampling (changes pitch but keeps timing cheap)
        new_len = int(len(audio) / speed)
        indices = np.linspace(0, len(audio) - 1, new_len)
        return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)

    def resolve_clip_file_path(self, clip: Dict[str, Any], temp_dir: str = "", extra_dirs: list = None) -> str:
        """Resolve absolute file path from clip object (file_path or audio_url/audioUrl)."""
        fp = clip.get("file_path", "") or clip.get("filePath", "")
        if fp and os.path.exists(fp):
            return fp

        # Collect candidate filenames from all path/url fields
        candidates = []
        if fp:
            candidates.append(os.path.basename(fp))
        url = clip.get("audio_url", "") or clip.get("audioUrl", "")
        if url:
            candidates.append(os.path.basename(url))

        # Build search directory list
        default_temp = os.path.join(os.path.expanduser("~"), "AppData", "Local", "Temp", "provoice")
        all_dirs = [temp_dir, default_temp] + (extra_dirs or [])
        search_dirs = [d for d in all_dirs if d and os.path.exists(d)]

        for cand in candidates:
            for sdir in search_dirs:
                full = os.path.join(sdir, cand)
                if os.path.exists(full):
                    return full

        return ""

    def mix_timeline(
        self,
        tracks: List[Dict[str, Any]],
        target_sr: int = 24000,
        temp_dir: str = "",
        exports_dir: str = ""
    ) -> Tuple[np.ndarray, int]:
        """
        Mix multiple timeline tracks containing placed audio clips.
        All clip file paths are resolved from: file_path → audio_url → temp_dir → exports_dir.
        Speed is applied via FFmpeg atempo (time-stretch, pitch-preserved).
        """
        if not tracks:
            log.warning("[TimelineMixer] No tracks provided — returning empty buffer.")
            return np.zeros(0, dtype=np.float32), target_sr

        extra_dirs = [exports_dir] if exports_dir else []

        log.info(f"[TimelineMixer] Mixing {len(tracks)} tracks, target_sr={target_sr}, temp_dir={temp_dir}")

        # ── Pass 1: determine total duration ──────────────────────────────────
        max_duration_sec = 0.0
        for track in tracks:
            t_name  = track.get("name", track.get("id", "?"))
            t_muted = bool(track.get("muted", False))
            clips   = track.get("clips", [])
            log.info(f"  Track '{t_name}' | muted={t_muted} | {len(clips)} clip(s)")

            if t_muted:
                continue

            for i, clip in enumerate(clips):
                fp = self.resolve_clip_file_path(clip, temp_dir, extra_dirs)
                start = float(clip.get("start_time_sec", 0.0) or 0.0)
                speed = float(clip.get("speed") or 1.0)
                if fp:
                    try:
                        audio, sr = self.load_audio_file(fp)
                        clip_dur = len(audio) / float(sr) / speed  # speed changes real duration
                        max_duration_sec = max(max_duration_sec, start + clip_dur)
                        log.info(f"    Clip[{i}] OK → {os.path.basename(fp)} | start={start:.2f}s dur={clip_dur:.2f}s speed={speed}x")
                    except Exception as exc:
                        log.warning(f"    Clip[{i}] LOAD ERROR → {fp}: {exc}")
                else:
                    url  = clip.get("audio_url", clip.get("audioUrl", ""))
                    fp_r = clip.get("file_path", clip.get("filePath", ""))
                    log.warning(f"    Clip[{i}] NOT FOUND | file_path='{fp_r}' audio_url='{url}'")

        log.info(f"[TimelineMixer] Total content duration: {max_duration_sec:.2f}s")

        if max_duration_sec <= 0:
            log.error("[TimelineMixer] No resolvable clip files — cannot produce output.")
            return np.zeros(0, dtype=np.float32), target_sr

        # ── Pass 2: mix into master buffer ────────────────────────────────────
        total_samples = int(max_duration_sec * target_sr)
        master_buffer = np.zeros(total_samples, dtype=np.float32)

        for track in tracks:
            if bool(track.get("muted", False)):
                continue
            track_vol = float(track.get("volume", 1.0))
            for clip in track.get("clips", []):
                fp = self.resolve_clip_file_path(clip, temp_dir, extra_dirs)
                if not fp:
                    continue
                try:
                    audio, sr = self.load_audio_file(fp)
                    audio     = self.resample(audio, sr, target_sr)

                    # Apply speed (time-stretch via FFmpeg atempo)
                    speed = float(clip.get("speed") or 1.0)
                    if abs(speed - 1.0) >= 0.01:
                        audio = self.apply_speed(audio, target_sr, speed)

                    clip_vol  = float(clip.get("volume") or 1.0) * track_vol
                    audio     = audio * clip_vol

                    start_sec = float(clip.get("start_time_sec") or 0.0)
                    start_idx = int(start_sec * target_sr)
                    end_idx   = min(start_idx + len(audio), total_samples)
                    actual_len = end_idx - start_idx

                    if actual_len > 0:
                        master_buffer[start_idx:end_idx] += audio[:actual_len]
                except Exception as exc:
                    log.error(f"[TimelineMixer] Mix error for {fp}: {exc}")

        # ── Normalize peak to avoid clipping ──────────────────────────────────
        peak = np.max(np.abs(master_buffer))
        if peak > 0.98:
            master_buffer = master_buffer * (0.98 / peak)

        log.info(f"[TimelineMixer] Done — {total_samples} samples @ {target_sr}Hz")
        return master_buffer.astype(np.float32), target_sr


timeline_mixer = MultiTrackTimelineMixer()
