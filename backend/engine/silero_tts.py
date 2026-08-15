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

    def _master_vocal_track(self, audio: np.ndarray, sample_rate: int, gender: str) -> np.ndarray:
        """
        Studio Broadcast Mastering using Second-Order Sections (SOS).
        - 70Hz Sub-Rumble Cut (preserves 100% of rich masculine vocal bass & body)
        - 120Hz (+2.2dB) restores warm speaker bass foundation
        - 480Hz (-2.5dB) cleans out hollow throatiness/flu boxiness
        - 3200Hz (+3.2dB) direct mouth & lip speech projection
        - 7500Hz (+2.5dB) crisp consonant sizzle and open air
        - Subtle dynamic analog warmth for organic human tone
        - High-energy -11.2 dBRMS studio broadcast limiter
        """
        try:
            import scipy.signal

            nyq = sample_rate / 2.0

            # 1. 70Hz High-Pass (only cuts sub-rumble, preserving 100% of vocal bass & warmth)
            cutoff_hp = 70.0 if gender == "Male" else 85.0
            sos_hp = scipy.signal.butter(2, cutoff_hp / nyq, btype='highpass', output='sos')
            audio = scipy.signal.sosfilt(sos_hp, audio)

            def make_peaking_sos(freq: float, gain_db: float, Q: float = 0.8):
                w0 = 2 * np.pi * freq / sample_rate
                if w0 >= np.pi:
                    return np.array([[1.0, 0.0, 0.0, 1.0, 0.0, 0.0]])
                A = 10 ** (gain_db / 40.0)
                alpha = np.sin(w0) / (2 * Q)
                b0 = 1 + alpha * A
                b1 = -2 * np.cos(w0)
                b2 = 1 - alpha * A
                a0 = 1 + alpha / A
                a1 = -2 * np.cos(w0)
                a2 = 1 - alpha / A
                b = np.array([b0/a0, b1/a0, b2/a0])
                a = np.array([1.0, a1/a0, a2/a0])
                return scipy.signal.tf2sos(b, a)

            if gender == "Male":
                # 2. Rich Bass & Body Foundation @ 120Hz (+2.2dB, Q=0.9) — deep, warm speaker bass
                sos_bass = make_peaking_sos(120, 2.2, Q=0.9)
                audio = scipy.signal.sosfilt(sos_bass, audio)

                # 3. Clean throatiness / flu boxiness @ 480Hz (-2.5dB, wide Q=0.8)
                sos_throat = make_peaking_sos(480, -2.5, Q=0.8)
                audio = scipy.signal.sosfilt(sos_throat, audio)

                # 4. Direct mouth & lip projection @ 3200Hz (+3.2dB, Q=0.9)
                sos_mouth = make_peaking_sos(3200, 3.2, Q=0.9)
                audio = scipy.signal.sosfilt(sos_mouth, audio)

                # 5. Crisp consonant sizzle & air @ 7500Hz (+2.5dB, Q=0.8)
                sos_air = make_peaking_sos(7500, 2.5, Q=0.8)
                audio = scipy.signal.sosfilt(sos_air, audio)
            else:
                # Female warmth @ 180Hz (+1.8dB)
                sos_bass = make_peaking_sos(180, 1.8, Q=0.9)
                audio = scipy.signal.sosfilt(sos_bass, audio)

                # Female throat cleaning @ 520Hz (-2.5dB)
                sos_throat = make_peaking_sos(520, -2.5, Q=0.8)
                audio = scipy.signal.sosfilt(sos_throat, audio)

                # Female oral articulation @ 3500Hz (+3.2dB)
                sos_mouth = make_peaking_sos(3500, 3.2, Q=0.9)
                audio = scipy.signal.sosfilt(sos_mouth, audio)

                # Female air @ 8500Hz (+2.5dB)
                sos_air = make_peaking_sos(8500, 2.5, Q=0.8)
                audio = scipy.signal.sosfilt(sos_air, audio)

            # 6. Subtle dynamic analog warmth — smooths synthetic AI rigidity
            try:
                drive = 1.12
                sat = np.tanh(audio * drive) / np.tanh(drive)
                audio = (0.88 * audio + 0.12 * sat).astype(np.float32)
            except Exception:
                pass

            # 7. Hot Commercial Studio Broadcast Limiter (-11.2 dBRMS)
            rms = np.sqrt(np.mean(audio ** 2))
            if rms > 0.0001:
                target_rms = 0.275  # -11.2 dBRMS
                audio = audio * (target_rms / rms)

                threshold = 0.82
                over_mask = np.abs(audio) > threshold
                if np.any(over_mask):
                    excess = (np.abs(audio[over_mask]) - threshold) / (1.0 - threshold + 1e-9)
                    audio[over_mask] = np.sign(audio[over_mask]) * (threshold + (1.0 - threshold) * np.tanh(excess))

                audio = np.clip(audio, -0.98, 0.98).astype(np.float32)

        except Exception as e:
            print(f"[SileroTTS] Mastering warning: {e}")

        return audio

    def synthesize(
        self,
        text: str,
        voice_id: str = "silero_hindi_male",
        speed: float = 1.0,
    ) -> Tuple[np.ndarray, int]:
        """
        Synthesize Indic speech using Silero Neural model.
        - Generates natively at 48kHz (highest quality)
        - Resamples to 24kHz using polyphase anti-aliasing
        - Preserves 100% natural pitch & speed timing
        - Applies clean mouth-forward SOS mastering for crisp, upfront speech
        Returns (np.ndarray float32, sample_rate 24000).
        """
        import scipy.signal
        model = self._load_model()
        meta = SILERO_VOICES.get(voice_id, SILERO_VOICES["silero_hindi_male"])
        speaker = meta.get("speaker_id", "hindi_male")
        script = meta.get("script", "Devanagari")
        gender = meta.get("gender", "Male")

        # Convert script -> ISO 15919 for the v4_indic model
        iso_text = self._prepare_text_for_indic(text, script=script)

        # Generate at native 48kHz (Silero's best quality, avoids neural compression artifacts)
        tensor_audio = model.apply_tts(
            text=iso_text,
            speaker=speaker,
            sample_rate=48000,
        )
        audio_48k = tensor_audio.detach().cpu().numpy().astype(np.float32)

        # Resample 48kHz -> 24kHz using polyphase anti-aliasing
        audio = scipy.signal.resample_poly(audio_48k, 1, 2).astype(np.float32)
        sample_rate = 24000

        # Apply clean mouth-forward mastering (100% natural neural pitch and speed)
        audio = self._master_vocal_track(audio, sample_rate, gender)

        # Speed adjustment (time-scale only if explicitly requested by user)
        if abs(speed - 1.0) > 0.05 and len(audio) > 0:
            try:
                target_len = int(len(audio) / max(0.5, min(speed, 2.0)))
                indices = np.linspace(0, len(audio) - 1, target_len)
                audio = np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)
            except Exception as e:
                print(f"[SileroTTS] Speed adjustment warning: {e}")

        return audio, sample_rate


silero_tts_service = SileroTTSService()
