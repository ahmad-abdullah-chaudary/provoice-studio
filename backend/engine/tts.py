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
from backend.engine.dsp import dsp_pipeline
from backend.engine.ssml_parser import parse_ssml, SsmlSegment
from backend.engine.silero_tts import silero_tts_service, SILERO_VOICES

# 54 Official Kokoro Offline ONNX Voice Models + Silero Indic Neural Models
VOICE_CATALOG = {
    **SILERO_VOICES,

    # 🇺🇸 American English (Female)
    "af_bella": {"id": "af_bella", "name": "Bella", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Storyteller", "quality": "Studio", "speed_rating": "Very Fast", "speaking_style": "Warm, expressive storytelling", "recommended_use": "Audiobooks, Storytelling, Podcasts", "preview_text": "Welcome to ProVoice Studio. Let's create something extraordinary today."},
    "af_sarah": {"id": "af_sarah", "name": "Sarah", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, informative, steady pace", "recommended_use": "Documentaries, E-Learning, Explainer Videos", "preview_text": "Deep in the heart of nature, extraordinary phenomena unfold silently."},
    "af_alloy": {"id": "af_alloy", "name": "Alloy", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Conversational", "quality": "HD", "speed_rating": "Fast", "speaking_style": "Modern, crisp, friendly tone", "recommended_use": "YouTube Content, Tutorials, Commercials", "preview_text": "Hey everyone! Today we're diving into the future of offline AI voice tech."},
    "af_aoede": {"id": "af_aoede", "name": "Aoede", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Resonant, graceful, articulate", "recommended_use": "Literature, Poetic Narrations, Film Introductions", "preview_text": "In the beginning, there was only silence waiting to be shaped into melody."},
    "af_heart": {"id": "af_heart", "name": "Heart", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Warm / Tender", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Soft, empathetic, comforting voice", "recommended_use": "Meditation, Bedtime Stories, Calming Guides", "preview_text": "Take a deep breath and let the quiet embrace your thoughts."},
    "af_jessica": {"id": "af_jessica", "name": "Jessica", "gender": "Female", "accent": "American", "lang": "en-us", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Professional, confident broadcast style", "recommended_use": "News Reports, Corporate Updates, Announcements", "preview_text": "Good evening. Here are today's top stories from around the globe."},
    "af_kore": {"id": "af_kore", "name": "Kore", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Gentle, lyrical narrator", "recommended_use": "Fantasy Audiobooks, Historical Fiction", "preview_text": "The wind whispered ancient secrets through the towering pines."},
    "af_nicole": {"id": "af_nicole", "name": "Nicole", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Conversational", "quality": "HD", "speed_rating": "Fast", "speaking_style": "Calm, intelligent, articulate tone", "recommended_use": "Product Demos, Tech Tutorials, Podcasts", "preview_text": "Let's explore how offline AI models deliver instantaneous results."},
    "af_nova": {"id": "af_nova", "name": "Nova", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Epic Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Dynamic, powerful, engaging", "recommended_use": "Trailers, Tech Launches, Video Essays", "preview_text": "The boundary between imagination and reality has officially dissolved."},
    "af_river": {"id": "af_river", "name": "River", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Smooth, relaxed, organic cadence", "recommended_use": "Documentaries, Nature Vlogs, Podcasts", "preview_text": "Rivers carve their pathways slowly, shaping the landscape over millennia."},
    "af_sky": {"id": "af_sky", "name": "Sky", "gender": "Female", "accent": "American", "lang": "en-us", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Bright, uplifting, energetic tone", "recommended_use": "Commercials, Shorts, Social Content", "preview_text": "Good morning! Are you ready for a brand new adventure?"},

    # 🇺🇸 American English (Male)
    "am_adam": {"id": "am_adam", "name": "Adam", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Very Fast", "speaking_style": "Rich, authoritative, deep bass tone", "recommended_use": "Documentaries, Trailers, Cinematic Recaps", "preview_text": "In a world driven by innovation, precision is the ultimate virtue."},
    "am_echo": {"id": "am_echo", "name": "Echo", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Movie Explainer", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Crisp, fast-paced, engaging presentation", "recommended_use": "Movie Recaps, YouTube Essays, Science Videos", "preview_text": "He thought he could escape, but he had no idea what was waiting around the corner."},
    "am_eric": {"id": "am_eric", "name": "Eric", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Conversational", "quality": "HD", "speed_rating": "Fast", "speaking_style": "Warm, confident, conversational male tone", "recommended_use": "Business Presentations, Software Demos, Tech Guides", "preview_text": "Let's walk through how to configure your local project settings in three simple steps."},
    "am_fenrir": {"id": "am_fenrir", "name": "Fenrir", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Epic Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Gravelly, powerful, dramatic presentation", "recommended_use": "Game Characters, Fantasy Trailers, Dark Audiobooks", "preview_text": "Shadows fall across the kingdom, but the fire within remains unquenched."},
    "am_liam": {"id": "am_liam", "name": "Liam", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Natural, everyday American male voice", "recommended_use": "Vlogs, Reviews, Commercials", "preview_text": "Hey everyone, welcome back to the channel. Let's get right into it."},
    "am_michael": {"id": "am_michael", "name": "Michael", "gender": "Male", "accent": "American", "lang": "en-us", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, professional, neutral delivery", "recommended_use": "Financial Reports, Daily News, Educational Content", "preview_text": "Market indicators show strong growth across key technology sectors today."},
    "am_onyx": {"id": "am_onyx", "name": "Onyx", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Dark Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Deep, mysterious, commanding voice", "recommended_use": "Thriller Narrations, Crime Documentaries, Sci-Fi", "preview_text": "The dossier had been sealed for thirty years. Until tonight."},
    "am_puck": {"id": "am_puck", "name": "Puck", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Playful, youthful, expressive delivery", "recommended_use": "Animation, Gaming, Comedy, Shorts", "preview_text": "Wait till you see what happens next—you won't believe it!"},
    "am_santa": {"id": "am_santa", "name": "Santa", "gender": "Male", "accent": "American", "lang": "en-us", "category": "Epic Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Hearty, resonant, jolly baritone", "recommended_use": "Holiday Specials, Storytelling, Festive Ads", "preview_text": "Ho ho ho! Season's greetings to everyone around the world."},

    # 🇬🇧 British English
    "bf_alice": {"id": "bf_alice", "name": "Alice", "gender": "Female", "accent": "British", "lang": "en-gb", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Sophisticated, articulate, refined RP accent", "recommended_use": "Nature Documentaries, Historical Content, Museums", "preview_text": "Across centuries of history, architectural marvels have stood as testimony to human genius."},
    "bf_emma": {"id": "bf_emma", "name": "Emma", "gender": "Female", "accent": "British", "lang": "en-gb", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm British narration, melodic cadence", "recommended_use": "Classic Novels, Children's Books, Drama", "preview_text": "It is a truth universally acknowledged that a good story warms the heart."},
    "bf_isabella": {"id": "bf_isabella", "name": "Isabella", "gender": "Female", "accent": "British", "lang": "en-gb", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Poised, elegant British narration", "recommended_use": "Audiobooks, Luxury Brand Commercials", "preview_text": "True elegance lies in quiet confidence and timeless design."},
    "bf_lily": {"id": "bf_lily", "name": "Lily", "gender": "Female", "accent": "British", "lang": "en-gb", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Sweet, bright, contemporary British voice", "recommended_use": "E-Learning, Audiobooks, Commercials", "preview_text": "Welcome to our tutorial. Let's make learning simple and enjoyable."},
    "bm_daniel": {"id": "bm_daniel", "name": "Daniel", "gender": "Male", "accent": "British", "lang": "en-gb", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Deep, scholarly British voice", "recommended_use": "Biographies, Science Essays, Historical Narrations", "preview_text": "The cosmos is vast beyond human comprehension, filled with mysteries awaiting discovery."},
    "bm_fable": {"id": "bm_fable", "name": "Fable", "gender": "Male", "accent": "British", "lang": "en-gb", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Engaging theatrical British narrator", "recommended_use": "Fantasy Novels, RPG Voiceovers, Drama", "preview_text": "Legend speaks of a forgotten blade forged in the depths of the ancient mountains."},
    "bm_george": {"id": "bm_george", "name": "George", "gender": "Male", "accent": "British", "lang": "en-gb", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Distinguished, calm British broadcasting tone", "recommended_use": "BBC-style Documentaries, Academic Lectures", "preview_text": "Observations conducted over decades reveal extraordinary patterns of migration."},
    "bm_lewis": {"id": "bm_lewis", "name": "Lewis", "gender": "Male", "accent": "British", "lang": "en-gb", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, modern, authoritative British male voice", "recommended_use": "News, Business Updates, Technical Narrations", "preview_text": "Here is the latest financial report from global market exchanges."},

    # 🇪🇸 Spanish
    "ef_dora": {"id": "ef_dora", "name": "Dora", "gender": "Female", "accent": "Spanish", "lang": "es", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm, natural Spanish storytelling tone", "recommended_use": "Spanish Dubbing, Audiobooks, Commercials", "preview_text": "Hola y bienvenido a ProVoice Studio. Creemos narraciones extraordinarias hoy."},
    "em_alex": {"id": "em_alex", "name": "Alex", "gender": "Male", "accent": "Spanish", "lang": "es", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, professional Spanish male voice", "recommended_use": "Documentaries, Course Dubbing, News", "preview_text": "En el corazón de la historia, grandes descubrimientos cambian el mundo."},
    "em_santa": {"id": "em_santa", "name": "Santa (ES)", "gender": "Male", "accent": "Spanish", "lang": "es", "category": "Epic Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Jolly, resonant Spanish character voice", "recommended_use": "Holiday Content, Animated Dubbing", "preview_text": "¡Feliz Navidad y próspero año nuevo para todos!"},

    # 🇫🇷 French
    "ff_siwis": {"id": "ff_siwis", "name": "Siwis", "gender": "Female", "accent": "French", "lang": "fr", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Elegant French narration, clear diction", "recommended_use": "French Audiobooks, Documentaries, Luxury Ads", "preview_text": "Bienvenue dans ProVoice Studio. Produisez des voix off d'une qualité exceptionnelle."},

    # 🇮🇳 Hindi (100% Offline Kokoro Models)
    "hf_alpha": {"id": "hf_alpha", "name": "Alpha (अल्फा)", "gender": "Female", "accent": "Hindi", "lang": "hi", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm, natural Hindi female voice (supports Devanagari & Roman Hinglish)", "recommended_use": "Hindi Voiceovers, Audiobooks, Commercials, YouTube Recaps", "preview_text": "प्रोवॉयस स्टूडियो में आपका स्वागत है। आइए बेहतरीन आवाज बनाएं।"},
    "hf_beta": {"id": "hf_beta", "name": "Beta (बीटा)", "gender": "Female", "accent": "Hindi", "lang": "hi", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Expressive Hindi female narrator", "recommended_use": "Stories, Audiobooks, Explainer Videos", "preview_text": "एक रात ने सब कुछ बदल दिया... दो भाई अपने पुराने शहर वापस आए।"},
    "hm_omega": {"id": "hm_omega", "name": "Omega (ओमेगा)", "gender": "Male", "accent": "Hindi", "lang": "hi", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Deep, authoritative Hindi male voice", "recommended_use": "Crime Recaps, Trailers, Documentaries", "preview_text": "अंधेरे की गहराइयों में एक नया राज़ छुपा था... जिसे दुनिया कभी नहीं जान सकी।"},
    "hm_psi": {"id": "hm_psi", "name": "Psi (साई)", "gender": "Male", "accent": "Hindi", "lang": "hi", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear Hindi male broadcasting voice", "recommended_use": "News Recaps, Documentaries, Educational Videos", "preview_text": "तकनीक की दुनिया में एक नया अध्याय आज से शुरू होता है।"},

    # 🇮🇹 Italian
    "if_sara": {"id": "if_sara", "name": "Sara", "gender": "Female", "accent": "Italian", "lang": "it", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Expressive, melodic Italian narration", "recommended_use": "Italian Voiceovers, Audio Guides, Podcasts", "preview_text": "Benvenuti in ProVoice Studio. Creiamo narrazioni vocali straordinarie."},
    "im_nicola": {"id": "im_nicola", "name": "Nicola", "gender": "Male", "accent": "Italian", "lang": "it", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm, confident Italian male narrator", "recommended_use": "Documentaries, Commercials, Course Dubbing", "preview_text": "Un viaggio affascinante attraverso la storia e la cultura italiana."},

    # 🇯🇵 Japanese
    "jf_alpha": {"id": "jf_alpha", "name": "Alpha (アルファ)", "gender": "Female", "accent": "Japanese", "lang": "ja", "category": "Anime / Explainer", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, modern Japanese narration", "recommended_use": "Anime Voiceover, YouTube Essays, Tutorials", "preview_text": "ProVoice Studioへようこそ。高音質なAI音声ナレーションを体験してください。"},
    "jf_gongitsune": {"id": "jf_gongitsune", "name": "Gongitsune (ごんぎつね)", "gender": "Female", "accent": "Japanese", "lang": "ja", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Traditional Japanese storytelling cadence", "recommended_use": "Folk Tales, Audiobooks, Narratives", "preview_text": "むかしむかし、ある森に小さないたずらぎつねが住んでいました。"},
    "jf_nezumi": {"id": "jf_nezumi", "name": "Nezumi (ねずみ)", "gender": "Female", "accent": "Japanese", "lang": "ja", "category": "Anime / Character", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Lively, animated Japanese character voice", "recommended_use": "Animation, Games, Children's Content", "preview_text": "こんにちは！今日も元気に冒険を始めましょう！"},
    "jf_tebukuro": {"id": "jf_tebukuro", "name": "Tebukuro (てぶくろ)", "gender": "Female", "accent": "Japanese", "lang": "ja", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Gentle, soothing Japanese narration", "recommended_use": "Audiobooks, Bedtime Stories, Meditation", "preview_text": "雪が静かに降り積もる森の中で、小さな手袋が見つかりました。"},
    "jm_kumo": {"id": "jm_kumo", "name": "Kumo (クモ)", "gender": "Male", "accent": "Japanese", "lang": "ja", "category": "Deep Narrator", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Resonant Japanese male voice", "recommended_use": "Documentaries, Game Voices, Commercials", "preview_text": "新しい時代のローカルAI音声技術が、ここに始まります。"},

    # 🇧🇷 Portuguese
    "pf_dora": {"id": "pf_dora", "name": "Dora (PT)", "gender": "Female", "accent": "Portuguese", "lang": "pt", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm Portuguese female narration", "recommended_use": "Portuguese Dubbing, Audiobooks, Commercials", "preview_text": "Bem-vindo ao ProVoice Studio. Vamos criar locuções incríveis hoje."},
    "pm_alex": {"id": "pm_alex", "name": "Alex (PT)", "gender": "Male", "accent": "Portuguese", "lang": "pt", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear Portuguese male narrator", "recommended_use": "Documentaries, E-Learning, News", "preview_text": "Descubra novas possibilidades com narrações de alta fidelidade."},
    "pm_santa": {"id": "pm_santa", "name": "Santa (PT)", "gender": "Male", "accent": "Portuguese", "lang": "pt", "category": "Epic Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Jolly Portuguese character voice", "recommended_use": "Holiday Specials, Storytelling", "preview_text": "Feliz Natal e um próspero Ano Novo para todos!"},

    # 🇨🇳 Mandarin Chinese
    "zf_xiaobei": {"id": "zf_xiaobei", "name": "Xiaobei (小北)", "gender": "Female", "accent": "Mandarin", "lang": "zh", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Fluent, professional Mandarin female tone", "recommended_use": "Mandarin Dubbing, Audiobooks, E-Learning", "preview_text": "欢迎使用 ProVoice Studio。体验高品质离线 AI 语音旁白。"},
    "zf_xiaoni": {"id": "zf_xiaoni", "name": "Xiaoni (小妮)", "gender": "Female", "accent": "Mandarin", "lang": "zh", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Lively, pleasant Mandarin voice", "recommended_use": "Commercials, Vlogs, Social Media", "preview_text": "大家好，今天我们来分享一些非常实用的小技巧。"},
    "zf_xiaoxiao": {"id": "zf_xiaoxiao", "name": "Xiaoxiao (小小)", "gender": "Female", "accent": "Mandarin", "lang": "zh", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Warm, engaging Mandarin storyteller", "recommended_use": "Audiobooks, Children Stories", "preview_text": "很久很久以前，在一个美丽的森林里，生活着一群可爱的小动物。"},
    "zf_xiaoyi": {"id": "zf_xiaoyi", "name": "Xiaoyi (小艺)", "gender": "Female", "accent": "Mandarin", "lang": "zh", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Professional Mandarin broadcaster", "recommended_use": "News Broadcasts, Corporate Videos", "preview_text": "现在播送今日重点新闻摘要。"},
    "zm_yunjian": {"id": "zm_yunjian", "name": "Yunjian (云剑)", "gender": "Male", "accent": "Mandarin", "lang": "zh", "category": "Documentary", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Authoritative Mandarin male narrator", "recommended_use": "Documentaries, Film Recaps, Corporate Videos", "preview_text": "探索科技与创意的无限可能，打造极致声音体验。"},
    "zm_yunxi": {"id": "zm_yunxi", "name": "Yunxi (云希)", "gender": "Male", "accent": "Mandarin", "lang": "zh", "category": "Conversational", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Modern, friendly Mandarin male voice", "recommended_use": "Tech Reviews, Podcasts, YouTube Narrations", "preview_text": "欢迎收听本期节目，让我们一起探讨最新的科技动态。"},
    "zm_yunxia": {"id": "zm_yunxia", "name": "Yunxia (云夏)", "gender": "Male", "accent": "Mandarin", "lang": "zh", "category": "News Voice", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Clear, steady Mandarin broadcast voice", "recommended_use": "Financial Updates, E-Learning", "preview_text": "接下来为您带来详细的行业分析报道。"},
    "zm_yunyang": {"id": "zm_yunyang", "name": "Yunyang (云扬)", "gender": "Male", "accent": "Mandarin", "lang": "zh", "category": "Storyteller", "quality": "Studio", "speed_rating": "Fast", "speaking_style": "Deep, expressive Mandarin narrator", "recommended_use": "Audiobooks, Historical Drama", "preview_text": "岁月流转，那段波澜壮阔的历史依然令人心潮澎湃。"},
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
    if getattr(sys, 'frozen', False):
        meipass = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        candidate = os.path.join(meipass, filename)
        if os.path.exists(candidate):
            return candidate

    models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
    candidate = os.path.join(models_dir, filename)
    if os.path.exists(candidate):
        return candidate

    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    candidate = os.path.join(root_dir, filename)
    if os.path.exists(candidate):
        return candidate

    return os.path.join(models_dir, filename)


def ensure_model_files_exist(model_path: str = "kokoro-v1.0.onnx", voices_path: str = "voices-v1.0.bin"):
    """Downloads model files if missing."""
    import urllib.request
    os.makedirs(os.path.dirname(os.path.abspath(model_path)), exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(voices_path)), exist_ok=True)

    if not os.path.exists(model_path):
        print(f"[KokoroTTS] Model not found at {model_path}. Attempting download...")
        for url in KOKORO_MODEL_URLS:
            try:
                print(f"[KokoroTTS] Trying {url}...")
                urllib.request.urlretrieve(url, model_path)
                if os.path.exists(model_path) and os.path.getsize(model_path) > 1_000_000:
                    print("[KokoroTTS] Model downloaded successfully.")
                    break
            except Exception as e:
                print(f"[KokoroTTS] Download failed from {url}: {e}")

    if not os.path.exists(voices_path):
        print(f"[KokoroTTS] Voices file not found at {voices_path}. Attempting download...")
        for url in VOICES_BIN_URLS:
            try:
                print(f"[KokoroTTS] Trying {url}...")
                urllib.request.urlretrieve(url, voices_path)
                if os.path.exists(voices_path) and os.path.getsize(voices_path) > 100_000:
                    print("[KokoroTTS] Voices downloaded successfully.")
                    break
            except Exception as e:
                print(f"[KokoroTTS] Download failed from {url}: {e}")


def sanitize_voice_id(voice_id: str, default: str = "af_bella") -> str:
    """Sanitize any deprecated or invalid voice ID into an authentic Kokoro/Silero offline voice."""
    if not voice_id:
        return default
    if voice_id in VOICE_CATALOG:
        return voice_id
    if voice_id.startswith("silero_"):
        return voice_id
    
    # Legacy voice ID mappings from old sessions / local storage
    legacy_map = {
        "indic_hi_madhur": "silero_hindi_male",
        "indic_hi_swara": "silero_hindi_female",
        "indic_silero_hi_male": "silero_hindi_male",
        "indic_silero_hi_female": "silero_hindi_female",
        "hi_pratham": "silero_hindi_male",
        "hi_priyamvada": "silero_hindi_female",
        "hi_rohan": "hm_psi",
        "ur_fasih": "silero_hindi_male",
    }
    if voice_id in legacy_map:
        return legacy_map[voice_id]
    
    # Heuristic fallback for any other Indic / Hindi voice keys
    if "hi" in voice_id or "indic" in voice_id:
        if any(k in voice_id for k in ("male", "madhur", "omega", "rohan", "pratham", "boy")):
            return "silero_hindi_male"
        return "silero_hindi_female"
        
    return default


class KokoroTTSService:
    """100% Local Offline Kokoro ONNX Speech Synthesis Service."""

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
            print(f"[KokoroTTS] Model files unavailable at {self.model_path}.")
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

        # 1. Silero Neural Indic Voices
        if silero_tts_service.available:
            for vid, v in silero_tts_service.get_voices().items():
                if not lang_filter or lang_filter == "all" or v.get("lang") == lang_filter:
                    result.append(v)

        # 2. Kokoro ONNX voices (verified against model binary)
        if self.initialize() and self.kokoro is not None:
            try:
                raw_voices = self.kokoro.get_voices()
                for vid in raw_voices:
                    if vid in VOICE_CATALOG:
                        v = VOICE_CATALOG[vid]
                        if not lang_filter or lang_filter == "all" or v.get("lang") == lang_filter:
                            if not any(r["id"] == vid for r in result):
                                result.append(v)
                    else:
                        gender = "Female" if vid[:2] in ("af", "bf", "ef", "ff", "hf", "if", "jf", "pf", "zf") else "Male"
                        lang_map = {
                            "af": ("American", "en-us"), "am": ("American", "en-us"),
                            "bf": ("British", "en-gb"), "bm": ("British", "en-gb"),
                            "ef": ("Spanish", "es"), "em": ("Spanish", "es"),
                            "ff": ("French", "fr"),
                            "hf": ("Hindi", "hi"), "hm": ("Hindi", "hi"),
                            "if": ("Italian", "it"), "im": ("Italian", "it"),
                            "jf": ("Japanese", "ja"), "jm": ("Japanese", "ja"),
                            "pf": ("Portuguese", "pt"), "pm": ("Portuguese", "pt"),
                            "zf": ("Mandarin", "zh"), "zm": ("Mandarin", "zh")
                        }
                        accent, lang_code = lang_map.get(vid[:2], ("International", vid[:2]))
                        v = {
                            "id": vid, "name": vid.replace("_", " ").title(), "gender": gender,
                            "accent": accent, "lang": lang_code, "category": "General", "quality": "Studio",
                            "engine": "Kokoro ONNX",
                            "speed_rating": "Fast", "speaking_style": f"Standard {accent} {gender} Voice",
                            "recommended_use": "General Narration, Voiceovers",
                            "preview_text": f"Hello, this is the {vid.replace('_', ' ').title()} voice."
                        }
                        if not lang_filter or lang_filter == "all" or lang_code == lang_filter:
                            if not any(r["id"] == vid for r in result):
                                result.append(v)
            except Exception as e:
                print(f"[KokoroTTS] Voice enumeration error: {e}")

        # Fallback to catalog if model not yet initialized
        if not result:
            for vid, v in VOICE_CATALOG.items():
                if not lang_filter or lang_filter == "all" or v.get("lang") == lang_filter:
                    result.append(v)

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
        """Generate speech using local offline Kokoro ONNX or Silero Indic model."""
        self.initialize()
        if self.kokoro is None and not silero_tts_service.available:
            raise RuntimeError("TTS models unavailable. Please ensure kokoro-v1.0.onnx and voices-v1.0.bin are present.")
        start_time = time.time()
        sample_rate = 24000

        # Sanitize base voice (e.g. migrate legacy/removed voice IDs to authentic Kokoro/Silero models)
        voice = sanitize_voice_id(voice)

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

            # Determine segment voice & language (sanitizing any legacy IDs)
            seg_voice = sanitize_voice_id(ssml_seg.voice or voice, default=voice)
            if self.kokoro and not seg_voice.startswith("silero_") and seg_voice not in self.kokoro.get_voices() and seg_voice not in VOICE_CATALOG:
                seg_voice = voice

            seg_lang = lang
            voice_meta = VOICE_CATALOG.get(seg_voice)
            if voice_meta and "lang" in voice_meta:
                seg_lang = voice_meta["lang"]
            else:
                prefix_lang = {
                    "af": "en-us", "am": "en-us", "bf": "en-gb", "bm": "en-gb",
                    "ef": "es", "em": "es", "ff": "fr", "hf": "hi", "hm": "hi",
                    "if": "it", "im": "it", "jf": "ja", "jm": "ja",
                    "pf": "pt", "pm": "pt", "zf": "zh", "zm": "zh"
                }
                seg_lang = prefix_lang.get(seg_voice[:2], lang)

            # Auto-transliterate Roman Hinglish for Hindi voices
            seg_text = ssml_seg.text
            if seg_lang == "hi" or seg_voice.startswith(("hf_", "hm_", "silero_hindi_", "silero_rajasthani_")):
                seg_text = transliterate_hinglish_to_devanagari(seg_text)

            # Determine speed & emotion for this segment
            seg_speed = ssml_seg.speed_override if ssml_seg.speed_override is not None else speed
            effective_emotion = ssml_seg.emotion or emotion
            if effective_emotion in EMOTION_PRESETS:
                ep = EMOTION_PRESETS[effective_emotion]
                seg_speed = seg_speed * ep["speed"]

            # ── Route Silero Indic voices to SileroTTSService ──────────────
            if seg_voice.startswith("silero_") and silero_tts_service.available:
                try:
                    if progress_callback:
                        progress_callback(seg_idx + 1, total_segs, seg_text[:60])
                    silero_audio, silero_sr = silero_tts_service.synthesize(
                        seg_text, voice_id=seg_voice, speed=seg_speed
                    )
                    if silero_sr:
                        sample_rate = silero_sr
                    audio_segments.append(silero_audio)
                    # Add paragraph/sentence gap
                    gap_ms = paragraph_gap_ms if "\n" in seg_text else sentence_gap_ms
                    if seg_idx < total_segs - 1:
                        audio_segments.append(np.zeros(int(sample_rate * gap_ms / 1000), dtype=np.float32))
                except Exception as e:
                    print(f"[SileroTTS] Synthesis error for '{seg_voice}': {e}")
                continue  # Skip Kokoro processing for this segment

            chunks = self.chunk_text(seg_text)
            if not chunks:
                continue

            gender = "female" if seg_voice[:2] in ("af", "bf", "ef", "ff", "hf", "if", "jf", "pf", "zf") else "male"
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
