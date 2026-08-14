import numpy as np
from scipy import signal
from typing import Dict, Any, Tuple

class AudioDSPPipeline:
    """Studio Quality Pure Python Audio Signal Processing Pipeline using NumPy & SciPy.
    
    Features (v2 — Studio Grade):
      - Silence Trimming
      - Noise Gate
      - 3-Band Parametric Equalizer
      - Dynamic Compressor
      - Peak Limiter
      - Peak Normalization
      - LUFS Broadcast Normalization  ← NEW (EBU R128 standard)
      - De-Esser                      ← NEW (sibilance control 4–9kHz)
      - Harmonic Exciter              ← NEW (analog tube warmth)
      - Breath Injection              ← NEW (natural paragraph breaths)
      - Fade In/Out
    """

    # ─── Existing Processors ──────────────────────────────────────────────────

    @staticmethod
    def silence_trim(
        audio: np.ndarray,
        sample_rate: int,
        threshold_db: float = -45.0,
        min_silence_duration_ms: int = 100
    ) -> np.ndarray:
        """Trim leading and trailing silence below threshold dB."""
        if audio.size == 0:
            return audio

        abs_audio = np.abs(audio)
        threshold_linear = 10 ** (threshold_db / 20.0)

        non_silent_indices = np.where(abs_audio > threshold_linear)[0]
        if non_silent_indices.size == 0:
            return audio

        start_idx = max(0, non_silent_indices[0] - int(sample_rate * 0.02))
        end_idx = min(audio.size, non_silent_indices[-1] + int(sample_rate * 0.02))

        return audio[start_idx:end_idx]

    @staticmethod
    def noise_gate(
        audio: np.ndarray,
        threshold_db: float = -50.0,
        ratio: float = 4.0
    ) -> np.ndarray:
        """Attenuate signals below noise gate threshold."""
        if audio.size == 0:
            return audio

        threshold_linear = 10 ** (threshold_db / 20.0)
        abs_audio = np.abs(audio)

        gain = np.ones_like(audio)
        mask = abs_audio < threshold_linear
        gain[mask] = (abs_audio[mask] / (threshold_linear + 1e-9)) ** (ratio - 1.0)
        return audio * gain

    @staticmethod
    def equalizer(
        audio: np.ndarray,
        sample_rate: int,
        bass_gain_db: float = 0.0,
        presence_gain_db: float = 0.0,
        treble_gain_db: float = 0.0
    ) -> np.ndarray:
        """3-Band Parametric Equalizer (Low Shelf 200Hz, Mid Peak 3kHz, High Shelf 8kHz)."""
        if audio.size == 0 or (bass_gain_db == 0 and presence_gain_db == 0 and treble_gain_db == 0):
            return audio

        nyquist = sample_rate / 2.0
        out_audio = np.copy(audio)

        if bass_gain_db != 0:
            gain_lin = 10 ** (bass_gain_db / 20.0)
            b, a = signal.butter(2, 200 / nyquist, btype='lowpass')
            low_freqs = signal.filtfilt(b, a, out_audio)
            out_audio = out_audio + (gain_lin - 1.0) * low_freqs

        if presence_gain_db != 0:
            gain_lin = 10 ** (presence_gain_db / 20.0)
            b, a = signal.butter(2, [2500 / nyquist, 4000 / nyquist], btype='bandpass')
            mid_freqs = signal.filtfilt(b, a, out_audio)
            out_audio = out_audio + (gain_lin - 1.0) * mid_freqs

        if treble_gain_db != 0:
            gain_lin = 10 ** (treble_gain_db / 20.0)
            b, a = signal.butter(2, 7000 / nyquist, btype='highpass')
            high_freqs = signal.filtfilt(b, a, out_audio)
            out_audio = out_audio + (gain_lin - 1.0) * high_freqs

        return out_audio

    @staticmethod
    def compressor(
        audio: np.ndarray,
        threshold_db: float = -18.0,
        ratio: float = 3.0,
        knee_db: float = 2.0,
        attack_ms: float = 5.0,
        release_ms: float = 80.0,
        sample_rate: int = 24000,
    ) -> np.ndarray:
        """Dynamic range compressor with attack/release smoothing for voice consistency."""
        if audio.size == 0 or ratio <= 1.0:
            return audio

        abs_audio = np.abs(audio)
        db_audio = 20.0 * np.log10(np.maximum(abs_audio, 1e-7))

        # Attack/release envelope
        attack_coeff = np.exp(-1.0 / (attack_ms * sample_rate / 1000.0))
        release_coeff = np.exp(-1.0 / (release_ms * sample_rate / 1000.0))
        gain_db = np.zeros_like(db_audio)
        env = 0.0
        for i in range(len(db_audio)):
            level = db_audio[i]
            if level > threshold_db:
                target_gain = (threshold_db - level) * (1.0 - 1.0 / ratio)
            else:
                target_gain = 0.0
            coeff = attack_coeff if target_gain < env else release_coeff
            env = coeff * env + (1.0 - coeff) * target_gain
            gain_db[i] = env

        gain_linear = 10.0 ** (gain_db / 20.0)
        return audio * gain_linear

    @staticmethod
    def limiter(
        audio: np.ndarray,
        ceiling_db: float = -0.5
    ) -> np.ndarray:
        """Peak limiter to prevent clipping/distortion."""
        if audio.size == 0:
            return audio

        ceiling_linear = 10 ** (ceiling_db / 20.0)
        peak = np.max(np.abs(audio))

        if peak > ceiling_linear:
            audio = audio * (ceiling_linear / peak)

        return np.clip(audio, -ceiling_linear, ceiling_linear)

    @staticmethod
    def normalize(
        audio: np.ndarray,
        target_peak_db: float = -1.0
    ) -> np.ndarray:
        """Peak normalization."""
        if audio.size == 0:
            return audio

        peak = np.max(np.abs(audio))
        if peak > 1e-7:
            target_linear = 10 ** (target_peak_db / 20.0)
            return audio * (target_linear / peak)
        return audio

    @staticmethod
    def fade(
        audio: np.ndarray,
        sample_rate: int,
        fade_in_ms: int = 10,
        fade_out_ms: int = 20
    ) -> np.ndarray:
        """Apply smooth cosine fade-in and fade-out (sounds more natural than linear)."""
        if audio.size == 0:
            return audio

        out = np.copy(audio)
        fade_in_samples = min(int(sample_rate * (fade_in_ms / 1000.0)), audio.size // 2)
        fade_out_samples = min(int(sample_rate * (fade_out_ms / 1000.0)), audio.size // 2)

        # Cosine fade (more natural than linear)
        if fade_in_samples > 0:
            t = np.linspace(0.0, np.pi / 2, fade_in_samples)
            out[:fade_in_samples] *= np.sin(t)

        if fade_out_samples > 0:
            t = np.linspace(np.pi / 2, 0.0, fade_out_samples)
            out[-fade_out_samples:] *= np.sin(t)

        return out

    # ─── NEW: LUFS Broadcast Normalization ────────────────────────────────────

    @staticmethod
    def lufs_normalize(
        audio: np.ndarray,
        sample_rate: int,
        target_lufs: float = -14.0
    ) -> np.ndarray:
        """EBU R128 LUFS Loudness Normalization — broadcast industry standard.
        
        Platform targets:
          -14 LUFS  → YouTube / Spotify / Apple Music
          -16 LUFS  → Podcasts / SoundCloud
          -23 LUFS  → Broadcast TV / Netflix
          -12 LUFS  → Instagram Reels / WhatsApp
        """
        if audio.size == 0:
            return audio

        nyq = sample_rate / 2.0

        # Stage 1: K-weighting pre-filter (high-frequency shelf boost)
        # Mimics the EBU R128 pre-filter at ~1.5kHz
        b_pre, a_pre = signal.butter(1, min(1500.0 / nyq, 0.99), btype='highpass')
        pre_filtered = signal.filtfilt(b_pre, a_pre, audio.astype(np.float64))

        # Stage 2: RLB (Revised Low-frequency B-curve) weighting
        b_rlb, a_rlb = signal.butter(2, min(38.0 / nyq, 0.5), btype='highpass')
        k_weighted = signal.filtfilt(b_rlb, a_rlb, pre_filtered)

        # Stage 3: Gated integrated loudness (gate at -70 LUFS absolute)
        block_size = int(sample_rate * 0.4)   # 400ms analysis blocks
        hop_size = int(sample_rate * 0.1)      # 100ms hop

        if len(k_weighted) < block_size:
            # Too short — just use full RMS
            rms = np.sqrt(np.mean(k_weighted ** 2))
        else:
            block_powers = []
            for start in range(0, len(k_weighted) - block_size, hop_size):
                block = k_weighted[start: start + block_size]
                block_power = np.mean(block ** 2)
                if block_power > 1e-10:  # absolute gate ~-70 LUFS
                    block_powers.append(block_power)

            if not block_powers:
                return audio

            rms = np.sqrt(np.mean(block_powers))

        if rms < 1e-9:
            return audio

        # Convert RMS to approximate LUFS
        measured_lufs = -0.691 + 10.0 * np.log10(rms + 1e-9)
        gain_db = target_lufs - measured_lufs
        gain_linear = 10.0 ** (gain_db / 20.0)

        # Safety: never boost more than +30 dB to avoid runaway gain on silence
        gain_linear = min(gain_linear, 31.62)

        result = audio * gain_linear
        # Final peak safety clip
        return np.clip(result, -1.0, 1.0).astype(np.float32)

    # ─── NEW: De-Esser ────────────────────────────────────────────────────────

    @staticmethod
    def de_esser(
        audio: np.ndarray,
        sample_rate: int,
        threshold_db: float = -22.0,
        ratio: float = 5.0,
        freq_low: float = 4000.0,
        freq_high: float = 9000.0,
    ) -> np.ndarray:
        """Frequency-selective dynamic processor that tames sibilant 'sss' sounds.
        
        Targets 4–9kHz range where AI TTS voices have harshest sibilance.
        Only applies gain reduction when sibilant energy exceeds threshold —
        transparent on normal speech, active on S/SH/CH consonants.
        """
        if audio.size == 0:
            return audio

        nyq = sample_rate / 2.0
        lo = min(freq_low / nyq, 0.97)
        hi = min(freq_high / nyq, 0.99)

        if lo >= hi:
            return audio

        # Extract sibilant band
        b, a = signal.butter(4, [lo, hi], btype='bandpass')
        sibilant = signal.filtfilt(b, a, audio.astype(np.float64))

        # Smooth envelope detection (10ms RMS)
        env_window = max(1, int(sample_rate * 0.010))
        envelope = np.sqrt(
            np.convolve(sibilant ** 2, np.ones(env_window) / env_window, mode='same')
        )

        threshold_linear = 10 ** (threshold_db / 20.0)

        # Per-sample gain reduction (only where sibilant is over threshold)
        gain = np.ones(len(audio), dtype=np.float64)
        over = envelope > threshold_linear
        gain[over] = (threshold_linear / (envelope[over] + 1e-9)) ** (1.0 - 1.0 / ratio)

        # Smooth the gain curve (5ms) to avoid clicks
        smooth_window = max(1, int(sample_rate * 0.005))
        gain = np.convolve(gain, np.ones(smooth_window) / smooth_window, mode='same')

        return (audio * gain).astype(np.float32)

    # ─── NEW: Harmonic Exciter ────────────────────────────────────────────────

    @staticmethod
    def harmonic_exciter(
        audio: np.ndarray,
        sample_rate: int,
        amount: float = 0.18,
        freq_start: float = 2500.0,
    ) -> np.ndarray:
        """Analog tube-style harmonic exciter — adds warm 2nd-order harmonics.
        
        Processes only the high-mid band (2.5kHz+) through soft tanh saturation,
        generating musically pleasing 2nd harmonics that add presence and warmth.
        Mimics the effect of running audio through a tube preamp.
        
        amount: 0.0 (off) → 0.30 (heavy saturation). Default 0.18 is subtle but audible.
        """
        if audio.size == 0 or amount <= 0.0:
            return audio

        nyq = sample_rate / 2.0
        cutoff = min(freq_start / nyq, 0.95)

        # Extract high-mid band for excitement
        b, a = signal.butter(2, cutoff, btype='highpass')
        high_band = signal.filtfilt(b, a, audio.astype(np.float64))

        # Soft saturation: tanh generates warm 2nd + 3rd harmonics
        drive = 1.0 + amount * 4.0
        saturated = np.tanh(high_band * drive) / drive

        # Mix excited signal back: original + (excited - original) * amount
        harmonic_layer = (saturated - high_band) * amount
        result = audio + harmonic_layer.astype(np.float32)

        # Prevent any clipping introduced by added harmonics
        peak = np.max(np.abs(result))
        if peak > 0.99:
            result = result * (0.99 / peak)

        return result.astype(np.float32)

    # ─── NEW: Breath Injection ────────────────────────────────────────────────

    @staticmethod
    def generate_breath(
        sample_rate: int,
        duration_ms: int = 90,
        amplitude: float = 0.012,
        gender: str = "neutral"
    ) -> np.ndarray:
        """Synthesize a naturalistic inhalation breath sound.
        
        Uses bandpass-filtered pink noise with an ADSR-style envelope.
        gender='female' gives a lighter breath, 'male' gives a slightly deeper one.
        """
        n = int(sample_rate * duration_ms / 1000)
        if n <= 0:
            return np.zeros(0, dtype=np.float32)

        # Pink noise (1/f) approximation via filtered white noise
        rng = np.random.default_rng()
        white = rng.standard_normal(n).astype(np.float64)

        # Bandpass for breath formant range
        nyq = sample_rate / 2.0
        if gender == "female":
            lo, hi = 300.0 / nyq, min(3500.0 / nyq, 0.98)
        elif gender == "male":
            lo, hi = 150.0 / nyq, min(2500.0 / nyq, 0.98)
        else:
            lo, hi = 200.0 / nyq, min(3000.0 / nyq, 0.98)

        b, a = signal.butter(3, [lo, hi], btype='bandpass')
        breath_raw = signal.filtfilt(b, a, white)

        # ADSR envelope: attack 15%, sustain 55%, release 30%
        attack_end = int(n * 0.15)
        sustain_end = int(n * 0.70)
        env = np.ones(n, dtype=np.float64)
        env[:attack_end] = np.linspace(0.0, 1.0, attack_end)
        env[sustain_end:] = np.linspace(1.0, 0.0, n - sustain_end)

        breath = (breath_raw * env * amplitude).astype(np.float32)

        # Normalize to consistent amplitude
        peak = np.max(np.abs(breath))
        if peak > 1e-7:
            breath = breath * (amplitude / peak)

        return breath

    # ─── Main Process Pipeline ────────────────────────────────────────────────

    def process(self, audio: np.ndarray, sample_rate: int, settings: Dict[str, Any]) -> np.ndarray:
        """Execute full DSP audio processing pipeline.
        
        Pipeline order (signal-flow optimized):
          1. Silence Trim
          2. Noise Gate
          3. De-Esser          ← tame sibilance before EQ
          4. Equalizer         ← tone shaping
          5. Harmonic Exciter  ← add warmth after EQ
          6. Compressor        ← control dynamics
          7. Limiter           ← hard ceiling
          8. LUFS Normalize    ← broadcast loudness (if enabled)
          9. Peak Normalize    ← final peak level
          10. Fade In/Out      ← polish the edges
        """
        if audio.size == 0:
            return audio

        processed = np.copy(audio)

        # 1. Silence Trimming
        if settings.get("silence_trim", True):
            processed = self.silence_trim(processed, sample_rate)

        # 2. Noise Gate
        if settings.get("noise_gate", False):
            thresh = settings.get("noise_gate_threshold", -50.0)
            processed = self.noise_gate(processed, threshold_db=thresh)

        # 3. De-Esser (before EQ — treat the source first)
        if settings.get("de_esser", False):
            de_threshold = settings.get("de_esser_threshold", -22.0)
            de_ratio = settings.get("de_esser_ratio", 5.0)
            processed = self.de_esser(
                processed, sample_rate,
                threshold_db=de_threshold,
                ratio=de_ratio,
            )

        # 4. Equalizer
        if settings.get("equalizer", False):
            bass = settings.get("eq_bass", 0.0)
            mid = settings.get("eq_presence", 0.0)
            treble = settings.get("eq_treble", 0.0)
            processed = self.equalizer(
                processed, sample_rate,
                bass_gain_db=bass, presence_gain_db=mid, treble_gain_db=treble
            )

        # 5. Harmonic Exciter (after EQ — enhance the shaped tone)
        if settings.get("harmonic_exciter", False):
            exciter_amount = settings.get("harmonic_exciter_amount", 0.18)
            processed = self.harmonic_exciter(processed, sample_rate, amount=exciter_amount)

        # 6. Compressor
        if settings.get("compressor", False):
            thresh = settings.get("compressor_threshold", -18.0)
            ratio = settings.get("compressor_ratio", 3.0)
            processed = self.compressor(
                processed, threshold_db=thresh, ratio=ratio, sample_rate=sample_rate
            )

        # 7. Limiter
        if settings.get("limiter", True):
            ceiling = settings.get("limiter_ceiling", -0.5)
            processed = self.limiter(processed, ceiling_db=ceiling)

        # 8. LUFS Normalization (broadcast loudness standard)
        if settings.get("lufs_normalize", False):
            target_lufs = settings.get("lufs_target", -14.0)
            processed = self.lufs_normalize(processed, sample_rate, target_lufs=target_lufs)

        # 9. Peak Normalize (final gain staging after loudness norm)
        if settings.get("normalize", True):
            target = settings.get("normalize_peak", -1.0)
            processed = self.normalize(processed, target_peak_db=target)

        # 10. Fade In/Out
        if settings.get("fade", True):
            fade_in = settings.get("fade_in_ms", 10)
            fade_out = settings.get("fade_out_ms", 20)
            processed = self.fade(processed, sample_rate, fade_in_ms=fade_in, fade_out_ms=fade_out)

        return processed


# Global DSP Pipeline Instance
dsp_pipeline = AudioDSPPipeline()
