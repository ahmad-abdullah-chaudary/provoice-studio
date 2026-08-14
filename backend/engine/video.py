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




video_engine = VideoSyncEngine()
