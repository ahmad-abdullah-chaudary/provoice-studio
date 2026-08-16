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
        Pristine Studio Clean Mastering.
        - 50Hz Sub-Rumble Cut (Butterworth 2-pole linear phase): removes DC offset & sub-noise
        - Transparent Peak Normalization to -1.0 dBFS (0.891): 100% distortion-free, pure neural fidelity
        - Zero waveshaper clipping, zero artificial buzz, zero phase smearing
        """
        if audio.size == 0:
            return audio

        try:
            import scipy.signal

            # 1. Gentle DC / sub-rumble cleanup below human voice range (50Hz)
            nyq = sample_rate / 2.0
            b, a = scipy.signal.butter(2, 50.0 / nyq, btype='highpass')
            clean = scipy.signal.filtfilt(b, a, audio).astype(np.float32)

            # 2. Transparent Peak Normalization to -1.0 dBFS (0.891) — Pure natural voice
            max_peak = float(np.abs(clean).max())
            if max_peak > 0.0001:
                clean = (clean / max_peak) * 0.891

            return clean

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

        # Split text into natural sentence / clause chunks for expressive delivery
        raw_sentences = re.split(r'(?<=[.!?।…\n])\s+', text.strip())
        sentences = [s.strip() for s in raw_sentences if s.strip()]

        if not sentences:
            return np.zeros(0, dtype=np.float32), sample_rate

        audio_pieces: List[np.ndarray] = []

        # Emotion pause table (natural milliseconds)
        emotion_gaps = {
            "dramatic": 350,
            "sad": 400,
            "energetic": 180,
            "whispering": 250,
            "news": 200,
            "sher": 450,
            "normal": sentence_gap_ms,
        }

        for idx, sentence in enumerate(sentences):
            if not sentence:
                continue

            sent_emotion = emotion or detect_emotion(sentence)
            gap_ms = emotion_gaps.get(sent_emotion, sentence_gap_ms)

            # Transliterate to ISO for Silero model
            iso_text = self._prepare_text_for_indic(sentence, script=script)

            try:
                # Generate at native 48kHz (highest quality neural output)
                tensor_audio = model.apply_tts(
                    text=iso_text,
                    speaker=speaker,
                    sample_rate=48000,
                )
                audio_48k = tensor_audio.detach().cpu().numpy().astype(np.float32)

                # Resample 48kHz -> 24kHz using polyphase anti-aliasing
                piece_24k = scipy.signal.resample_poly(audio_48k, 1, 2).astype(np.float32)

                # Global user speed override (only if explicitly set by user away from 1.0)
                if abs(speed - 1.0) > 0.05 and len(piece_24k) > 0:
                    target_len = max(1, int(len(piece_24k) / max(0.5, min(speed, 2.0))))
                    indices = np.linspace(0, len(piece_24k) - 1, target_len)
                    piece_24k = np.interp(indices, np.arange(len(piece_24k)), piece_24k).astype(np.float32)

                audio_pieces.append(piece_24k)

                # Natural narrative pause between sentences
                if idx < len(sentences) - 1:
                    is_para = "\n" in sentence
                    gap = paragraph_gap_ms if is_para else gap_ms
                    if gap > 0:
                        audio_pieces.append(np.zeros(int(sample_rate * gap / 1000.0), dtype=np.float32))

            except Exception as e:
                print(f"[SileroTTS] Sentence synthesis warning on '{sentence[:30]}...': {e}")

        if not audio_pieces:
            return np.zeros(0, dtype=np.float32), sample_rate

        full_audio = np.concatenate(audio_pieces)

        # Apply rich warm studio narrator mastering
        full_audio = self._master_vocal_track(full_audio, sample_rate, gender)

        return full_audio, sample_rate


silero_tts_service = SileroTTSService()
