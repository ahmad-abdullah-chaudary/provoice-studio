import re
from typing import Dict

# Dictionary of high-frequency Roman Urdu words -> Arabic/Nastaliq script
ROMAN_URDU_DICTIONARY: Dict[str, str] = {
    # Greetings & Courtesy
    "salam": "سلام",
    "assalam": "اسلام",
    "alaikum": "علیکم",
    "adaab": "آداب",
    "shukriya": "شکریہ",
    "khuda": "خدا",
    "hafiz": "حافظ",
    "khushamdeed": "خوش آمدید",
    "dhanak": "دھنک",

    # Pronouns & Possessives
    "main": "میں", "mai": "میں", "hum": "ہم", "tum": "تم", "aap": "آپ",
    "mujhe": "مجھے", "mujhy": "مجھے", "tujhe": "تجھے", "tujhy": "تجھے",
    "tumhein": "تمہیں", "tumhein": "تمہیں", "tumse": "تم سے", "mujhse": "مجھ سے",
    "aapka": "آپ کا", "aapki": "آپ کی", "aapke": "آپ کے",
    "mera": "میرا", "meri": "میری", "mere": "میرے",
    "tera": "تیرا", "teri": "تیری", "tere": "تیرے",
    "hamara": "ہمارا", "hamari": "ہماری", "hamare": "ہمارے",
    "yeh": "یہ", "ye": "یہ", "woh": "وہ", "wo": "وہ",
    "is": "اس", "us": "اس", "in": "ان", "un": "ان",
    "kya": "کیا", "kaun": "کون", "kahan": "کہاں", "kab": "کب",
    "kyun": "کیوں", "kyu": "کیوں", "kaise": "کیسے", "kaisa": "کیسا", "kaisi": "کیسی",
    "kitna": "کتنا", "kitni": "کتنی", "kitne": "کتنے",

    # Prepositions & Connectors
    "se": "سے", "me": "میں", "mein": "میں", "par": "پر", "pe": "پر",
    "tak": "تک", "bina": "بنا", "bair": "بغیر", "baghair": "بغیر",
    "sath": "ساتھ", "saath": "ساتھ", "aage": "آگے", "peeche": "پیچھے",
    "andar": "اندر", "bahar": "باہر", "ne": "نے", "ko": "کو", "ka": "کا", "ki": "کی", "ke": "کے",

    # Verbs & Auxiliary
    "hai": "ہے", "hain": "ہیں", "ho": "ہو", "hoon": "ہوں", "hun": "ہوں",
    "tha": "تھا", "thi": "تھی", "the": "تھے", "hoga": "ہوگا", "hogi": "ہوگی", "honge": "ہوں گے",
    "kar": "کر", "karo": "کرو", "karna": "کرنا", "karne": "کرنے",
    "raha": "رہا", "rahi": "رہی", "rahe": "رہے", "chahiye": "چاہیے",
    "batao": "بتاؤ", "samajh": "سمجھ", "dekho": "دیکھو", "dekh": "دیکھ",
    "suno": "سنو", "sun": "سن", "bolo": "بولو", "bol": "بول",
    "aao": "آؤ", "jaao": "جاؤ", "jao": "جاؤ", "chal": "چل", "chalo": "چلو",
    "soch": "سوچ", "socho": "سوچو", "jeena": "جینا", "jiya": "جیا", "mar": "مر",
    "mushkil": "مشکل", "aasan": "آسان", "sako": "سکو", "sake": "سکے",

    # Poetry, Nouns & Adjectives
    "dil": "دل", "ishq": "عشق", "pyar": "پیار", "mohabbat": "محبت", "muhabat": "محبت",
    "shair": "شعر", "shayari": "شاعری", "ghazal": "غزل", "zindagi": "زندگی",
    "dunya": "دنیا", "duniya": "دنیا", "khwab": "خواب", "khwaab": "خواب",
    "raat": "رات", "din": "دن", "aankhen": "آنکھیں", "aankhein": "آنکھیں",
    "dost": "دوست", "yaar": "یار", "khushi": "خوشی", "gham": "غم",
    "dard": "درد", "aansu": "آنسو", "tanha": "تنہا", "tanhaai": "تنہائی",
    "roshni": "روشنی", "andhera": "اندھیرا", "maut": "موت", "zinda": "زندہ",
    "khuda": "خدا", "jahan": "جہاں", "watan": "وطن", "pakistan": "پاکستان",
    "urdu": "اردو", "lafz": "لفظ", "baat": "بات", "waqt": "وقت", "mehboob": "محبوب",
}

# Phonetic Roman -> Urdu mapping for fallback
URDU_CONSONANTS = [
    ("kh", "خ"), ("gh", "غ"), ("ch", "چ"), ("jh", "جھ"),
    ("th", "تھ"), ("dh", "دھ"), ("ph", "پھ"), ("bh", "بھ"),
    ("sh", "ش"), ("zh", "ژ"), ("tr", "تر"),
    ("k", "ک"), ("g", "گ"), ("j", "ج"), ("t", "ت"), ("d", "د"),
    ("n", "ن"), ("p", "پ"), ("b", "ب"), ("m", "م"), ("y", "ی"),
    ("r", "ر"), ("l", "ل"), ("v", "و"), ("w", "و"), ("s", "س"),
    ("h", "ہ"), ("z", "ز"), ("f", "ف"), ("q", "ق"), ("a", "ا")
]

URDU_NUMERALS_MAP = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
}


def normalize_urdu_text(text: str) -> str:
    """Normalizes Urdu text: converts Urdu/Arabic numerals to standard digits, cleans harakat & ZWNJ."""
    if not text:
        return text

    # Convert Urdu/Persian/Arabic digits to 0-9
    res = []
    for ch in text:
        res.append(URDU_NUMERALS_MAP.get(ch, ch))
    normalized = "".join(res)

    # Remove soft/excessive diacritics that trip up TTS engines
    normalized = re.sub(r'[\u064B-\u065F\u0670]', '', normalized)

    # Fix ZWNJ and multiple spaces
    normalized = re.sub(r'\u200c+', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized).strip()

    return normalized


def _rule_based_transliterate_word(word: str) -> str:
    """Fallback phonetic rule-based transliterator for Roman Urdu words."""
    clean = word.lower().strip()
    if not clean:
        return word

    if clean in ROMAN_URDU_DICTIONARY:
        return ROMAN_URDU_DICTIONARY[clean]

    res = []
    i = 0
    length = len(clean)

    while i < length:
        matched = False
        for roman, urdu in URDU_CONSONANTS:
            if clean.startswith(roman, i):
                res.append(urdu)
                i += len(roman)
                matched = True
                break

        if not matched:
            # Drop unmapped raw Latin vowels gracefully instead of leaving English letters
            if clean[i] not in "aeiouy":
                res.append(clean[i])
            i += 1

    return "".join(res)


def transliterate_roman_urdu_to_script(text: str) -> str:
    """Converts Roman Urdu text into standard Urdu script."""
    if not text or not any('a' <= c <= 'z' or 'A' <= c <= 'Z' for c in text):
        return normalize_urdu_text(text)

    tokens = re.split(r'(\s+|[.,!?;:\-()""])', text)
    result = []

    for token in tokens:
        if not token or token.isspace() or re.match(r'^[.,!?;:\-()""]+$', token):
            result.append(token)
        elif token.isdigit():
            result.append(token)
        else:
            token_lower = token.lower()
            if token_lower in ROMAN_URDU_DICTIONARY:
                result.append(ROMAN_URDU_DICTIONARY[token_lower])
            else:
                result.append(_rule_based_transliterate_word(token))

    output = "".join(result)
    return normalize_urdu_text(output)
