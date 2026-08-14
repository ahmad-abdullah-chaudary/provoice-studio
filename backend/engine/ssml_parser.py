"""
SSML Script Tag Parser + NLP Auto-Emotion Detector
===================================================
Provides two capabilities:
  1. parse_ssml(text)  →  List[SsmlSegment]
     Splits a script with inline tags into typed segments that the TTS
     engine processes individually, then concatenates.

  2. detect_emotion(sentence) → str
     Returns the best-matching emotion preset name ('normal', 'dramatic',
     'sad', 'energetic', 'whispering', 'news') for a single sentence,
     purely via keyword matching – no ML, no external deps, zero latency.

Supported Tags
--------------
  [pause:500]            – silence of 500 ms (no voice required)
  [break:800]            – alias for pause
  [speed:0.8] text here  – speed override (affects until next tag or end)
  [whisper] text [/whisper]  – whisper DSP mode (treble boost, presence)
  [em] text [/em]        – emphasis (slight speed-down, presence boost)
  [voice:am_adam] text [/voice]  – switch voice for this block
  [emotion:dramatic] text [/emotion]  – force an emotion preset

Design Principles (Robustness)
-------------------------------
  * Every tag is optional. If parsing produces zero segments, the whole
    text is returned as a single 'speech' segment. Never raises on bad tags.
  * Unknown / misspelled tags are passed through as literal text.
  * Voice IDs in [voice:] tags are validated against a known set at call
    site; invalid IDs fall back to the base voice without error.
  * Regex patterns use non-greedy matching to prevent runaway captures.
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

# ─── Segment Data Model ────────────────────────────────────────────────────────

@dataclass
class SsmlSegment:
    """One unit of work for the TTS engine."""
    kind: str              # 'speech' | 'pause'
    text: str = ""
    pause_ms: int = 0      # only when kind='pause'
    voice: Optional[str] = None      # None = use base voice
    speed_override: Optional[float] = None  # None = use base speed
    whisper: bool = False
    emphasis: bool = False
    emotion: Optional[str] = None    # None = use auto-detect or base


# ─── Tag Regex Patterns ───────────────────────────────────────────────────────

# Matches: [pause:NNN] or [break:NNN]
_RE_PAUSE = re.compile(r'\[(pause|break):(\d+)\]', re.IGNORECASE)

# Matches: [speed:N.N] (sets speed until end or next override)
_RE_SPEED = re.compile(r'\[speed:([\d.]+)\]', re.IGNORECASE)

# Matches: [whisper]...[/whisper]  (non-greedy)
_RE_WHISPER = re.compile(r'\[whisper\](.*?)\[/whisper\]', re.IGNORECASE | re.DOTALL)

# Matches: [em]...[/em]
_RE_EM = re.compile(r'\[em\](.*?)\[/em\]', re.IGNORECASE | re.DOTALL)

# Matches: [voice:ID]...[/voice]
_RE_VOICE = re.compile(r'\[voice:([^\]]+)\](.*?)\[/voice\]', re.IGNORECASE | re.DOTALL)

# Matches: [emotion:NAME]...[/emotion]
_RE_EMOTION = re.compile(r'\[emotion:([^\]]+)\](.*?)\[/emotion\]', re.IGNORECASE | re.DOTALL)

# Any remaining tag-like constructs we don't recognise — strip them to avoid
# literal brackets being read aloud by the TTS engine
_RE_UNKNOWN_TAG = re.compile(r'\[/?[a-z][^\]]*\]', re.IGNORECASE)


# ─── NLP Auto-Emotion Detector ────────────────────────────────────────────────

# Keyword sets per emotion — ordered from most-specific to least-specific.
# Keep these tightly curated; broad words cause false-positive detections.
_EMOTION_KEYWORDS: Dict[str, List[str]] = {
    "dramatic": [
        "suddenly", "silence", "darkness", "shadow", "fear", "terror", "horror",
        "shock", "thunder", "blood", "alone", "death", "dying", "fell", "collapse",
        "shattered", "froze", "gasped", "screamed", "vanished", "disappeared",
        "betrayed", "trapped", "desperate", "warned", "danger", "exploded",
        "whispered a warning", "no one knew", "last chance", "too late",
        "ek raat", "sab kuch badal", "khatarnaak", "darr", "maut",
        "دشمن", "موت", "خطرہ", "اندھیرا", "خوف", "dushman", "maut", "khatara", "andhera",
    ],
    "sad": [
        "tears", "grief", "sorrow", "broken", "lost", "farewell", "goodbye",
        "miss", "missed", "alone", "lonely", "pain", "hurt", "cry", "crying",
        "wept", "mourned", "tragedy", "heartbroken", "devastated", "regret",
        "forgive", "apology", "never returned", "gone forever", "dard", "udaas",
        "rota", "aansu", "bichad", "alvida",
        "آنسو", "تنہا", "درد", "غم", "بیوفا", "جدائی", "aansu", "tanha", "dard", "gham", "judaai",
    ],
    "energetic": [
        "amazing", "incredible", "unbelievable", "wow", "fantastic", "awesome",
        "breakthrough", "victory", "win", "won", "champion", "launch", "now",
        "today", "exciting", "lets go", "come on", "unstoppable", "record",
        "fastest", "biggest", "best ever", "officially", "announced",
        "jazbaat", "josh", "azaadi", "zindagi",
        "جیت", "کامیابی", "جوش", "انقلاب", "شاندار", "jeet", "kamyabi", "josh", "inqilab",
    ],
    "whispering": [
        "secret", "quietly", "softly", "hushed", "silent", "gentle", "slowly",
        "tiptoed", "crept", "barely", "faint", "murmured", "whispered",
        "no one heard", "between us", "don't tell", "private", "hidden",
        "dheere", "chup", "aaraam se",
        "آہستہ", "چپ", "راز", "خاموش", "ahista", "chup", "raaz", "khamosh",
    ],
    "news": [
        "report", "breaking", "announced", "confirmed", "official", "sources",
        "according to", "government", "authorities", "statement", "press",
        "today marks", "as of today", "latest update", "news", "headline",
        "khabar", "samachar", "ghoshna",
        "خبر", "بیان", "حکومت", "اعلان", "کابینہ", "khabar", "bayan", "hukumat",
    ],
    "sher": [
        "شعر", "شاعری", "غزل", "مصرع", "شاعر", "دیوان",
        "shayari", "shair", "ghazal", "misra", "kalam", "urdu poetry",
    ],
}

# Total keyword hits required before we act on an emotion (avoid false positives)
_MIN_HITS_REQUIRED = 1


def detect_emotion(sentence: str) -> str:
    """Return the best-matching emotion preset name for a single sentence.

    Returns 'normal' when no emotion signal is detected.
    Never raises; safe to call on any string including empty strings.
    """
    if not sentence or not sentence.strip():
        return "normal"

    s_lower = sentence.lower()
    scores: Dict[str, int] = {}

    for emotion, keywords in _EMOTION_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in s_lower)
        if hits >= _MIN_HITS_REQUIRED:
            scores[emotion] = hits

    if not scores:
        return "normal"

    # Return emotion with most keyword hits; on tie, preserve dict order
    return max(scores, key=lambda e: scores[e])


# ─── SSML Parser ─────────────────────────────────────────────────────────────

def parse_ssml(
    text: str,
    base_voice: str = "af_bella",
    base_speed: float = 1.0,
    nlp_auto_emotion: bool = True,
) -> List[SsmlSegment]:
    """Parse inline SSML tags in `text` and return a list of SsmlSegments.

    Robustness guarantees:
      - If the full input has no tags → returns [SsmlSegment(kind='speech', text=text)]
      - If any tag is malformed → that portion is passed through as literal text
      - Exception-safe: wraps the entire parse in try/except and returns the
        raw text as a single segment on any unexpected error.
    """
    if not text or not text.strip():
        return [SsmlSegment(kind="speech", text=text or "")]

    try:
        return _do_parse(text, base_voice, base_speed, nlp_auto_emotion)
    except Exception as exc:
        # Never crash generation — fall back to raw text
        print(f"[SSMLParser] Parse error (falling back to raw text): {exc}")
        return [SsmlSegment(kind="speech", text=text)]


def _do_parse(
    text: str,
    base_voice: str,
    base_speed: float,
    nlp_auto_emotion: bool,
) -> List[SsmlSegment]:
    """Internal parser. Called by parse_ssml inside a try/except."""

    segments: List[SsmlSegment] = []
    current_speed = base_speed

    # We process the string left-to-right, consuming it as we go.
    # Strategy: find the leftmost tag; emit text before it as a speech
    # segment; process the tag; continue.

    # Build a combined pattern that matches the START of any known tag.
    # Groups: (1) pause/break ms | (2) speed val | (3) whisper body |
    #         (4) em body | (5) voice id, (6) voice body |
    #         (7) emotion name, (8) emotion body | (9) sher body
    combined = re.compile(
        r'\[(pause|break):(\d+)\]'               # pause
        r'|\[speed:([\d.]+)\]'                    # speed override
        r'|\[whisper\](.*?)\[/whisper\]'          # whisper block
        r'|\[em\](.*?)\[/em\]'                    # emphasis block
        r'|\[voice:([^\]]+)\](.*?)\[/voice\]'     # voice switch block
        r'|\[emotion:([^\]]+)\](.*?)\[/emotion\]' # emotion force block
        r'|\[sher\](.*?)\[/sher\]',               # Urdu poetry sher block
        re.IGNORECASE | re.DOTALL,
    )

    pos = 0
    for m in combined.finditer(text):
        # Text before this match → speech segment
        before = text[pos:m.start()]
        if before.strip():
            _emit_speech(before, base_voice, current_speed,
                         nlp_auto_emotion, segments)
        pos = m.end()

        g = m.groups()

        if g[0] is not None:
            # [pause:NNN] or [break:NNN]
            ms = max(0, min(int(g[1]), 10_000))  # clamp 0–10 s
            segments.append(SsmlSegment(kind="pause", pause_ms=ms))

        elif g[2] is not None:
            # [speed:N.N]  — just updates the running speed; no audio output
            try:
                current_speed = max(0.3, min(float(g[2]), 3.0))  # clamp
            except ValueError:
                pass  # ignore malformed speed value

        elif g[3] is not None:
            # [whisper]...[/whisper]
            body = g[3].strip()
            if body:
                emotion = detect_emotion(body) if nlp_auto_emotion else None
                segments.append(SsmlSegment(
                    kind="speech", text=body,
                    voice=base_voice, speed_override=current_speed * 0.92,
                    whisper=True, emotion=emotion,
                ))

        elif g[4] is not None:
            # [em]...[/em]  — emphasis
            body = g[4].strip()
            if body:
                emotion = detect_emotion(body) if nlp_auto_emotion else None
                segments.append(SsmlSegment(
                    kind="speech", text=body,
                    voice=base_voice, speed_override=current_speed * 0.94,
                    emphasis=True, emotion=emotion,
                ))

        elif g[5] is not None:
            # [voice:ID]...[/voice]
            voice_id = g[5].strip()
            body = (g[6] or "").strip()
            if body:
                emotion = detect_emotion(body) if nlp_auto_emotion else None
                segments.append(SsmlSegment(
                    kind="speech", text=body,
                    voice=voice_id,            # validated by TTS engine
                    speed_override=current_speed,
                    emotion=emotion,
                ))

        elif g[7] is not None:
            # [emotion:NAME]...[/emotion]
            forced_emotion = g[7].strip().lower()
            body = (g[8] or "").strip()
            if body:
                segments.append(SsmlSegment(
                    kind="speech", text=body,
                    voice=base_voice, speed_override=current_speed,
                    emotion=forced_emotion,   # forced override
                ))

        elif g[9] is not None:
            # [sher]...[/sher] — Urdu Poetry / Sher-o-Shayari block
            body = g[9].strip()
            if body:
                lines = [line.strip() for line in body.split('\n') if line.strip()]
                for idx, line in enumerate(lines):
                    segments.append(SsmlSegment(
                        kind="speech", text=line,
                        voice=base_voice, speed_override=0.82,
                        emphasis=True, emotion="sher"
                    ))
                    if idx < len(lines) - 1:
                        segments.append(SsmlSegment(kind="pause", pause_ms=600))

    # Remaining text after the last tag
    tail = text[pos:]
    if tail.strip():
        _emit_speech(tail, base_voice, current_speed, nlp_auto_emotion, segments)

    # If nothing was parsed (no tags found), return raw text as single segment
    if not segments:
        seg = SsmlSegment(kind="speech", text=text, voice=base_voice, speed_override=base_speed)
        if nlp_auto_emotion:
            seg.emotion = detect_emotion(text)
        return [seg]

    return segments


def _emit_speech(
    text: str,
    voice: str,
    speed: float,
    nlp_auto_emotion: bool,
    out: List[SsmlSegment],
) -> None:
    """Emit one or more speech segments for a plain-text block.

    Splits on sentence boundaries so NLP emotion detection works per sentence.
    Each sentence group is a separate segment only when emotions differ.
    Identical consecutive emotions are merged to reduce TTS call count.
    """
    # Clean up any leftover unknown tags before TTS sees the text
    clean = _RE_UNKNOWN_TAG.sub("", text).strip()
    if not clean:
        return

    if not nlp_auto_emotion:
        out.append(SsmlSegment(
            kind="speech", text=clean,
            voice=voice, speed_override=speed, emotion=None,
        ))
        return

    # Split into sentences for per-sentence emotion detection
    # Handles: ., !, ?, ... and Devanagari ।
    sentences = re.split(r'(?<=[.!?।…])\s+', clean)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return

    # Group consecutive sentences with the same emotion into one segment
    current_emotion = detect_emotion(sentences[0])
    buffer = [sentences[0]]

    for sent in sentences[1:]:
        e = detect_emotion(sent)
        if e == current_emotion:
            buffer.append(sent)
        else:
            out.append(SsmlSegment(
                kind="speech", text=" ".join(buffer),
                voice=voice, speed_override=speed, emotion=current_emotion,
            ))
            buffer = [sent]
            current_emotion = e

    if buffer:
        out.append(SsmlSegment(
            kind="speech", text=" ".join(buffer),
            voice=voice, speed_override=speed, emotion=current_emotion,
        ))


# ─── Quick self-test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = """
    The city was peaceful. [pause:500] Suddenly the lights went out and darkness consumed everything.
    [voice:am_adam]He said, "Don't be afraid — I know the way."[/voice]
    [whisper]She whispered the secret into his ear.[/whisper]
    [speed:1.2]They ran as fast as they could, hearts pounding.[/speed]
    She smiled. It was a beautiful morning.
    """
    segs = parse_ssml(sample, base_voice="af_bella", nlp_auto_emotion=True)
    for i, s in enumerate(segs):
        print(f"[{i}] kind={s.kind} voice={s.voice} emotion={s.emotion} "
              f"whisper={s.whisper} speed={s.speed_override} "
              f"pause_ms={s.pause_ms} text={repr(s.text[:50])}")
