import os
import time
import asyncio
import subprocess
import tempfile
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from backend.engine.urdu import transliterate_roman_urdu_to_script, normalize_urdu_text

INDIC_VOICES = [
    # 🇮🇳 Hindi Neural Voices
    {
        "id": "indic_hi_swara",
        "name": "Swara (स्वर - Neural)",
        "gender": "Female",
        "accent": "Hindi",
        "lang": "hi",
        "engine": "edge_tts",
        "voice_name": "hi-IN-SwaraNeural",
        "category": "Storyteller",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Natural, expressive Hindi & Hinglish storytelling voice",
        "recommended_use": "Hinglish Stories, Documentaries, YouTube Essays",
        "preview_text": "एक रात ने सब कुछ बदल दिया... दो भाई शिकागो की खतरनाक गैंग वार्स छोड़कर अपने पुराने शहर वापस आए।"
    },
    {
        "id": "indic_hi_madhur",
        "name": "Madhur (मधुर - Neural)",
        "gender": "Male",
        "accent": "Hindi",
        "lang": "hi",
        "engine": "edge_tts",
        "voice_name": "hi-IN-MadhurNeural",
        "category": "Deep Narrator",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Deep, authoritative Hindi & Hinglish male voice",
        "recommended_use": "Crime Recaps, Trailers, Film Summaries, Podcasts",
        "preview_text": "उनका एक ही सपना था... एक जूके जॉइंट खोलना जहाँ लोग आज़ादी से म्यूज़िक सुन सकें।"
    },
    {
        "id": "indic_hi_rehaan",
        "name": "Rehaan (रेहान - Baritone Neural)",
        "gender": "Male",
        "accent": "Hindi",
        "lang": "hi",
        "engine": "edge_tts",
        "voice_name": "hi-IN-RehaanNeural",
        "category": "Cinematic Baritone",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Deep, resonating Hindi male baritone",
        "recommended_use": "Movie Trailers, Crime Documentaries, Dramatic Essays",
        "preview_text": "अंधेरे की गहराइयों में एक नया राज़ छुपा था... जिसे दुनिया कभी नहीं जान सकी।"
    },
    {
        "id": "indic_hi_kalpana",
        "name": "Kalpana (कल्पना - Warm Neural)",
        "gender": "Female",
        "accent": "Hindi",
        "lang": "hi",
        "engine": "edge_tts",
        "voice_name": "hi-IN-KalpanaNeural",
        "category": "Audiobook Voice",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Soft, articulate Hindi female narrator",
        "recommended_use": "Audiobooks, Meditations, Educational Courses",
        "preview_text": "शांत बहती नदी के किनारे, उसने एक पुरानी किताब खोली और पढ़ना शुरू किया।"
    },
    {
        "id": "indic_in_neerja",
        "name": "Neerja (नीरजा - Hinglish)",
        "gender": "Female",
        "accent": "Hindi (Hinglish)",
        "lang": "hi",
        "engine": "edge_tts",
        "voice_name": "en-IN-NeerjaNeural",
        "category": "Conversational",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Crisp Indian English & Hinglish accent",
        "recommended_use": "Corporate Videos, E-Learning, Tutorials, Tech Recaps",
        "preview_text": "Ek raat ne sab kuch badal diya... Do bhai, Chicago ki khatarnaak gang wars chhod kar wapas aaye."
    },
    {
        "id": "indic_in_prabhat",
        "name": "Prabhat (प्रभास - Hinglish)",
        "gender": "Male",
        "accent": "Hindi (Hinglish)",
        "lang": "hi",
        "engine": "edge_tts",
        "voice_name": "en-IN-PrabhatNeural",
        "category": "News Voice",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Confident male Indian English & Hinglish voice",
        "recommended_use": "News Reports, Explainer Videos, Audiobooks",
        "preview_text": "Unka ek hi sapna tha... ek Juke Joint kholna jahan log aazadi se music sun sakein."
    },
    {
        "id": "indic_silero_hi_female",
        "name": "Silero Hindi Female (हिंदी नारी PyTorch)",
        "gender": "Female",
        "accent": "Hindi",
        "lang": "hi",
        "engine": "silero",
        "voice_name": "v3_indic",
        "speaker": "hindi_female",
        "category": "Storyteller",
        "quality": "Studio",
        "speed_rating": "Fast",
        "speaking_style": "Offline PyTorch Silero Hindi female voice engine",
        "recommended_use": "Offline Audiobooks, Storytelling, Local Generation",
        "preview_text": "एक रात ने सब कुछ बदल दिया... दो भाई अपने पुराने शहर वापस आए।"
    },
    {
        "id": "indic_silero_hi_male",
        "name": "Silero Hindi Male (हिंदी पुरुष PyTorch)",
        "gender": "Male",
        "accent": "Hindi",
        "lang": "hi",
        "engine": "silero",
        "voice_name": "v3_indic",
        "speaker": "hindi_male",
        "category": "Deep Narrator",
        "quality": "Studio",
        "speed_rating": "Fast",
        "speaking_style": "Offline PyTorch Silero Hindi male voice engine",
        "recommended_use": "Offline Recaps, Crime Stories, Male Narration",
        "preview_text": "उनका एक ही सपना था... एक जूके जॉइंट खोलना जहाँ लोग आज़ादी से म्यूज़िक सुन सकें।"
    },

    # 🇮🇳 Silero Regional Indic Offline Voices
    {
        "id": "indic_silero_bn_female", "name": "Silero Bengali Female (বাংলা PyTorch)",
        "gender": "Female", "accent": "Bengali", "lang": "bn", "engine": "silero", "voice_name": "v3_indic", "speaker": "bengali_female",
        "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Offline PyTorch Silero Bengali voice",
        "recommended_use": "Bengali Stories, Audiobooks, Narrations", "preview_text": "এক রাতে সবকিছু বদলে গেল..."
    },
    {
        "id": "indic_silero_bn_male", "name": "Silero Bengali Male (বাংলা পুরুষ PyTorch)",
        "gender": "Male", "accent": "Bengali", "lang": "bn", "engine": "silero", "voice_name": "v3_indic", "speaker": "bengali_male",
        "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Offline PyTorch Silero Bengali male voice",
        "recommended_use": "Bengali Documentaries, Narrations", "preview_text": "তাদের একটাই স্বপ্ন ছিল..."
    },
    {
        "id": "indic_silero_gu_female", "name": "Silero Gujarati Female (ગુજરાતી PyTorch)",
        "gender": "Female", "accent": "Gujarati", "lang": "gu", "engine": "silero", "voice_name": "v3_indic", "speaker": "gujarati_female",
        "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Offline PyTorch Silero Gujarati female voice",
        "recommended_use": "Gujarati Audiobooks & Stories", "preview_text": "એક રાત્રે બધું બદલાઈ ગયું..."
    },
    {
        "id": "indic_silero_ta_female", "name": "Silero Tamil Female (தமிழ் PyTorch)",
        "gender": "Female", "accent": "Tamil", "lang": "ta", "engine": "silero", "voice_name": "v3_indic", "speaker": "tamil_female",
        "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Offline PyTorch Silero Tamil female voice",
        "recommended_use": "Tamil Narrations & Audiobooks", "preview_text": "ஒரு இரவில் எல்லாம் மாறியது..."
    },
    {
        "id": "indic_silero_te_female", "name": "Silero Telugu Female (తెలుగు PyTorch)",
        "gender": "Female", "accent": "Telugu", "lang": "te", "engine": "silero", "voice_name": "v3_indic", "speaker": "telugu_female",
        "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Offline PyTorch Silero Telugu female voice",
        "recommended_use": "Telugu Audiobooks & Voiceovers", "preview_text": "ఒక రాత్రి అంతా మారిపోయింది..."
    },
    {
        "id": "indic_silero_kn_female", "name": "Silero Kannada Female (ಕನ್ನಡ PyTorch)",
        "gender": "Female", "accent": "Kannada", "lang": "kn", "engine": "silero", "voice_name": "v3_indic", "speaker": "kannada_female",
        "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Offline PyTorch Silero Kannada female voice",
        "recommended_use": "Kannada Audiobooks & Stories", "preview_text": "ಒಂದು ರಾತ್ರಿಯಲ್ಲಿ ಎಲ್ಲವೂ ಬದಲಾಯಿತು..."
    },
    {
        "id": "indic_silero_ml_female", "name": "Silero Malayalam Female (മലയാളം PyTorch)",
        "gender": "Female", "accent": "Malayalam", "lang": "ml", "engine": "silero", "voice_name": "v3_indic", "speaker": "malayalam_female",
        "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Offline PyTorch Silero Malayalam female voice",
        "recommended_use": "Malayalam Audiobooks & Documentaries", "preview_text": "ഒരു രാത്രി കൊണ്ട് എല്ലാം మారి..."
    },

    # 🇵🇰 Urdu Neural Voices
    {
        "id": "indic_ur_asad",
        "name": "Asad (اسد - Urdu Neural)",
        "gender": "Male",
        "accent": "Urdu",
        "lang": "ur",
        "engine": "edge_tts",
        "voice_name": "ur-PK-AsadNeural",
        "category": "Deep Narrator",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Deep, elegant Urdu male voice",
        "recommended_use": "Urdu Poetry, Documentaries, Recaps",
        "preview_text": "ایک رات نے سب کچھ بدل دیا۔ دو بھائی اپنے پرانے شہر واپس آگئے۔"
    },
    {
        "id": "indic_ur_uzma",
        "name": "Uzma (عظمیٰ - Urdu Neural)",
        "gender": "Female",
        "accent": "Urdu",
        "lang": "ur",
        "engine": "edge_tts",
        "voice_name": "ur-PK-UzmaNeural",
        "category": "Storyteller",
        "quality": "Studio HD",
        "speed_rating": "Very Fast",
        "speaking_style": "Warm, melodious Urdu female narration",
        "recommended_use": "Urdu Audiobooks, Dramas, Audio Guides",
        "preview_text": "ان کا ایک ہی خواب تھا... ایک ایسا مقام جہاں لوگ آزادانہ موسیقی سن سکیں۔"
    },
    {
        "id": "indic_ur_gtts",
        "name": "Gul (گل - Google Urdu)",
        "gender": "Female",
        "accent": "Urdu",
        "lang": "ur",
        "engine": "gtts",
        "voice_name": "ur",
        "category": "Poetic / Soft",
        "quality": "Studio",
        "speed_rating": "Fast",
        "speaking_style": "Soft, natural Urdu female tone via Google Engine",
        "recommended_use": "Poetry, Ghazal Narration, Short Clips",
        "preview_text": "مجھ سے پہلی سی محبت میری محبوب نہ مانگ..."
    },
]

INDIC_CATALOG = {v["id"]: v for v in INDIC_VOICES}


class IndicTTSService:
    """Multi-Engine Indic & Hinglish TTS Service (Silero PyTorch + Indic Neural Voices)."""

    def __init__(self):
        self._silero_model = None

    def get_voices(self) -> List[Dict[str, Any]]:
        return INDIC_VOICES

    def decode_audio_file(self, file_path: str, target_sr: int = 24000) -> np.ndarray:
        """Decode audio file (MP3/WAV) to float32 numpy array at 24000Hz via ffmpeg."""
        cmd = [
            "ffmpeg", "-y", "-i", file_path,
            "-f", "s16le", "-ac", "1", "-ar", str(target_sr),
            "pipe:1"
        ]
        try:
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, _ = p.communicate()
            if not out:
                return np.zeros(0, dtype=np.float32)
            return np.frombuffer(out, dtype=np.int16).astype(np.float32) / 32768.0
        except Exception as e:
            print(f"[IndicTTS] Audio decode error: {e}")
            return np.zeros(0, dtype=np.float32)

    def generate_silero(self, text: str, output_path: str, speaker: str = "hindi_female") -> bool:
        """Generate audio using Silero PyTorch Indic model."""
        import torch
        import scipy.io.wavfile as wavfile
        if self._silero_model is None:
            model, _ = torch.hub.load('snakers4/silero-models', 'silero_tts', language='indic', speaker='v3_indic', trust_repo=True)
            self._silero_model = model

        # Pass speaker to Silero Indic model
        valid_speaker = speaker if speaker else 'hindi_female'
        audio = self._silero_model.apply_tts(text=text, speaker=valid_speaker, sample_rate=24000)
        audio_np = audio.numpy()
        wavfile.write(output_path, 24000, (audio_np * 32767).astype(np.int16))
        return os.path.exists(output_path)

    def generate_gtts(self, text: str, output_path: str, lang: str = "ur") -> bool:
        """Generate audio using gTTS (Google Text-to-Speech)."""
        try:
            from gtts import gTTS
            tts = gTTS(text=text, lang=lang, slow=False)
            tts.save(output_path)
            return os.path.exists(output_path)
        except Exception as e:
            print(f"[IndicTTS] gTTS generation failed (falling back to Edge TTS): {e}")
            return False

    def generate(self, text: str, voice_id: str = "indic_hi_swara") -> Tuple[np.ndarray, int, float]:
        """Generate Indic / Hinglish / Urdu speech and return float32 numpy audio array."""
        start = time.time()
        meta = INDIC_CATALOG.get(voice_id, INDIC_VOICES[0])
        engine_type = meta.get("engine", "edge_tts")
        voice_name = meta.get("voice_name", "hi-IN-SwaraNeural")
        speaker = meta.get("speaker", "hindi_female")
        lang = meta.get("lang", "hi")

        # Urdu Preprocessing: Roman Urdu -> Urdu script -> Normalization
        processed_text = text
        if lang == "ur":
            processed_text = transliterate_roman_urdu_to_script(text)
            processed_text = normalize_urdu_text(processed_text)

        temp_dir = tempfile.gettempdir()
        temp_file = os.path.join(temp_dir, f"indic_{int(time.time()*1000)}.mp3")

        try:
            if engine_type == "silero":
                wav_file = temp_file.replace(".mp3", ".wav")
                success = self.generate_silero(processed_text, wav_file, speaker=speaker)
                if success:
                    audio_samples = self.decode_audio_file(wav_file, 24000)
                    if os.path.exists(wav_file):
                        os.remove(wav_file)
                    return audio_samples, 24000, time.time() - start

            elif engine_type == "gtts":
                success = self.generate_gtts(processed_text, temp_file, lang="ur")
                if success and os.path.exists(temp_file):
                    audio_samples = self.decode_audio_file(temp_file, 24000)
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                    return audio_samples, 24000, time.time() - start
                else:
                    # Fallback to Edge TTS Urdu
                    print("[IndicTTS] gTTS fallback to Edge TTS ur-PK-UzmaNeural")
                    voice_name = "ur-PK-UzmaNeural"
                    engine_type = "edge_tts"

            # Edge TTS Indic / Urdu Neural Voices
            if engine_type == "edge_tts":
                import edge_tts
                communicate = edge_tts.Communicate(processed_text, voice_name)
                asyncio.run(communicate.save(temp_file))

                if os.path.exists(temp_file):
                    audio_samples = self.decode_audio_file(temp_file, 24000)
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                    return audio_samples, 24000, time.time() - start

        except Exception as e:
            print(f"[IndicTTS] Generation failed for voice {voice_id}: {e}")

        return np.zeros(0, dtype=np.float32), 24000, 0.0


indic_tts_engine = IndicTTSService()
