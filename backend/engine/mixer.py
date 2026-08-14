import numpy as np
from typing import Optional


class BackgroundMusicMixer:
    """Mix narration audio with background music using NumPy (no FFmpeg required)."""

    @staticmethod
    def load_wav_as_float32(wav_path: str):
        """Load a WAV file and return (float32_array, sample_rate)."""
        from scipy.io import wavfile
        sr, data = wavfile.read(wav_path)
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / 2147483648.0
        elif data.dtype != np.float32:
            data = data.astype(np.float32)
        # Convert stereo to mono if needed
        if data.ndim == 2:
            data = data.mean(axis=1)
        return data, sr

    @staticmethod
    def resample_to_match(audio: np.ndarray, src_sr: int, target_sr: int) -> np.ndarray:
        """Simple linear resampling to match sample rates."""
        if src_sr == target_sr:
            return audio
        ratio = target_sr / src_sr
        new_length = int(len(audio) * ratio)
        indices = np.linspace(0, len(audio) - 1, new_length)
        return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)

    def mix(
        self,
        voice_audio: np.ndarray,
        voice_sr: int,
        music_path: str,
        voice_volume: float = 1.0,
        music_volume: float = 0.15,
        duck_under_speech: bool = True,
        ducking_factor: float = 0.4,
        fade_music_out_ms: int = 1500,
    ) -> np.ndarray:
        """
        Mix voice narration with background music.
        Returns mixed float32 audio at voice_sr sample rate.
        """
        try:
            music_raw, music_sr = self.load_wav_as_float32(music_path)
        except Exception as e:
            print(f"[Mixer] Cannot load music file: {e}")
            return voice_audio * voice_volume

        # Resample music to match voice sample rate
        music = self.resample_to_match(music_raw, music_sr, voice_sr)

        # Loop music to match voice length
        voice_len = len(voice_audio)
        if len(music) < voice_len:
            repeats = int(np.ceil(voice_len / len(music)))
            music = np.tile(music, repeats)
        music = music[:voice_len]

        # Apply ducking: reduce music where voice is louder than silence
        if duck_under_speech:
            voice_envelope = np.abs(voice_audio)
            # Smooth envelope
            window = max(1, int(voice_sr * 0.05))
            if window > 1:
                kernel = np.ones(window) / window
                voice_envelope = np.convolve(voice_envelope, kernel, mode='same')
            speech_mask = (voice_envelope > 0.02).astype(np.float32)
            music_gain = np.where(speech_mask, music_volume * ducking_factor, music_volume)
        else:
            music_gain = np.full(voice_len, music_volume, dtype=np.float32)

        # Fade music out at the end
        fade_samples = int(voice_sr * (fade_music_out_ms / 1000.0))
        if fade_samples > 0 and fade_samples < voice_len:
            fade = np.linspace(1.0, 0.0, fade_samples)
            music_gain[-fade_samples:] *= fade

        mixed = (voice_audio * voice_volume) + (music * music_gain)

        # Normalize to prevent clipping
        peak = np.max(np.abs(mixed))
        if peak > 0.98:
            mixed = mixed * (0.98 / peak)

        return mixed.astype(np.float32)


mixer = BackgroundMusicMixer()
