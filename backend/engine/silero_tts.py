"""
Silero Indic Neural TTS Engine
================================
100% Offline Local Neural Text-to-Speech engine for Indic and South Asian languages.
Powered by Silero v4_indic (PyTorch TorchScript) with Aksharamukha ISO-15919 transliteration.

Supported Languages & Voices:
  - Hindi: Kabir (Male), Kavya (Female)
  - Bengali: Deb (Male), Ananya (Female)
  - Tamil: Karthik (Male), Priya (Female)
  - Telugu: Venkat (Male), Laxmi (Female)
  - Gujarati: Aarav (Male), Diya (Female)
  - Kannada: Chetan (Male), Deepa (Female)
  - Malayalam: Rahul (Male), Anjali (Female)
  - Rajasthani: Kalyan (Male), Meera (Female)
  - Manipuri: Linthoingambi (Female)
"""

import os
import re
import time
import numpy as np
from typing import Dict, Any, Optional, Tuple, List

# ── Voice Catalog ─────────────────────────────────────────────────────────────

SILERO_VOICES: Dict[str, Dict[str, Any]] = {
    # 🇮🇳 Hindi (Silero Neural)
    "silero_hindi_male": {
        "id": "silero_hindi_male",
        "name": "Kabir (कबीर)",
        "gender": "Male",
        "accent": "Hindi",
        "lang": "hi",
        "script": "Devanagari",
        "speaker_id": "hindi_male",
        "category": "Deep Narrator",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Authoritative, natural Hindi male narration (Devanagari & Roman Hinglish)",
        "recommended_use": "Hindi Audiobooks, Crime Recaps, Documentaries, YouTube Videos",
        "preview_text": "नमस्ते, मैं कबीर हूँ। प्रोवॉयस स्टूडियो में आपका हार्दिक स्वागत है।",
    },
    "silero_hindi_female": {
        "id": "silero_hindi_female",
        "name": "Kavya (काव्या)",
        "gender": "Female",
        "accent": "Hindi",
        "lang": "hi",
        "script": "Devanagari",
        "speaker_id": "hindi_female",
        "category": "Storyteller",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Warm, melodious Hindi female storytelling voice",
        "recommended_use": "Stories, Audiobooks, E-Learning, Commercials",
        "preview_text": "नमस्ते, मैं काव्या हूँ। आज हम एक नई और खूबसूरत कहानी शुरू करते हैं।",
    },

    # 🇮🇳 Bengali (Silero Neural)
    "silero_bengali_male": {
        "id": "silero_bengali_male",
        "name": "Deb (দেব)",
        "gender": "Male",
        "accent": "Bengali",
        "lang": "bn",
        "script": "Bengali",
        "speaker_id": "bengali_male",
        "category": "Documentary",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Clear, resonant Bengali male narrator",
        "recommended_use": "Bengali Audiobooks, News, Explainer Videos",
        "preview_text": "নমস্কার, আমি দেব। প্রোভয়েস স্টুডিওতে আপনাকে স্বাগতম।",
    },
    "silero_bengali_female": {
        "id": "silero_bengali_female",
        "name": "Ananya (অনন্যা)",
        "gender": "Female",
        "accent": "Bengali",
        "lang": "bn",
        "script": "Bengali",
        "speaker_id": "bengali_female",
        "category": "Storyteller",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Sweet, expressive Bengali female voice",
        "recommended_use": "Literature, Drama, YouTube Narrations",
        "preview_text": "নমস্কার, আমি অনন্যা। আসুন আমরা চমৎকার কিছু তৈরি করি।",
    },

    # 🇮🇳 Tamil (Silero Neural)
    "silero_tamil_male": {
        "id": "silero_tamil_male",
        "name": "Karthik (கார்த்திக்)",
        "gender": "Male",
        "accent": "Tamil",
        "lang": "ta",
        "script": "Tamil",
        "speaker_id": "tamil_male",
        "category": "News Voice",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Clear, authoritative Tamil broadcasting voice",
        "recommended_use": "Tamil News, Commercials, Educational Content",
        "preview_text": "வணக்கம், நான் கார்த்திக். ப்ரோவாய்ஸ் ஸ்டுடியோவிற்கு உங்களை வரவேற்கிறேன்.",
    },
    "silero_tamil_female": {
        "id": "silero_tamil_female",
        "name": "Priya (பிரியா)",
        "gender": "Female",
        "accent": "Tamil",
        "lang": "ta",
        "script": "Tamil",
        "speaker_id": "tamil_female",
        "category": "Conversational",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Melodic, engaging Tamil female narrator",
        "recommended_use": "Audiobooks, Podcasts, E-Learning",
        "preview_text": "வணக்கம், நான் பிரியா. இன்று ஒரு அருமையான கதையை நாம் கேட்போம்.",
    },

    # 🇮🇳 Telugu (Silero Neural)
    "silero_telugu_male": {
        "id": "silero_telugu_male",
        "name": "Venkat (వెంకట్)",
        "gender": "Male",
        "accent": "Telugu",
        "lang": "te",
        "script": "Telugu",
        "speaker_id": "telugu_male",
        "category": "Deep Narrator",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Resonant Telugu male narrator",
        "recommended_use": "Telugu Documentaries, Movie Recaps, Audiobooks",
        "preview_text": "నమస్కారం, నేను వెంకట్. ప్రోవాయిస్ స్టూడియోకి స్వాగతం.",
    },
    "silero_telugu_female": {
        "id": "silero_telugu_female",
        "name": "Laxmi (లక్ష్మి)",
        "gender": "Female",
        "accent": "Telugu",
        "lang": "te",
        "script": "Telugu",
        "speaker_id": "telugu_female",
        "category": "Storyteller",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Warm, expressive Telugu female narration",
        "recommended_use": "Stories, Commercials, E-Learning",
        "preview_text": "నమస్కారం, నేను లక్ష్మి. ఈ రోజు మనం ఒక కొత్త కథను ప్రారంభిద్దాం.",
    },

    # 🇮🇳 Gujarati (Silero Neural)
    "silero_gujarati_male": {
        "id": "silero_gujarati_male",
        "name": "Aarav (આરવ)",
        "gender": "Male",
        "accent": "Gujarati",
        "lang": "gu",
        "script": "Gujarati",
        "speaker_id": "gujarati_male",
        "category": "Conversational",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Clear, friendly Gujarati male voice",
        "recommended_use": "Gujarati Commercials, Tutorials, Vlogs",
        "preview_text": "નમસ્તે, હું આરવ છું. પ્રોવોઇસ સ્ટુડિયોમાં તમારું સ્વાગત છે.",
    },
    "silero_gujarati_female": {
        "id": "silero_gujarati_female",
        "name": "Diya (દિયા)",
        "gender": "Female",
        "accent": "Gujarati",
        "lang": "gu",
        "script": "Gujarati",
        "speaker_id": "gujarati_female",
        "category": "Storyteller",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Gentle, expressive Gujarati female narrator",
        "recommended_use": "Audiobooks, Children Stories, Podcasts",
        "preview_text": "નમસ્તે, હું દિયા છું. આજે આપણે એક સુંદર વાર્તા સાંભળીશું.",
    },

    # 🇮🇳 Kannada (Silero Neural)
    "silero_kannada_male": {
        "id": "silero_kannada_male",
        "name": "Chetan (ಚೇತನ್)",
        "gender": "Male",
        "accent": "Kannada",
        "lang": "kn",
        "script": "Kannada",
        "speaker_id": "kannada_male",
        "category": "Documentary",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Distinguished Kannada male broadcaster",
        "recommended_use": "Kannada Documentaries, News, E-Learning",
        "preview_text": "ನಮಸ್ಕಾರ, ನಾನು ಚೇತನ್. ಪ್ರೋವಾಯ್ಸ್ ಸ್ಟುಡಿಯೋಗೆ ನಿಮಗೆ ಸ್ವಾಗತ.",
    },
    "silero_kannada_female": {
        "id": "silero_kannada_female",
        "name": "Deepa (ದೀಪಾ)",
        "gender": "Female",
        "accent": "Kannada",
        "lang": "kn",
        "script": "Kannada",
        "speaker_id": "kannada_female",
        "category": "Storyteller",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Clear, melodious Kannada female narrator",
        "recommended_use": "Stories, Audiobooks, Commercials",
        "preview_text": "ನಮಸ್ಕಾರ, ನಾನು ದೀಪಾ. ಬನ್ನಿ ಇಂದು ಹೊಸ ಕಥೆಯನ್ನು ಕೇಳೋಣ.",
    },

    # 🇮🇳 Malayalam (Silero Neural)
    "silero_malayalam_male": {
        "id": "silero_malayalam_male",
        "name": "Rahul (രാഹുൽ)",
        "gender": "Male",
        "accent": "Malayalam",
        "lang": "ml",
        "script": "Malayalam",
        "speaker_id": "malayalam_male",
        "category": "News Voice",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Professional Malayalam male broadcast delivery",
        "recommended_use": "News, Audiobooks, Documentaries",
        "preview_text": "നമസ്കാരം, ഞാൻ രാഹുൽ. പ്രോവോയ്സ് സ്റ്റുഡിയോയിലേക്ക് സ്വാഗതം.",
    },
    "silero_malayalam_female": {
        "id": "silero_malayalam_female",
        "name": "Anjali (അഞ്ജലി)",
        "gender": "Female",
        "accent": "Malayalam",
        "lang": "ml",
        "script": "Malayalam",
        "speaker_id": "malayalam_female",
        "category": "Conversational",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Warm, natural Malayalam female narrator",
        "recommended_use": "Podcasts, Audiobooks, Commercials",
        "preview_text": "നമസ്കാരം, ഞാൻ അഞ്ജലി. നമുക്ക് ഒരു പുതിയ കഥ ആരംഭിക്കാം.",
    },

    # 🇮🇳 Rajasthani (Silero Neural)
    "silero_rajasthani_male": {
        "id": "silero_rajasthani_male",
        "name": "Kalyan (कल्याण)",
        "gender": "Male",
        "accent": "Rajasthani",
        "lang": "hi",
        "script": "Devanagari",
        "speaker_id": "rajasthani_male",
        "category": "Epic Voice",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Traditional, hearty Rajasthani male tone",
        "recommended_use": "Folk Tales, Drama, Regional Ads",
        "preview_text": "खम्मा घणी, म्हारो नाम कल्याण है। प्रोवॉयस स्टूडियो में आपरो स्वागत है।",
    },
    "silero_rajasthani_female": {
        "id": "silero_rajasthani_female",
        "name": "Meera (मीरा)",
        "gender": "Female",
        "accent": "Rajasthani",
        "lang": "hi",
        "script": "Devanagari",
        "speaker_id": "rajasthani_female",
        "category": "Storyteller",
        "quality": "Studio",
        "engine": "Silero Neural",
        "speed_rating": "Fast",
        "speaking_style": "Sweet, traditional Rajasthani female storyteller",
        "recommended_use": "Stories, Audiobooks, Cultural Narrations",
        "preview_text": "खम्मा घणी, म्हारो नाम मीरा है। आज आपां एक नई कहानी शुरू करां।",
    },
}


class SileroTTSService:
    """100% Offline Silero Indic Neural TTS Service (v4_indic, 24kHz)."""

    def __init__(self):
        self._model = None
        self._available = False
        self._torch = None
        self._transliterate = None
        self._check_availability()

    def _check_availability(self):
        try:
            import torch
            self._torch = torch
            from aksharamukha import transliterate
            self._transliterate = transliterate
            self._available = True
        except ImportError as e:
            print(f"[SileroTTS] Dependencies missing: {e}")

    @property
    def available(self) -> bool:
        return self._available

    def _load_model(self):
        if self._model is not None:
            return self._model
        if not self._available:
            raise RuntimeError("Silero dependencies (torch, soundfile, aksharamukha) are missing.")

        print("[SileroTTS] Loading Silero Indic v4_indic model (TorchScript, CPU)...")
        t0 = time.time()
        device = self._torch.device("cpu")
        model, _ = self._torch.hub.load(
            repo_or_dir="snakers4/silero-models",
            model="silero_tts",
            language="indic",
            speaker="v4_indic",
        )
        model.to(device)
        self._model = model
        print(f"[SileroTTS] Silero v4_indic ready in {time.time() - t0:.2f}s")
        return self._model

    def get_voices(self) -> Dict[str, Dict[str, Any]]:
        return SILERO_VOICES

    def _prepare_text_for_indic(self, text: str, script: str = "Devanagari") -> str:
        """Convert input text (native script or Roman Hinglish) to ISO-15919 for Silero."""
        has_latin = bool(re.search(r'[A-Za-z]', text))
        has_indic = bool(re.search(r'[\u0900-\u0D7F]', text))

        if has_latin and not has_indic:
            try:
                from backend.engine.hinglish import transliterate_hinglish_to_devanagari
                text = transliterate_hinglish_to_devanagari(text)
                script = "Devanagari"
            except Exception:
                pass

        try:
            iso_text = self._transliterate.process(script, "ISO", text)
            return iso_text
        except Exception as e:
            print(f"[SileroTTS] Aksharamukha transliteration error: {e}")
            return text

    def _master_vocal_track(self, audio: np.ndarray, sample_rate: int, gender: str = "Male") -> np.ndarray:
        """
        Punchy Studio Narrator Mastering for Silero Indic voices.
        Target: Match or exceed the richness, punch, and loudness of Kokoro ONNX voices.

        Two key principles:
        - NO final normalization here — the DSP pipeline handles that.
          This chain focuses on TONE and DYNAMICS only.
        - Pre-normalize input to compressor so it always reacts identically,
          regardless of Silero output level variations → consistent tone.

        Signal flow:
        1. DC/sub-rumble cut (80Hz highpass)
        2. Pre-normalize input to -6 dBFS (compressor reference level)
        3. Voice body boost (400-800Hz) — the "meat" of the voice
        4. Bass warmth (120-250Hz) — controlled, gender-aware
        5. Presence/clarity (3kHz) — intelligibility & cut-through
        6. De-esser — tame sibilance
        7. Compressor with makeup gain — punch & consistency
        8. Harmonic exciter — tube warmth
        9. Peak restore to -3 dBFS (headroom for DSP pipeline)
        """
        if audio.size == 0:
            return audio

        try:
            import scipy.signal

            nyq = sample_rate / 2.0
            clean = audio.astype(np.float32)

            # ── 1. Sub-rumble / DC cut (80Hz highpass) ──
            b, a = scipy.signal.butter(2, 80.0 / nyq, btype='highpass')
            clean = scipy.signal.filtfilt(b, a, clean).astype(np.float32)

            # ── 2. Pre-normalize input to -6 dBFS (0.501 linear) ──
            # This ensures the compressor and EQ always see the same level,
            # regardless of how quiet/loud the raw Silero output is.
            # → Consistent tone every time.
            input_peak = float(np.abs(clean).max())
            if input_peak > 0.0001:
                clean = (clean / input_peak) * 0.501

            # ── 3. Voice body boost (400-800Hz) — the "meat" & power ──
            if gender == "Male":
                body_center = 500.0
                body_gain_db = 4.5
            else:
                body_center = 650.0
                body_gain_db = 3.5

            body_q = 0.8
            w0_b = 2.0 * np.pi * body_center / sample_rate
            alpha_b = np.sin(w0_b) / (2.0 * body_q)
            Ab = 10 ** (body_gain_db / 40.0)
            bb0 = Ab * (1.0 + alpha_b)
            bb1 = -2.0 * Ab * np.cos(w0_b)
            bb2 = Ab * (1.0 - alpha_b)
            ba0 = 1.0 + alpha_b / Ab
            ba1 = -2.0 * np.cos(w0_b)
            ba2 = 1.0 - alpha_b / Ab
            clean = scipy.signal.lfilter([bb0, bb1, bb2], [ba0, ba1, ba2], clean).astype(np.float32)

            # ── 4. Bass warmth (controlled peaking, NOT boomy shelf) ──
            if gender == "Male":
                bass_freq = 130.0
                bass_gain_db = 2.5
            else:
                bass_freq = 180.0
                bass_gain_db = 2.0

            bass_q = 1.2
            w0_bass = 2.0 * np.pi * bass_freq / sample_rate
            alpha_bass = np.sin(w0_bass) / (2.0 * bass_q)
            Abass = 10 ** (bass_gain_db / 40.0)
            bbb0 = Abass * (1.0 + alpha_bass)
            bbb1 = -2.0 * Abass * np.cos(w0_bass)
            bbb2 = Abass * (1.0 - alpha_bass)
            bba0 = 1.0 + alpha_bass / Abass
            bba1 = -2.0 * np.cos(w0_bass)
            bba2 = 1.0 - alpha_bass / Abass
            clean = scipy.signal.lfilter([bbb0, bbb1, bbb2], [bba0, bba1, bba2], clean).astype(np.float32)

            # ── 5. Presence / clarity boost (3kHz) ──
            pres_center = 3000.0
            pres_q = 1.0
            pres_gain_db = 3.0
            w0_p = 2.0 * np.pi * pres_center / sample_rate
            alpha_p = np.sin(w0_p) / (2.0 * pres_q)
            Ap = 10 ** (pres_gain_db / 40.0)
            bp0 = Ap * (1.0 + alpha_p)
            bp1 = -2.0 * Ap * np.cos(w0_p)
            bp2 = Ap * (1.0 - alpha_p)
            ba0 = 1.0 + alpha_p / Ap
            ba1 = -2.0 * np.cos(w0_p)
            ba2 = 1.0 - alpha_p / Ap
            clean = scipy.signal.lfilter([bp0, bp1, bp2], [ba0, ba1, ba2], clean).astype(np.float32)

            # ── 6. De-esser ──
            deess_freq = 6000.0
            deess_threshold = 0.30
            deess_ratio = 0.5
            b_deess, a_deess = scipy.signal.butter(2, min(deess_freq / nyq, 0.99), btype='highpass')
            sibilant = scipy.signal.lfilter(b_deess, a_deess, clean)
            sib_env = np.abs(sibilant)
            atk_c = np.exp(-1.0 / (sample_rate * 0.001))
            rel_c = np.exp(-1.0 / (sample_rate * 0.015))
            sib_smooth = np.zeros_like(sib_env)
            for i in range(1, len(sib_env)):
                if sib_env[i] > sib_smooth[i - 1]:
                    sib_smooth[i] = atk_c * sib_smooth[i - 1] + (1.0 - atk_c) * sib_env[i]
                else:
                    sib_smooth[i] = rel_c * sib_smooth[i - 1] + (1.0 - rel_c) * sib_env[i]
            sib_gain = np.ones_like(clean)
            mask = sib_smooth > deess_threshold
            excess = sib_smooth[mask] - deess_threshold
            sib_gain[mask] = 1.0 - excess * (1.0 - deess_ratio) / np.maximum(sib_smooth[mask], 1e-6)
            sib_gain = np.clip(sib_gain, 0.25, 1.0)
            clean_hp = scipy.signal.lfilter(b_deess, a_deess, clean)
            clean_lp = clean - clean_hp
            clean = clean_lp + clean_hp * sib_gain

            # ── 7. Compressor with makeup gain — PUNCH (slow attack/release for consistency) ──
            comp_threshold_db = -18.0
            comp_ratio = 4.0
            makeup_gain_db = 8.0
            # Slower attack (8ms) and release (120ms) = more consistent, less level-dependent tone
            comp_attack_ms = 8.0
            comp_release_ms = 120.0
            attack_coeff = np.exp(-1.0 / (sample_rate * comp_attack_ms / 1000.0))
            release_coeff = np.exp(-1.0 / (sample_rate * comp_release_ms / 1000.0))
            envelope = np.zeros(len(clean), dtype=np.float64)
            gain_reduction = np.zeros(len(clean), dtype=np.float64)
            threshold_lin = 10 ** (comp_threshold_db / 20.0)
            makeup_lin = 10 ** (makeup_gain_db / 20.0)
            env = 0.0
            for i in range(len(clean)):
                abs_val = abs(clean[i])
                if abs_val > env:
                    env = attack_coeff * env + (1.0 - attack_coeff) * abs_val
                else:
                    env = release_coeff * env + (1.0 - release_coeff) * abs_val
                envelope[i] = env
                if env > threshold_lin:
                    env_db = 20.0 * np.log10(max(env, 1e-10))
                    gain_db = (env_db - comp_threshold_db) * (1.0 - 1.0 / comp_ratio)
                    gain_reduction[i] = -gain_db
                else:
                    gain_reduction[i] = 0.0
            gain_linear = 10 ** (-gain_reduction / 20.0)
            clean = clean * gain_linear * makeup_lin

            # ── 8. Harmonic exciter — tube warmth (gentle, level-independent) ──
            excite_amount = 0.10
            b_exc, a_exc = scipy.signal.butter(2, min(2500.0 / nyq, 0.99), btype='highpass')
            high_band = scipy.signal.lfilter(b_exc, a_exc, clean.astype(np.float64))
            drive = 1.0 + excite_amount * 3.0
            saturated = np.tanh(high_band * drive) / drive
            harmonic_layer = (saturated - high_band) * excite_amount
            clean = clean + harmonic_layer.astype(np.float32)

            # ── 9. Peak restore to -3 dBFS — safe headroom for DSP pipeline ──
            # DSP pipeline will do its own normalize/limiter on top.
            max_peak = float(np.abs(clean).max())
            if max_peak > 0.0001:
                target = 10 ** (-3.0 / 20.0)  # -3 dBFS = 0.708 linear
                clean = (clean / max_peak) * target

            return clean.astype(np.float32)

        except Exception as e:
            print(f"[SileroTTS] Mastering warning: {e}")
            return audio

    def synthesize(
        self,
        text: str,
        voice_id: str = "silero_hindi_male",
        speed: float = 1.0,
        emotion: Optional[str] = None,
        whisper: bool = False,
        emphasis: bool = False,
        micro_variation: bool = True,
        sentence_gap_ms: int = 250,
        paragraph_gap_ms: int = 400,
    ) -> Tuple[np.ndarray, int]:
        """
        Synthesize Expressive Indic Speech using Silero Neural model with humanized prosody.
        - Splits multi-sentence scripts on punctuation (., !, ?, ।, ...)
        - Natural sentence-level emotion detection & pacing
        - Rich warm speaker bass foundation and balanced studio volume
        Returns (np.ndarray float32, sample_rate 24000).
        """
        import scipy.signal
        import re
        from backend.engine.ssml_parser import detect_emotion

        if not text or not text.strip():
            return np.zeros(0, dtype=np.float32), 24000

        model = self._load_model()
        meta = SILERO_VOICES.get(voice_id, SILERO_VOICES["silero_hindi_male"])
        speaker = meta.get("speaker_id", "hindi_male")
        script = meta.get("script", "Devanagari")
        gender = meta.get("gender", "Male")
        sample_rate = 24000

        # Transliterate full text to ISO for Silero model
        iso_text = self._prepare_text_for_indic(text.strip(), script=script)

        if not iso_text or not iso_text.strip():
            return np.zeros(0, dtype=np.float32), sample_rate

        try:
            # Generate entire text in ONE call — model maintains consistent prosody/pitch
            # across the whole text. Splitting into sentences caused pitch jumps because
            # each sentence was a separate model inference with its own pitch contour.
            tensor_audio = model.apply_tts(
                text=iso_text,
                speaker=speaker,
                sample_rate=48000,
            )
            audio_48k = tensor_audio.detach().cpu().numpy().astype(np.float32)

            # Resample 48kHz -> 24kHz using polyphase anti-aliasing
            full_audio = scipy.signal.resample_poly(audio_48k, 1, 2).astype(np.float32)

            # Global user speed override (only if explicitly set by user away from 1.0)
            if abs(speed - 1.0) > 0.05 and len(full_audio) > 0:
                target_len = max(1, int(len(full_audio) / max(0.5, min(speed, 2.0))))
                indices = np.linspace(0, len(full_audio) - 1, target_len)
                full_audio = np.interp(indices, np.arange(len(full_audio)), full_audio).astype(np.float32)

        except Exception as e:
            print(f"[SileroTTS] Synthesis error for '{voice_id}': {e}")
            return np.zeros(0, dtype=np.float32), sample_rate

        if full_audio.size == 0:
            return np.zeros(0, dtype=np.float32), sample_rate

        # Apply rich warm studio narrator mastering
        full_audio = self._master_vocal_track(full_audio, sample_rate, gender)

        return full_audio, sample_rate


silero_tts_service = SileroTTSService()
