import os
import sys
import time
import re
import random
import numpy as np
import onnxruntime as rt
import psutil
from typing import List, Dict, Any, Tuple, Optional, Callable
from kokoro_onnx import Kokoro
from backend.engine.hinglish import transliterate_hinglish_to_devanagari
from backend.engine.indic_tts import INDIC_VOICES, indic_tts_engine
from backend.engine.dsp import dsp_pipeline
from backend.engine.ssml_parser import parse_ssml, SsmlSegment

# Expanded multi-lingual Kokoro Voice Catalog
VOICE_CATALOG = {
    # 🇺🇸 American English
    "af_bella": {"id": "af_bella", "name": "Bella", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Storyteller", "quality": "Studio", "speed_rating": "Very Fast", "speaking_style": "Warm, expressive storytelling", "recommended_use": "Audiobooks, Storytelling, Podcasts", "preview_text": "Welcome to ProVoice Studio. Let's create something extraordinary today."},
    "af_sarah": {"id": "af_sarah", "name": "Sarah", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, informative, steady pace", "recommended_use": "Documentaries, E-Learning, Explainer Videos", "preview_text": "Deep in the heart of nature, extraordinary phenomena unfold silently."},
    "af_alloy": {"id": "af_alloy", "name": "Alloy", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Conversational", "quality": "HD", "speed_rating": "Fast", "speaking_style": "Modern, crisp, friendly tone", "recommended_use": "YouTube Content, Tutorials, Commercials", "preview_text": "Hey everyone! Today we're diving into the future of offline AI voice tech."},
    "af_aoede": {"id": "af_aoede", "name": "Aoede", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Resonant, graceful, articulate", "recommended_use": "Literature, Poetic Narrations, Film Introductions", "preview_text": "In the beginning, there was only silence waiting to be shaped into melody."},
    "af_jessica": {"id": "af_jessica", "name": "Jessica", "gender": "Female", "accent": "American", "lang": "en-us", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Professional, confident broadcast style", "recommended_use": "News Reports, Corporate Updates, Announcements", "preview_text": "Good evening. Here are today's top stories from around the globe."},
    "af_nova": {"id": "af_nova", "name": "Nova", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Epic Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Dynamic, powerful, engaging", "recommended_use": "Trailers, Tech Launches, Video Essays", "preview_text": "The boundary between imagination and reality has officially dissolved."},
    "am_adam": {"id": "am_adam", "name": "Adam", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Very Fast", "speaking_style": "Rich, authoritative, deep bass tone", "recommended_use": "Documentaries, Trailers, Cinematic Recaps", "preview_text": "In a world driven by innovation, precision is the ultimate virtue."},
    "am_echo": {"id": "am_echo", "name": "Echo", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Movie Explainer", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Crisp, fast-paced, engaging presentation", "recommended_use": "Movie Recaps, YouTube Essays, Science Videos", "preview_text": "He thought he could escape, but he had no idea what was waiting around the corner."},
    "am_eric": {"id": "am_eric", "name": "Eric", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Friendly Voice", "quality": "HD", "speed_rating": "Fast", "speaking_style": "Warm, confident, conversational male tone", "recommended_use": "Business Presentations, Software Demos, Tech Guides", "preview_text": "Let's walk through how to configure your local project settings in three simple steps."},
    "am_fenrir": {"id": "am_fenrir", "name": "Fenrir", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Epic Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Gravelly, powerful, dramatic presentation", "recommended_use": "Game Characters, Fantasy Trailers, Dark Audiobooks", "preview_text": "Shadows fall across the kingdom, but the fire within remains unquenched."},
    "am_michael": {"id": "am_michael", "name": "Michael", "gender": "Male", "accent": "American", "lang": "en-us", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, professional, neutral delivery", "recommended_use": "Financial Reports, Daily News, Educational Content", "preview_text": "Market indicators show strong growth across key technology sectors today."},
    "am_onyx": {"id": "am_onyx", "name": "Onyx", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Dark Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Deep, mysterious, commanding voice", "recommended_use": "Thriller Narrations, Crime Documentaries, Sci-Fi", "preview_text": "The dossier had been sealed for thirty years. Until tonight."},

    # 🇬🇧 British English
    "bf_alice": {"id": "bf_alice", "name": "Alice", "gender": "Female", "accent": "British", "lang": "en-gb", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Sophisticated, articulate, refined RP accent", "recommended_use": "Nature Documentaries, Historical Content, Museums", "preview_text": "Across centuries of history, architectural marvels have stood as testimony to human genius."},
    "bf_emma": {"id": "bf_emma", "name": "Emma", "gender": "Female", "accent": "British", "lang": "en-gb", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm British narration, melodic cadence", "recommended_use": "Classic Novels, Children's Books, Drama", "preview_text": "It is a truth universally acknowledged that a good story warms the heart."},
    "bm_daniel": {"id": "bm_daniel", "name": "Daniel", "gender": "Male", "accent": "British", "lang": "en-gb", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Deep, scholarly British voice", "recommended_use": "Biographies, Science Essays, Historical Narrations", "preview_text": "The cosmos is vast beyond human comprehension, filled with mysteries awaiting discovery."},
    "bm_fable": {"id": "bm_fable", "name": "Fable", "gender": "Male", "accent": "British", "lang": "en-gb", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Engaging theatrical British narrator", "recommended_use": "Fantasy Novels, RPG Voiceovers, Drama", "preview_text": "Legend speaks of a forgotten blade forged in the depths of the ancient mountains."},
    "bm_george": {"id": "bm_george", "name": "George", "gender": "Male", "accent": "British", "lang": "en-gb", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Distinguished, calm British broadcasting tone", "recommended_use": "BBC-style Documentaries, Academic Lectures", "preview_text": "Observations conducted over decades reveal extraordinary patterns of migration."},

    # 🇪🇸 Spanish
    "ef_dora": {"id": "ef_dora", "name": "Dora", "gender": "Female", "accent": "Spanish", "lang": "es", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm, natural Spanish storytelling tone", "recommended_use": "Spanish Dubbing, Audiobooks, Commercials", "preview_text": "Hola y bienvenido a ProVoice Studio. Creemos narraciones extraordinarias hoy."},
    "em_alex": {"id": "em_alex", "name": "Alex", "gender": "Male", "accent": "Spanish", "lang": "es", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, professional Spanish male voice", "recommended_use": "Documentaries, Course Dubbing, News", "preview_text": "En el corazón de la historia, grandes descubrimientos cambian el mundo."},

    # 🇫🇷 French
    "ff_siwis": {"id": "ff_siwis", "name": "Siwis", "gender": "Female", "accent": "French", "lang": "fr", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Elegant French narration, clear diction", "recommended_use": "French Audiobooks, Documentaries, Luxury Ads", "preview_text": "Bienvenue dans ProVoice Studio. Produisez des voix off d'une qualité exceptionnelle."},

    # 🇮🇹 Italian
    "if_sara": {"id": "if_sara", "name": "Sara", "gender": "Female", "accent": "Italian", "lang": "it", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Expressive, melodic Italian narration", "recommended_use": "Italian Voiceovers, Audio Guides, Podcasts", "preview_text": "Benvenuti in ProVoice Studio. Creiamo narrazioni vocali straordinarie."},

    # 🇯🇵 Japanese
    "jf_alpha": {"id": "jf_alpha", "name": "Alpha (アルファ)", "gender": "Female", "accent": "Japanese", "lang": "ja", "category": "Anime / Explainer", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, modern Japanese narration", "recommended_use": "Anime Voiceover, YouTube Essays, Tutorials", "preview_text": "ProVoice Studioへようこそ。高音質なAI音声ナレーションを体験してください。"},
    "jm_kento": {"id": "jm_kento", "name": "Kento (ケント)", "gender": "Male", "accent": "Japanese", "lang": "ja", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Resonant Japanese male voice", "recommended_use": "Documentaries, Game Voices, Commercials", "preview_text": "新しい時代のローカルAI音声技術が、ここに始まります。"},

    # 🇨🇳 Mandarin Chinese
    "zf_xiaobei": {"id": "zf_xiaobei", "name": "Xiaobei (小北)", "gender": "Female", "accent": "Mandarin", "lang": "zh", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Fluent, professional Mandarin female tone", "recommended_use": "Mandarin Dubbing, Audiobooks, E-Learning", "preview_text": "欢迎使用 ProVoice Studio。体验高品质离线 AI 语音旁白。"},
    "zm_yunjian": {"id": "zm_yunjian", "name": "Yunjian (云剑)", "gender": "Male", "accent": "Mandarin", "lang": "zh", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Authoritative Mandarin male narrator", "recommended_use": "Documentaries, Film Recaps, Corporate Videos", "preview_text": "探索科技与创意的无限可能，打造极致声音体验。"},

    # 🇮🇳 Hindi
    "hf_alpha": {"id": "hf_alpha", "name": "Alpha (अल्फा)", "gender": "Female", "accent": "Hindi", "lang": "hi", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm, natural Hindi female voice", "recommended_use": "Hindi Voiceovers, Audiobooks, Commercials", "preview_text": "प्रोवॉयस स्टूडियो में आपका स्वागत है। आइए बेहतरीन आवाज बनाएं।"},
    "hm_beta": {"id": "hm_beta", "name": "Beta (बीटा)", "gender": "Male", "accent": "Hindi", "lang": "hi", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear Hindi male broadcasting voice", "recommended_use": "News Recaps, Documentaries, Educational Videos", "preview_text": "तकनीक की दुनिया में एक नया अध्याय आज से शुरू होता है।"},
}

# Emotion & Style Presets Definition
EMOTION_PRESETS = {
    "normal": {"speed": 1.0, "sentence_gap_ms": 200, "paragraph_gap_ms": 400, "eq_bass": 0, "eq_presence": 0, "eq_treble": 0, "compressor_ratio": 3.0},
    "dramatic": {"speed": 0.88, "sentence_gap_ms": 350, "paragraph_gap_ms": 600, "eq_bass": 3, "eq_presence": 2, "eq_treble": 1, "compressor_ratio": 4.5},
    "whispering": {"speed": 0.95, "sentence_gap_ms": 250, "paragraph_gap_ms": 450, "eq_bass": -4, "eq_presence": 4, "eq_treble": 5, "compressor_ratio": 2.0},
    "energetic": {"speed": 1.15, "sentence_gap_ms": 150, "paragraph_gap_ms": 280, "eq_bass": 1, "eq_presence": 3, "eq_treble": 2, "compressor_ratio": 3.5},
    "sad": {"speed": 0.82, "sentence_gap_ms": 450, "paragraph_gap_ms": 700, "eq_bass": 2, "eq_presence": -2, "eq_treble": -3, "compressor_ratio": 2.5},
    "news": {"speed": 1.05, "sentence_gap_ms": 180, "paragraph_gap_ms": 320, "eq_bass": -1, "eq_presence": 3, "eq_treble": 1, "compressor_ratio": 4.0},
    "sher": {"speed": 0.80, "sentence_gap_ms": 500, "paragraph_gap_ms": 800, "eq_bass": 3, "eq_presence": 3, "eq_treble": 1, "compressor_ratio": 3.0},
    "urdu_poetry": {"speed": 0.82, "sentence_gap_ms": 500, "paragraph_gap_ms": 800, "eq_bass": 4, "eq_presence": 3, "eq_treble": 2, "compressor_ratio": 3.2},
    "hindi_cinematic": {"speed": 0.88, "sentence_gap_ms": 350, "paragraph_gap_ms": 600, "eq_bass": 4, "eq_presence": 3, "eq_treble": 1, "compressor_ratio": 4.5},
    "qawwali_style": {"speed": 0.92, "sentence_gap_ms": 300, "paragraph_gap_ms": 500, "eq_bass": 2, "eq_presence": 4, "eq_treble": 2, "compressor_ratio": 3.8},
}


KOKORO_MODEL_URLS = [
    "https://github.com/ahmad-abdullah-chaudary/provoice-studio/releases/download/v1.0.0/kokoro-v1.0.onnx",
    "https://raw.githubusercontent.com/ahmad-abdullah-chaudary/provoice-studio/main/kokoro-v1.0.onnx",
    "https://github.com/taylorchu/kokoro-onnx/releases/download/v0.2.0/kokoro.onnx"
]
VOICES_BIN_URLS = [
    "https://github.com/ahmad-abdullah-chaudary/provoice-studio/releases/download/v1.0.0/voices-v1.0.bin",
    "https://raw.githubusercontent.com/ahmad-abdullah-chaudary/provoice-studio/main/voices-v1.0.bin",
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
]

def resolve_model_path(filename: str) -> str:
    """
    Resolves model file path in priority order:
    1. sys._MEIPASS     — PyInstaller frozen bundle (baked into .exe via --add-data)
    2. models/<file>    — local models/ folder (dev setup)
    3. <file>           — project root (dev setup)
    4. Falls back to models/ path — auto-downloader will fill it in
    """
    # 1. PyInstaller frozen bundle — models baked into the .exe
    if getattr(sys, 'frozen', False):
        meipass = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        candidate = os.path.join(meipass, filename)
        if os.path.exists(candidate):
            return candidate

    # 2. models/ folder (local dev)
    models_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "models"))
    candidate = os.path.join(models_dir, filename)
    if os.path.exists(candidate) and os.path.getsize(candidate) > 10000:
        return candidate

    # 3. Project root (dev — files placed directly in root)
    root = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
    candidate = os.path.join(root, filename)
    if os.path.exists(candidate) and os.path.getsize(candidate) > 10000:
        return candidate

    # 4. Default download destination
    return os.path.join(models_dir, filename)



def ensure_model_files_exist(model_path: str = "kokoro-v1.0.onnx", voices_path: str = "voices-v1.0.bin"):
    """Auto-downloads missing ONNX model & voices embeddings files if not present on system."""
    import urllib.request

    if not os.path.exists(model_path) or os.path.getsize(model_path) < 10000:
        print(f"[KokoroTTS] Model file missing. Auto-downloading from GitHub...")
        for url in KOKORO_MODEL_URLS:
            try:
                urllib.request.urlretrieve(url, model_path)
                if os.path.exists(model_path) and os.path.getsize(model_path) > 1000000:
                    print(f"[KokoroTTS] Downloaded {os.path.basename(model_path)} ✓")
                    break
            except Exception as e:
                print(f"[KokoroTTS] Attempt from {url} failed: {e}")

    if not os.path.exists(voices_path) or os.path.getsize(voices_path) < 10000:
        print(f"[KokoroTTS] Voices bin missing. Auto-downloading from GitHub...")
        for url in VOICES_BIN_URLS:
            try:
                urllib.request.urlretrieve(url, voices_path)
                if os.path.exists(voices_path) and os.path.getsize(voices_path) > 100000:
                    print(f"[KokoroTTS] Downloaded {os.path.basename(voices_path)} ✓")
                    break
            except Exception as e:
                print(f"[KokoroTTS] Attempt from {url} failed: {e}")


class KokoroTTSService:
    """Offline CPU-Optimized Kokoro ONNX Text-to-Speech Engine."""

    def __init__(self, model_path: str = None, voices_path: str = None):
        self.model_path = model_path or resolve_model_path("kokoro-v1.0.onnx")
        self.voices_path = voices_path or resolve_model_path("voices-v1.0.bin")
        self.kokoro: Optional[Kokoro] = None
        self._is_initialized = False

    def initialize(self) -> bool:
        if self._is_initialized and self.kokoro is not None:
            return True

        ensure_model_files_exist(self.model_path, self.voices_path)

        if not os.path.exists(self.model_path) or not os.path.exists(self.voices_path):
            print(f"[KokoroTTS] Model files unavailable — falling back to Edge/Indic engines.")
            return False
        
        print(f"[KokoroTTS] Loading ONNX model with CPU multi-threading optimizations…")
        start = time.time()
        
        sess_options = rt.SessionOptions()
        logical_cpus = psutil.cpu_count(logical=True) or 8
        sess_options.intra_op_num_threads = logical_cpus
        sess_options.inter_op_num_threads = max(2, logical_cpus // 2)
        sess_options.execution_mode = rt.ExecutionMode.ORT_PARALLEL
        sess_options.graph_optimization_level = rt.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.kokoro = Kokoro(self.model_path, self.voices_path)
        self.kokoro.sess = rt.InferenceSession(
            self.model_path,
            sess_options=sess_options,
            providers=["CPUExecutionProvider"]
        )
        
        self._is_initialized = True
        print(f"[KokoroTTS] Ready in {time.time() - start:.2f}s ({logical_cpus} CPU threads engaged)")
        return True

    def get_available_voices(self, lang_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        result = []

        # Kokoro voice enumeration — only when the ONNX model actually loaded
        if self.initialize() and self.kokoro is not None:
            try:
                raw_voices = self.kokoro.get_voices()
                for vid in raw_voices:
                    if vid in VOICE_CATALOG:
                        v = VOICE_CATALOG[vid]
                        if not lang_filter or lang_filter == "all" or v.get("lang") == lang_filter:
                            result.append(v)
                    else:
                        gender = "Female" if vid[:2] in ("af", "bf", "ef", "ff", "hf", "if", "jf", "pf", "zf") else "Male"
                        lang_code = vid[:2]
                        lang_map = {"af": "American", "am": "American", "bf": "British", "bm": "British",
                                    "ef": "Spanish", "em": "Spanish", "ff": "French", "hf": "Hindi",
                                    "hm": "Hindi", "if": "Italian", "im": "Italian", "jf": "Japanese",
                                    "jm": "Japanese", "pf": "Portuguese", "pm": "Portuguese",
                                    "zf": "Mandarin", "zm": "Mandarin"}
                        accent = lang_map.get(lang_code, "International")
                        v = {
                            "id": vid, "name": vid.replace("_", " ").title(), "gender": gender,
                            "accent": accent, "lang": lang_code, "category": "General", "quality": "Studio",
                            "speed_rating": "Fast", "speaking_style": f"Standard {accent} {gender} Voice",
                            "recommended_use": "General Narration, Voiceovers",
                            "preview_text": f"Hello, this is the {vid.replace('_', ' ').title()} voice."
                        }
                        if not lang_filter or lang_filter == "all" or lang_code == lang_filter:
                            result.append(v)
            except Exception as e:
                print(f"[KokoroTTS] Voice enumeration failed ({e}) — falling back to catalog.")

        # If the Kokoro model is unavailable/failed, expose the full static catalog
        if not result:
            for vid, v in VOICE_CATALOG.items():
                if not lang_filter or lang_filter == "all" or v.get("lang") == lang_filter:
                    result.append(v)

        # Include Silero Indic & Edge Indic Neural voices
        for iv in INDIC_VOICES:
            if not lang_filter or lang_filter == "all" or iv.get("lang") == lang_filter:
                result.append(iv)

        return result

    def chunk_text(self, text: str, max_chars: int = 400) -> List[str]:
        text = text.strip()
        if not text:
            return []
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        chunks = []
        for p in paragraphs:
            if len(p) <= max_chars:
                chunks.append(p)
            else:
                sentences = re.split(r"(?<=[.!?;])\s+", p)
                current = ""
                for s in sentences:
                    if len(current) + len(s) + 1 <= max_chars:
                        current = (current + " " + s).strip()
                    else:
                        if current:
                            chunks.append(current)
                        current = s
                if current:
                    chunks.append(current)
        return chunks

    def generate_with_progress(
        self,
        text: str,
        voice: str = "af_bella",
        speed: float = 1.0,
        lang: str = "en-us",
        sentence_gap_ms: int = 200,
        paragraph_gap_ms: int = 400,
        emotion: str = "normal",
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
        # Studio enhancement flags
        micro_variation: bool = True,
        breathing_injection: bool = True,
        nlp_auto_emotion: bool = True,
    ) -> Tuple[np.ndarray, int, float]:
        """Generate speech with full SSML inline tag support, NLP auto-emotion detection,
        per-sentence voice switching, micro-variation, and breath injection.
        """
        # Dispatch Indic Neural & Silero PyTorch voices
        if voice.startswith("indic_"):
            if progress_callback:
                progress_callback(1, 1, text[:60])
            return indic_tts_engine.generate(text, voice)

        self.initialize()
        if self.kokoro is None:
            raise RuntimeError(
                "Kokoro ONNX model unavailable. The model files were not found and could not "
                "be auto-downloaded. Restart the app to retry, or use an Indic voice."
            )
        start_time = time.time()
        sample_rate = 24000

        # Parse inline SSML tags & auto-detect per-sentence emotion
        ssml_segments = parse_ssml(text, base_voice=voice, base_speed=speed, nlp_auto_emotion=nlp_auto_emotion)

        audio_segments: List[np.ndarray] = []
        total_segs = len(ssml_segments)
        rng = random.Random()

        for seg_idx, ssml_seg in enumerate(ssml_segments):
            if ssml_seg.kind == "pause":
                if ssml_seg.pause_ms > 0:
                    audio_segments.append(np.zeros(int(sample_rate * ssml_seg.pause_ms / 1000.0), dtype=np.float32))
                continue

            # Determine segment voice & language
            seg_voice = ssml_seg.voice or voice
            if seg_voice not in self.kokoro.get_voices() and seg_voice not in VOICE_CATALOG:
                seg_voice = voice  # fallback to base voice if unknown ID

            seg_lang = lang
            voice_meta = VOICE_CATALOG.get(seg_voice)
            if voice_meta and "lang" in voice_meta:
                seg_lang = voice_meta["lang"]

            # Auto-transliterate Roman Hindi for Hindi voices
            seg_text = ssml_seg.text
            if seg_lang == "hi" or seg_voice.startswith(("hf_", "hm_")):
                seg_text = transliterate_hinglish_to_devanagari(seg_text)

            chunks = self.chunk_text(seg_text)
            if not chunks:
                continue

            # Determine speed & emotion for this segment
            seg_speed = ssml_seg.speed_override if ssml_seg.speed_override is not None else speed
            effective_emotion = ssml_seg.emotion or emotion

            if effective_emotion in EMOTION_PRESETS:
                ep = EMOTION_PRESETS[effective_emotion]
                seg_speed = seg_speed * ep["speed"]

            gender = "female" if seg_voice[:2] in ("af", "bf", "ef", "ff", "hf", "if", "jf", "zf") else "male"
            total_chunks = len(chunks)

            for idx, chunk in enumerate(chunks):
                try:
                    # ── Micro-Variation Engine ──────────────────────────
                    if micro_variation:
                        rng.seed((hash(chunk) + seg_idx) & 0xFFFFFFFF)
                        chunk_speed = seg_speed * rng.uniform(0.96, 1.04)
                        chunk_gap_ms = int(sentence_gap_ms * rng.uniform(0.88, 1.12))
                        chunk_para_ms = int(paragraph_gap_ms * rng.uniform(0.90, 1.10))
                    else:
                        chunk_speed = seg_speed
                        chunk_gap_ms = sentence_gap_ms
                        chunk_para_ms = paragraph_gap_ms

                    samples, sr = self.kokoro.create(chunk, voice=seg_voice, speed=chunk_speed, lang=seg_lang)
                    if sr:
                        sample_rate = sr

                    # Apply whisper / emphasis DSP modifiers if requested by tag
                    if ssml_seg.whisper:
                        samples = dsp_pipeline.equalizer(samples, sample_rate, bass_gain_db=-4.0, presence_gain_db=3.0, treble_gain_db=4.0)
                    elif ssml_seg.emphasis:
                        samples = dsp_pipeline.equalizer(samples, sample_rate, presence_gain_db=2.5, treble_gain_db=1.5)

                    audio_segments.append(samples)

                    if idx < total_chunks - 1 or seg_idx < total_segs - 1:
                        is_paragraph_break = "\n" in chunk
                        if is_paragraph_break:
                            if breathing_injection:
                                breath_duration = rng.randint(70, 110)
                                breath = dsp_pipeline.generate_breath(
                                    sample_rate, duration_ms=breath_duration,
                                    amplitude=rng.uniform(0.010, 0.016), gender=gender
                                )
                                pre_breath_ms = max(80, int(chunk_para_ms * 0.4))
                                post_breath_ms = max(50, chunk_para_ms - pre_breath_ms - breath_duration)
                                audio_segments.append(np.zeros(int(sample_rate * pre_breath_ms / 1000), dtype=np.float32))
                                audio_segments.append(breath)
                                audio_segments.append(np.zeros(int(sample_rate * post_breath_ms / 1000), dtype=np.float32))
                            else:
                                audio_segments.append(np.zeros(int(sample_rate * chunk_para_ms / 1000), dtype=np.float32))
                        else:
                            audio_segments.append(np.zeros(int(sample_rate * chunk_gap_ms / 1000), dtype=np.float32))

                except Exception as e:
                    print(f"[KokoroTTS] SSML chunk warning ({chunk[:30]}): {e}")

                if progress_callback:
                    progress_callback(seg_idx + 1, total_segs, chunk)

        if not audio_segments:
            return np.zeros(0, dtype=np.float32), sample_rate, 0.0

        return np.concatenate(audio_segments), sample_rate, time.time() - start_time

    def generate(self, text, voice="af_bella", speed=1.0, lang="en-us",
                 sentence_gap_ms=200, paragraph_gap_ms=400, emotion="normal",
                 micro_variation=True, breathing_injection=True, nlp_auto_emotion=True):
        return self.generate_with_progress(
            text, voice, speed, lang, sentence_gap_ms, paragraph_gap_ms, emotion,
            micro_variation=micro_variation, breathing_injection=breathing_injection,
            nlp_auto_emotion=nlp_auto_emotion
        )


tts_engine = KokoroTTSService()
