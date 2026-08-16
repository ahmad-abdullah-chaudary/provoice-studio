import os
import subprocess
import time
from typing import Dict, Any, Optional, List, Tuple

class VideoSyncEngine:
    """Video audio extraction and FFmpeg multiplexing engine."""

    @staticmethod
    def extract_audio(video_path: str, output_wav_path: str) -> bool:
        """Extract reference audio track from video file into WAV format."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "24000", "-ac", "1",
            output_wav_path,
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, timeout=120)
            return res.returncode == 0 and os.path.exists(output_wav_path)
        except Exception as e:
            print(f"[VideoEngine] Extract audio error: {e}")
            return False

    @staticmethod
    def export_video_with_audio(
        video_path: str,
        audio_path: str,
        output_mp4_path: str,
        preserve_original_audio: bool = False,
        original_audio_volume: float = 0.2,
    ) -> bool:
        """Mux a single narration track back into the video (legacy single-file export)."""
        if not os.path.exists(video_path) or not os.path.exists(audio_path):
            raise FileNotFoundError("Video or Audio source file missing")
        os.makedirs(os.path.dirname(output_mp4_path), exist_ok=True)
        if preserve_original_audio:
            cmd = [
                "ffmpeg", "-y", "-i", video_path, "-i", audio_path,
                "-filter_complex",
                f"[0:a]volume={original_audio_volume}[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:normalize=0[aout]",
                "-map", "0:v:0", "-map", "[aout]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", output_mp4_path,
            ]
        else:
            cmd = [
                "ffmpeg", "-y", "-i", video_path, "-i", audio_path,
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-map", "0:v:0", "-map", "1:a:0", "-shortest", output_mp4_path,
            ]
        try:
            res = subprocess.run(cmd, capture_output=True, timeout=300)
            return res.returncode == 0 and os.path.exists(output_mp4_path)
        except Exception as e:
            print(f"[VideoEngine] Export video error: {e}")
            return False

    @staticmethod
    def export_video_with_markers(
        video_path: str,
        markers: List[Dict],
        output_mp4_path: str,
        preserve_original_audio: bool = False,
        original_audio_volume: float = 0.2,
        auto_ducking: bool = False,
        ducking_depth: float = 0.15,
        burn_subtitles: bool = False,
    ) -> Tuple[bool, str]:
        """
        Export video with multiple narration clips placed at specific timestamps.
        Supports Auto-Ducking and SRT Subtitle Burn-In.
        """
        if not os.path.exists(video_path):
            return False, f"Video file not found: {video_path}"

        valid = [m for m in markers if m.get("audio_path") and os.path.exists(m["audio_path"])]
        if not valid:
            return False, "No valid narration audio files found for any marker"

        os.makedirs(os.path.dirname(output_mp4_path) or ".", exist_ok=True)
        temp_dir = os.path.dirname(output_mp4_path) or "."

        # ── Optional: Write Subtitles SRT File ────────────────────────────────
        srt_file = None
        if burn_subtitles:
            srt_path = os.path.join(temp_dir, f"subtitles_{int(time.time()*1000)}.srt")
            try:
                def format_srt_time(sec: float) -> str:
                    hrs = int(sec // 3600)
                    mins = int((sec % 3600) // 60)
                    secs = int(sec % 60)
                    millis = int((sec % 1) * 1000)
                    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

                sorted_markers = sorted(valid, key=lambda x: float(x.get("start_time_sec", 0)))
                with open(srt_path, "w", encoding="utf-8") as f:
                    for idx, m in enumerate(sorted_markers, 1):
                        start_s = float(m.get("start_time_sec", 0))
                        dur_s = float(m.get("duration_sec", 5.0))
                        end_s = start_s + dur_s
                        label = m.get("label") or f"Segment {idx}"
                        f.write(f"{idx}\n{format_srt_time(start_s)} --> {format_srt_time(end_s)}\n{label}\n\n")
                if os.path.exists(srt_path):
                    srt_file = srt_path
            except Exception as e:
                print(f"[VideoEngine] SRT creation error: {e}")

        # ── Build FFmpeg inputs ───────────────────────────────────────────────
        cmd = ["ffmpeg", "-y", "-i", video_path]
        for m in valid:
            cmd += ["-i", m["audio_path"]]

        parts: List[str] = []
        labels: List[str] = []

        for i, m in enumerate(valid):
            delay_ms = max(0, int(float(m.get("start_time_sec", 0)) * 1000))
            vol = max(0.0, min(4.0, float(m.get("volume", 1.0))))
            speed = float(m.get("speed", 1.0))
            lbl = f"[narr{i}]"

            # Build per-marker filter: atempo (speed) → adelay → volume
            if abs(speed - 1.0) >= 0.01:
                # Chain atempo filters (each filter handles 0.5-2.0 range)
                if speed <= 0.5:
                    atempo_chain = f"atempo=0.5,atempo={speed / 0.5:.4f}"
                elif speed >= 2.0:
                    atempo_chain = f"atempo=2.0,atempo={speed / 2.0:.4f}"
                else:
                    atempo_chain = f"atempo={speed:.4f}"
                parts.append(f"[{i+1}:a]{atempo_chain},adelay={delay_ms}:all=1,volume={vol}{lbl}")
            else:
                parts.append(f"[{i+1}:a]adelay={delay_ms}:all=1,volume={vol}{lbl}")

            labels.append(lbl)

        # Merge all narration streams
        if len(valid) > 1:
            parts.append(f"{''.join(labels)}amix=inputs={len(valid)}:normalize=0[narrmix]")
            narr_out = "[narrmix]"
        else:
            narr_out = labels[0]

        # Mix with original video audio (optional with auto-ducking)
        if preserve_original_audio:
            if auto_ducking:
                # Use sidechain ducking filter or volume envelope logic
                parts.append(f"[0:a]volume={original_audio_volume}[origvol]")
                parts.append(f"[origvol]{narr_out}sidechaincompress=threshold=0.08:ratio=4:attack=20:release=300[ducked]")
                parts.append(f"[ducked]{narr_out}amix=inputs=2:normalize=0[aout]")
            else:
                parts.append(f"[0:a]volume={original_audio_volume}[origvol]")
                parts.append(f"[origvol]{narr_out}amix=inputs=2:normalize=0[aout]")
        else:
            parts.append(f"{narr_out}volume=1.0[aout]")

        # Subtitle Video Filter (if enabled)
        if srt_file:
            # Escape path for ffmpeg filter string
            escaped_srt = srt_file.replace("\\", "/").replace(":", "\\:")
            vf_str = f"subtitles='{escaped_srt}':force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Alignment=2'"
            cmd += [
                "-filter_complex", ";".join(parts),
                "-vf", vf_str,
                "-map", "0:v:0", "-map", "[aout]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                output_mp4_path,
            ]
        else:
            cmd += [
                "-filter_complex", ";".join(parts),
                "-map", "0:v:0", "-map", "[aout]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                output_mp4_path,
            ]

        try:
            print(f"[VideoEngine] Rendering {len(valid)} marker(s) into {os.path.basename(output_mp4_path)} (burn_subtitles={burn_subtitles}, auto_ducking={auto_ducking})")
            res = subprocess.run(cmd, capture_output=True, timeout=600)
            if srt_file and os.path.exists(srt_file):
                try: os.unlink(srt_file)
                except Exception: pass
            if res.returncode == 0 and os.path.exists(output_mp4_path):
                return True, ""
            err = res.stderr.decode("utf-8", errors="replace")
            return False, err[-600:] if len(err) > 600 else err
        except subprocess.TimeoutExpired:
            return False, "FFmpeg export timed out (>10 min)"
        except Exception as exc:
            return False, str(exc)

    @staticmethod
    def parse_timestamp_to_seconds(ts_str: str) -> float:
        """Parse timestamp formats (hh:mm:ss:ms, hh:mm:ss.ms, mm:ss, ss) to seconds."""
        s = ts_str.strip().replace(",", ".")
        if not s:
            return 0.0
        parts = s.split(":")
        try:
            if len(parts) == 4:
                # e.g. 0:0:1:45 -> H:M:S:MS
                h = float(parts[0])
                m = float(parts[1])
                sec = float(parts[2])
                ms_val = float(parts[3])
                ms = ms_val / 100.0 if len(parts[3]) <= 2 else ms_val / 1000.0
                return h * 3600 + m * 60 + sec + ms
            elif len(parts) == 3:
                # e.g. 01:23:45.500
                h = float(parts[0])
                m = float(parts[1])
                sec = float(parts[2])
                return h * 3600 + m * 60 + sec
            elif len(parts) == 2:
                # e.g. 01:23.500 or 1:30
                m = float(parts[0])
                sec = float(parts[1])
                return m * 60 + sec
            elif len(parts) == 1:
                return float(parts[0])
        except ValueError:
            pass
        return 0.0

    @staticmethod
    def trim_video_batch(
        video_path: str,
        ranges: List[Dict[str, Any]],
        output_dir: str,
        merge_all: bool = False,
        export_quality: str = "original",
        aspect_fit: str = "original",
    ) -> Dict[str, Any]:
        """Trim video with optional 2K/4K resolution encoding and aspect ratio fitting."""
        if not os.path.exists(video_path):
            return {"success": False, "error": f"Source video not found: {video_path}"}

        os.makedirs(output_dir, exist_ok=True)
        results = []
        trimmed_file_paths = []
        base_name = os.path.splitext(os.path.basename(video_path))[0]
        timestamp_id = int(time.time())

        # Determine target resolution & video filter
        # All aspect ratio conversions use scale+pad (letterbox/pillarbox) to preserve full content.
        # scale=w:h:flags=lanczos — Lanczos high-quality resampling, upscales AND downscales cleanly.
        vf_filter = None
        audio_bitrate = "320k"   # High-quality stereo audio
        video_bitrate = "12M"    # Minimum default: crisp 1080p quality

        def make_scale_pad(w: int, h: int) -> str:
            """
            High-Quality FFmpeg scale+pad filter chain.
            1. scale with Lanczos resampling: upscales AND downscales with best quality
            2. pad: center the result in the WxH canvas with black bars (letterbox / pillarbox)
            3. setsar: correct sample aspect ratio metadata to 1:1
            """
            return (
                f"scale={w}:{h}:flags=lanczos,"
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,"
                f"setsar=1"
            )

        if export_quality == "2k":
            video_bitrate = "25M"           # 2K: broadcast-grade quality
            if aspect_fit == "mobile_9_16":
                vf_filter = make_scale_pad(1440, 2560)   # 9:16 portrait @ 2K
            elif aspect_fit == "square_1_1":
                vf_filter = make_scale_pad(1440, 1440)   # 1:1 square @ 2K
            else:
                vf_filter = make_scale_pad(2560, 1440)   # 16:9 landscape @ 2K
        elif export_quality == "4k":
            video_bitrate = "50M"           # 4K: cinema-grade quality
            if aspect_fit == "mobile_9_16":
                vf_filter = make_scale_pad(2160, 3840)   # 9:16 portrait @ 4K UHD
            elif aspect_fit == "square_1_1":
                vf_filter = make_scale_pad(2160, 2160)   # 1:1 square @ 4K
            else:
                vf_filter = make_scale_pad(3840, 2160)   # 16:9 landscape @ 4K UHD
        elif export_quality == "1080p":
            video_bitrate = "12M"           # 1080p: high-quality streaming standard
            if aspect_fit == "mobile_9_16":
                vf_filter = make_scale_pad(1080, 1920)   # 9:16 portrait @ 1080p
            elif aspect_fit == "square_1_1":
                vf_filter = make_scale_pad(1080, 1080)   # 1:1 square @ 1080p
            else:
                vf_filter = make_scale_pad(1920, 1080)   # 16:9 landscape @ 1080p
        elif aspect_fit == "mobile_9_16":
            vf_filter = make_scale_pad(1080, 1920)       # 9:16 portrait @ native res
        elif aspect_fit == "square_1_1":
            vf_filter = make_scale_pad(1080, 1080)       # 1:1 square @ native res

        for idx, item in enumerate(ranges, start=1):
            start_sec = float(item.get("start_sec", 0.0))
            end_sec = float(item.get("end_sec", 0.0))
            duration = max(0.0, end_sec - start_sec)

            clip_name = f"Clip_{idx}_{base_name}_{timestamp_id}.mp4"
            clip_path = os.path.join(output_dir, clip_name)

            success = False

            # Fast stream copy (instant) ONLY when both quality AND aspect ratio are original
            needs_reencode = (aspect_fit != "original") or (export_quality != "original")

            if not needs_reencode:
                cmd_copy = [
                    "ffmpeg", "-y",
                    "-ss", f"{start_sec:.3f}",
                    "-to", f"{end_sec:.3f}",
                    "-i", video_path,
                    "-c", "copy",
                    "-avoid_negative_ts", "make_zero",
                    clip_path
                ]
                try:
                    res = subprocess.run(cmd_copy, capture_output=True, timeout=15)
                    if res.returncode == 0 and os.path.exists(clip_path) and os.path.getsize(clip_path) > 1000:
                        success = True
                except Exception:
                    pass

            # High-Quality Re-encode: used when aspect_fit or export_quality changes are requested
            if not success:
                cmd_encode = [
                    "ffmpeg", "-y",
                    "-ss", f"{start_sec:.3f}",
                    "-to", f"{end_sec:.3f}",
                    "-i", video_path,
                ]
                if vf_filter:
                    cmd_encode += ["-vf", vf_filter]

                # CRF 16 = near-lossless quality (lower CRF = higher quality; 0=lossless, 51=worst)
                # preset slow = best compression efficiency at target bitrate (more detail preserved)
                cmd_encode += [
                    "-c:v", "libx264", "-preset", "slow", "-crf", "16",
                    "-b:v", video_bitrate,
                    "-maxrate", str(int(video_bitrate.replace("M", "")) * 2) + "M",
                    "-bufsize", str(int(video_bitrate.replace("M", "")) * 4) + "M",
                    "-c:a", "aac", "-b:a", audio_bitrate,
                    "-movflags", "+faststart",   # Web-optimized: allows streaming while downloading
                    clip_path
                ]
                try:
                    res = subprocess.run(cmd_encode, capture_output=True, timeout=120)
                    if res.returncode == 0 and os.path.exists(clip_path):
                        success = True
                except Exception as e:
                    print(f"[VideoEngine] Trim clip {idx} error: {e}")

            if success and os.path.exists(clip_path):
                trimmed_file_paths.append(clip_path)
                results.append({
                    "clip_number": idx,
                    "filename": clip_name,
                    "path": clip_path,
                    "download_url": f"/api/exports/trimmed/{clip_name}",
                    "start_sec": start_sec,
                    "end_sec": end_sec,
                    "duration": round(duration, 2),
                    "status": "success"
                })
            else:
                results.append({
                    "clip_number": idx,
                    "filename": clip_name,
                    "start_sec": start_sec,
                    "end_sec": end_sec,
                    "duration": round(duration, 2),
                    "status": "failed",
                    "error": "FFmpeg trimming failed"
                })

        combined_url = None
        if merge_all and len(trimmed_file_paths) > 0:
            combined_name = f"Merged_Sequence_{base_name}_{timestamp_id}.mp4"
            combined_path = os.path.join(output_dir, combined_name)

            concat_txt = os.path.join(output_dir, f"concat_{timestamp_id}.txt")
            with open(concat_txt, "w", encoding="utf-8") as f:
                for p in trimmed_file_paths:
                    escaped_p = p.replace("\\", "/")
                    f.write(f"file '{escaped_p}'\n")

            cmd_concat = [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", concat_txt, "-c", "copy", combined_path
            ]
            try:
                res = subprocess.run(cmd_concat, capture_output=True, timeout=300)
                if res.returncode == 0 and os.path.exists(combined_path):
                    combined_url = f"/api/exports/trimmed/{combined_name}"
            except Exception as e:
                print(f"[VideoEngine] Concat clips error: {e}")
            finally:
                if os.path.exists(concat_txt):
                    try: os.unlink(concat_txt)
                    except Exception: pass

        return {
            "success": True,
            "total_clips": len(results),
            "clips": results,
            "combined_url": combined_url
        }

    @staticmethod
    def detect_speech_segments(
        video_path: str,
        noise_db: float = -30.0,
        min_silence_duration: float = 0.6,
    ) -> List[Dict[str, float]]:
        """Auto-detect non-silent speech intervals in video using FFmpeg silencedetect."""
        if not os.path.exists(video_path):
            return []

        cmd = [
            "ffmpeg", "-i", video_path,
            "-af", f"silencedetect=noise={noise_db}dB:d={min_silence_duration}",
            "-f", "null", "-"
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            stderr = res.stderr or ""
        except Exception:
            return []

        # Parse ffmpeg silencedetect logs
        # [silencedetect @ ...] silence_start: 12.45
        # [silencedetect @ ...] silence_end: 14.80 | silence_duration: 2.35
        silence_starts = []
        silence_ends = []

        for line in stderr.splitlines():
            if "silence_start:" in line:
                m = re.search(r"silence_start:\s*([\d.]+)", line)
                if m:
                    silence_starts.append(float(m.group(1)))
            elif "silence_end:" in line:
                m = re.search(r"silence_end:\s*([\d.]+)", line)
                if m:
                    silence_ends.append(float(m.group(1)))

        # Get total video duration
        total_duration = 100.0
        try:
            probe_cmd = [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ]
            p_res = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
            total_duration = float(p_res.stdout.strip())
        except Exception:
            pass

        # Convert silence intervals into speech intervals
        speech_segments = []
        current_time = 0.0

        for i in range(min(len(silence_starts), len(silence_ends))):
            s_start = silence_starts[i]
            s_end = silence_ends[i]

            if s_start > current_time + 0.3:
                speech_segments.append({
                    "start_sec": round(current_time, 2),
                    "end_sec": round(s_start, 2),
                    "duration": round(s_start - current_time, 2)
                })
            current_time = s_end

        if current_time < total_duration - 0.3:
            speech_segments.append({
                "start_sec": round(current_time, 2),
                "end_sec": round(total_duration, 2),
                "duration": round(total_duration - current_time, 2)
            })

        return speech_segments

    @staticmethod
    def package_clips_to_zip(clip_paths: List[str], zip_output_path: str) -> bool:
        """Compress a list of clip video paths into a single ZIP archive."""
        import zipfile
        os.makedirs(os.path.dirname(zip_output_path), exist_ok=True)
        try:
            with zipfile.ZipFile(zip_output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                for p in clip_paths:
                    if os.path.exists(p):
                        zipf.write(p, arcname=os.path.basename(p))
            return os.path.exists(zip_output_path)
        except Exception as e:
            print(f"[VideoEngine] Zip creation error: {e}")
            return False

    @staticmethod
    def build_bypass_filters(settings: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
        """
        Build FFmpeg -vf and -af filter chains from a copyright bypass settings dict.
        Returns (video_filter_string, audio_filter_string) — either may be None.
        """
        vf_parts: List[str] = []
        af_parts: List[str] = []

        # ── Visual Filters ──────────────────────────────────────────────────

        # Horizontal Flip
        if settings.get("flip"):
            vf_parts.append("hflip")

        # Slight Zoom (1.01x - 1.08x): scale up, then crop back to original size
        zoom = float(settings.get("zoom", 0))
        if zoom > 1.0:
            zoom = max(1.01, min(1.08, zoom))
            # Use trunc() to guarantee integer dimensions — prevents FFmpeg "odd dimension" errors
            vf_parts.append(
                f"scale=trunc(iw*{zoom:.4f}/2)*2:trunc(ih*{zoom:.4f}/2)*2,"
                f"crop=iw:ih"
            )

        # Hue Shift + Saturation — merged into single hue filter (two calls would conflict)
        hue = float(settings.get("hue", 0))
        saturation = float(settings.get("saturation", 1.0))
        hue_args = []
        if hue != 0:
            hue_args.append(f"h={hue:.1f}")
        if abs(saturation - 1.0) > 0.01:
            sat_clamped = max(0.3, min(3.0, saturation))
            hue_args.append(f"s={sat_clamped:.2f}")
        if hue_args:
            vf_parts.append(f"hue={':'.join(hue_args)}")

        # Brightness & Contrast — use eq filter
        brightness = float(settings.get("brightness", 0.0))
        contrast = float(settings.get("contrast", 1.0))
        if abs(brightness) > 0.001 or abs(contrast - 1.0) > 0.001:
            b_clamped = max(-1.0, min(1.0, brightness))
            c_clamped = max(-1000.0, min(1000.0, contrast))
            vf_parts.append(f"eq=brightness={b_clamped:.3f}:contrast={c_clamped:.3f}")

        # Slight Rotation (degrees) — correct FFmpeg rotate filter syntax
        rotation = float(settings.get("rotation", 0))
        if rotation != 0:
            rad = rotation * 3.14159265 / 180.0
            vf_parts.append(f"rotate={rad:.6f}:c=black:ow=iw:oh=ih")

        # Gaussian Blur (sigma 0.1 - 2.0)
        blur = float(settings.get("blur", 0))
        if blur > 0:
            blur = max(0.1, min(2.0, blur))
            vf_parts.append(f"gblur=sigma={blur:.2f}")

        # Speed Change — video part: setpts (affects frame timing)
        speed = float(settings.get("speed", 1.0))
        if abs(speed - 1.0) > 0.005:
            speed = max(0.5, min(2.0, speed))
            pts_factor = 1.0 / speed
            vf_parts.append(f"setpts={pts_factor:.6f}*PTS")

        # Letterbox (add black bars top/bottom — standard cinematic bars)
        if settings.get("letterbox"):
            vf_parts.append("pad=iw:iw*9/16:(ow-iw)/2:(oh-ih)/2:color=black")

        # Color Grade (cinematic curves — warm highlights, cool shadows)
        if settings.get("color_grade"):
            vf_parts.append(
                "curves=r='0/0 0.25/0.22 0.5/0.52 0.75/0.78 1/1':"
                "g='0/0 0.25/0.23 0.5/0.5 0.75/0.77 1/1':"
                "b='0/0.04 0.25/0.25 0.5/0.5 0.75/0.76 1/0.97'"
            )

        # ── Audio Filters ───────────────────────────────────────────────────

        # Pitch Shift: use atempo chain for speed-independent pitch shift
        # We change sample rate then resample back — this shifts pitch without changing duration
        pitch_semitones = float(settings.get("pitch_semitones", 0))
        if pitch_semitones != 0:
            pitch_semitones = max(-6.0, min(6.0, pitch_semitones))
            factor = 2.0 ** (pitch_semitones / 12.0)
            factor_clamped = max(0.5, min(2.0, factor))
            inv_clamped = max(0.5, min(2.0, 1.0 / factor_clamped))
            # asetrate shifts pitch, aresample restores sample rate, atempo corrects duration
            af_parts.append(
                f"asetrate=48000*{factor_clamped:.6f},"
                f"aresample=48000,"
                f"atempo={inv_clamped:.6f}"
            )

        # Speed/Tempo change — audio part (only when not using pitch shift, to avoid double tempo)
        elif abs(speed - 1.0) > 0.005:
            tempo = max(0.5, min(2.0, speed))
            # atempo only accepts 0.5-2.0; chain two filters for extremes
            if tempo < 0.5:
                af_parts.append(f"atempo=0.5,atempo={tempo/0.5:.4f}")
            elif tempo > 2.0:
                af_parts.append(f"atempo=2.0,atempo={tempo/2.0:.4f}")
            else:
                af_parts.append(f"atempo={tempo:.4f}")

        # Background Noise / Audio Signature Dither (subtle bass/treble shift)
        if settings.get("bg_noise"):
            af_parts.append("bass=g=1.5:f=80:w=0.5,treble=g=-1.0:f=12000")

        # EQ Low-pass: roll off highs above 12kHz (changes audio fingerprint)
        if settings.get("eq_lowpass"):
            af_parts.append("lowpass=f=12000,highpass=f=60")

        # Volume Normalization
        if settings.get("normalize"):
            af_parts.append("dynaudnorm=f=150:g=15")

        # Stereo Remix (changes channel matrix)
        if settings.get("stereo_remix"):
            af_parts.append("pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1")

        # Subtle Reverb (echo)
        if settings.get("reverb"):
            af_parts.append("aecho=0.8:0.88:60:0.4")

        vf = ",".join(vf_parts) if vf_parts else None
        af = ",".join(af_parts) if af_parts else None

        return vf, af

    @staticmethod
    def apply_copyright_bypass(
        video_path: str,
        settings: Dict[str, Any],
        output_dir: str,
        start_sec: float = 0.0,
        end_sec: float = 0.0,
        preview_duration: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Apply copyright bypass transformations to a video (or clip segment / preview sample).
        Returns dict with output_path, download_url, success.
        """
        if not os.path.exists(video_path):
            return {"success": False, "error": f"Source video not found: {video_path}"}

        os.makedirs(output_dir, exist_ok=True)

        base_name = os.path.splitext(os.path.basename(video_path))[0]
        ts = int(time.time())
        tag = "Preview_" if preview_duration > 0 else "Bypass_"
        out_name = f"{tag}{base_name}_{ts}.mp4"
        out_path = os.path.join(output_dir, out_name)

        vf, af = VideoSyncEngine.build_bypass_filters(settings)

        # Probe audio stream — if no audio, skip all audio filters
        has_audio = False
        try:
            probe = subprocess.run([
                "ffprobe", "-v", "error",
                "-select_streams", "a",
                "-show_entries", "stream=codec_type",
                "-of", "csv=p=0", video_path
            ], capture_output=True, text=True, timeout=10)
            has_audio = "audio" in probe.stdout.strip()
        except Exception:
            has_audio = False

        if not has_audio:
            af = None

        cmd = ["ffmpeg", "-y"]

        # Seek / clip range
        if preview_duration > 0:
            cmd += ["-ss", f"{start_sec:.3f}", "-t", f"{preview_duration:.3f}"]
            # Add preview scale filter cleanly
            preview_scale = "scale=1280:-2:force_original_aspect_ratio=decrease"
            vf = f"{vf},{preview_scale}" if vf else preview_scale
        elif start_sec > 0 or end_sec > 0:
            cmd += ["-ss", f"{start_sec:.3f}", "-to", f"{end_sec:.3f}"]

        cmd += ["-i", video_path]

        if vf:
            cmd += ["-vf", vf]
        if af and has_audio:
            cmd += ["-af", af]

        # Use ultrafast preset and all CPU threads for 5x-10x rendering speed
        cmd += [
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "fastdecode",
            "-threads", "0",
            "-crf", "22",
        ]

        if has_audio:
            cmd += ["-c:a", "aac", "-ac", "2", "-b:a", "192k"]
        else:
            cmd += ["-an"]

        cmd += ["-movflags", "+faststart", out_path]

        # Timeout: 120s for preview/clips, 3600s (1 hour) for full movie
        timeout_sec = 120 if preview_duration > 0 else 3600

        try:
            result = subprocess.run(cmd, capture_output=True, timeout=timeout_sec)
            if result.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 100:
                return {
                    "success": True,
                    "output_path": out_path,
                    "filename": out_name,
                    "download_url": f"/api/exports/trimmed/{out_name}",
                }
            else:
                stderr = result.stderr.decode("utf-8", errors="replace")[-800:]
                print(f"[VideoEngine] Bypass FFmpeg error:\n{stderr}")
                return {"success": False, "error": f"FFmpeg failed: {stderr}"}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"Processing timeout ({timeout_sec}s)"}
        except Exception as e:
            print(f"[VideoEngine] Bypass exception: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_bypass_preset(profile: str) -> Dict[str, Any]:
        """Return a preset settings dict for the given profile name."""
        presets = {
            "light": {
                "flip": True,
                "hue": 10,
                "pitch_semitones": 2,
            },
            "medium": {
                "zoom": 1.03,
                "color_grade": True,
                "pitch_semitones": 3,
                "speed": 1.02,
                "normalize": True,
            },
            "heavy": {
                "flip": True,
                "zoom": 1.05,
                "rotation": 0.8,
                "blur": 0.3,
                "pitch_semitones": 5,
                "bg_noise": True,
                "speed": 0.97,
                "eq_lowpass": True,
                "stereo_remix": True,
            },
            "cinematic": {
                "color_grade": True,
                "letterbox": True,
                "normalize": True,
                "reverb": True,
                "hue": 8,
                "saturation": 1.1,
                "contrast": 1.05,
            },
        }
        return presets.get(profile.lower(), {})


class VideoJobManager:
    """Manages asynchronous background video rendering tasks with status polling."""

    def __init__(self):
        import threading
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def start_bypass_job(
        self,
        video_path: str,
        settings: Dict[str, Any],
        output_dir: str,
        start_sec: float = 0.0,
        end_sec: float = 0.0,
        preview_duration: float = 0.0,
        profile: str = "custom",
    ) -> str:
        import threading
        import uuid

        job_id = f"vjob_{uuid.uuid4().hex[:12]}"
        job_info = {
            "id": job_id,
            "status": "processing",
            "progress_pct": 10,
            "profile": profile,
            "created_at": time.time(),
            "result": None,
            "error": None,
        }

        with self._lock:
            self._jobs[job_id] = job_info

        def _worker():
            print(f"[VideoJob] Started async job {job_id} for {os.path.basename(video_path)}")
            try:
                res = VideoSyncEngine.apply_copyright_bypass(
                    video_path=video_path,
                    settings=settings,
                    output_dir=output_dir,
                    start_sec=start_sec,
                    end_sec=end_sec,
                    preview_duration=preview_duration,
                )
                with self._lock:
                    if res.get("success"):
                        self._jobs[job_id]["status"] = "completed"
                        self._jobs[job_id]["progress_pct"] = 100
                        self._jobs[job_id]["result"] = res
                        print(f"[VideoJob] Completed async job {job_id}: {res.get('filename')}")
                    else:
                        self._jobs[job_id]["status"] = "failed"
                        self._jobs[job_id]["error"] = res.get("error", "Bypass failed")
                        print(f"[VideoJob] Failed async job {job_id}: {res.get('error')}")
            except Exception as e:
                with self._lock:
                    self._jobs[job_id]["status"] = "failed"
                    self._jobs[job_id]["error"] = str(e)
                print(f"[VideoJob] Exception in async job {job_id}: {e}")

        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        return job_id

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._jobs.get(job_id)


video_engine = VideoSyncEngine()
video_job_manager = VideoJobManager()


