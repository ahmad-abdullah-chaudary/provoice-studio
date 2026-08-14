import os
import wave
import subprocess
import numpy as np
from scipy.io import wavfile
from typing import Optional, Dict, Any

class AudioExporter:
    """Audio export manager for WAV, MP3, FLAC, and OGG formats."""

    @staticmethod
    def save_wav(audio: np.ndarray, sample_rate: int, output_path: str) -> bool:
        """Save float32 audio as 16-bit PCM WAV file."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Convert float32 [-1.0, 1.0] to 16-bit signed integer PCM [-32768, 32767]
        audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
        wavfile.write(output_path, sample_rate, audio_int16)
        return True

    @staticmethod
    def convert_format(wav_path: str, target_format: str, quality_preset: str = "Studio") -> str:
        """Convert WAV file to MP3/FLAC/OGG using ffmpeg if available."""
        target_format = target_format.lower()
        if target_format == "wav":
            return wav_path

        target_path = os.path.splitext(wav_path)[0] + f".{target_format}"
        
        bitrate_map = {
            "Draft": "128k",
            "Standard": "192k",
            "Studio": "320k",
            "Lossless": "320k"
        }
        bitrate = bitrate_map.get(quality_preset, "320k")

        cmd = ["ffmpeg", "-y", "-i", wav_path, "-b:a", bitrate, target_path]
        
        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            return target_path
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(f"[AudioExporter] ffmpeg not available. Fallback to WAV format.")
            return wav_path

audio_exporter = AudioExporter()
