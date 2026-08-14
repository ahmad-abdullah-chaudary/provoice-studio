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

        # Determine target resolution & video filter if requested
        vf_filter = None
        bitrate = "192k"
        video_bitrate = "8M"

        if export_quality == "2k":
            video_bitrate = "16M"
            if aspect_fit == "mobile_9_16":
                vf_filter = "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560"
            elif aspect_fit == "square_1_1":
                vf_filter = "scale=1440:1440:force_original_aspect_ratio=increase,crop=1440:1440"
            else:
                vf_filter = "scale=2560:1440:force_original_aspect_ratio=decrease,pad=2560:1440:(ow-iw)/2:(oh-ih)/2"
        elif export_quality == "4k":
            video_bitrate = "32M"
            if aspect_fit == "mobile_9_16":
                vf_filter = "scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840"
            elif aspect_fit == "square_1_1":
                vf_filter = "scale=2160:2160:force_original_aspect_ratio=increase,crop=2160:2160"
            else:
                vf_filter = "scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2"
        elif export_quality == "1080p":
            video_bitrate = "8M"
            if aspect_fit == "mobile_9_16":
                vf_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
            elif aspect_fit == "square_1_1":
                vf_filter = "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080"
            else:
                vf_filter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
        elif aspect_fit == "mobile_9_16":
            vf_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        elif aspect_fit == "square_1_1":
            vf_filter = "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080"

        for idx, item in enumerate(ranges, start=1):
            start_sec = float(item.get("start_sec", 0.0))
            end_sec = float(item.get("end_sec", 0.0))
            duration = max(0.0, end_sec - start_sec)

            clip_name = f"Clip_{idx}_{base_name}_{timestamp_id}.mp4"
            clip_path = os.path.join(output_dir, clip_name)

            success = False

            # ALWAYS try fast stream copy first for 0-second instant trimming (unless custom scaling filter is requested)
            if not vf_filter or export_quality == "original":
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

            # Fast Ultrafast Re-encode fallback
            if not success:
                cmd_encode = [
                    "ffmpeg", "-y",
                    "-ss", f"{start_sec:.3f}",
                    "-to", f"{end_sec:.3f}",
                    "-i", video_path,
                ]
                if vf_filter:
                    cmd_encode += ["-vf", vf_filter]

                cmd_encode += [
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
                    "-c:a", "aac", "-b:a", "192k",
                    clip_path
                ]
                try:
                    res = subprocess.run(cmd_encode, capture_output=True, timeout=30)
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


video_engine = VideoSyncEngine()


