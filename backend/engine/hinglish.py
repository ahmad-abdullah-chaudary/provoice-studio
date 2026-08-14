import re
from typing import Dict

# Dictionary of high-frequency Hinglish (Roman Hindi) words -> Devanagari
HINGLISH_DICTIONARY: Dict[str, str] = {
    # Greetings & Courtesy
    "namaste": "नमस्ते",
    "namaskar": "नमस्कार",
    "hello": "हेलो",
    "shukriya": "शुक्रिया",
    "dhanyawad": "धन्यवाद",
    "dhanyavad": "धन्यवाद",
    "alvida": "अलविदा",
    "swagat": "स्वागत",
    "abhinandan": "अभिनंदन",

    # Pronouns
    "main": "मैं",
    "mai": "मैं",
    "hum": "हम",
    "tum": "तुम",
    "aap": "आप",
    "aapka": "आपका",
    "aapki": "आपकी",
    "aapke": "आपके",
    "mera": "मेरा",
    "meri": "मेरी",
    "mere": "मेरे",
    "hamara": "हमारा",
    "hamari": "हमारी",
    "hamare": "हमारे",
    "tumhara": "तुम्हारा",
    "tumhari": "तुम्हारी",
    "tumhare": "तुम्हारे",
    "yeh": "यह",
    "ye": "ये",
    "woh": "वह",
    "wo": "वो",
    "is": "इस",
    "us": "उस",
    "in": "इन",
    "un": "उन",
    "iska": "इसका",
    "uski": "उसकी",
    "unka": "उनका",
    "kya": "क्या",
    "kaun": "कौन",
    "kahan": "कहाँ",
    "kab": "कब",
    "kyun": "क्यों",
    "kyu": "क्यों",
    "kaise": "कैसे",
    "kaisa": "कैसा",
    "kaisi": "कैसी",
    "kitna": "कितना",
    "kitne": "कितने",
    "kitni": "कितनी",

    # Verbs & Auxiliary
    "hai": "है",
    "hain": "हैं",
    "ho": "हो",
    "hoon": "हूँ",
    "hun": "हूँ",
    "tha": "था",
    "thi": "थी",
    "the": "थे",
    "hoga": "होगा",
    "hogi": "होगी",
    "honge": "होंगे",
    "karo": "करो",
    "karna": "करना",
    "karne": "करने",
    "kar": "कर",
    "raha": "रहा",
    "rahi": "रही",
    "rahe": "रहे",
    "chahiye": "चाहिए",
    "batao": "बताओ",
    "bataya": "बताया",
    "samajh": "समझ",
    "samajha": "समझा",
    "dekho": "देखो",
    "dekh": "देख",
    "suno": "सुनो",
    "sun": "सुन",
    "bolo": "बोलो",
    "bol": "बोल",
    "aao": "आओ",
    "aaoo": "आओ",
    "jaao": "जाओ",
    "jao": "जाओ",
    "milte": "मिलते",
    "mil": "मिल",
    "bana": "बना",
    "banaya": "बनाया",
    "banao": "बनाओ",
    "chal": "चल",
    "chalo": "चलो",
    "soch": "सोच",
    "socho": "सोचो",

    # Common Nouns & Adjectives
    "bhai": "भाई",
    "dost": "दोस्त",
    "yaar": "यार",
    "dil": "दिल",
    "baat": "बात",
    "kaam": "काम",
    "naam": "नाम",
    "duniya": "दुनिया",
    "zindagi": "जिंदगी",
    "waqt": "वक़्त",
    "samay": "समय",
    "aaj": "आज",
    "kal": "कल",
    "parso": "परसों",
    "ab": "अब",
    "tab": "तब",
    "jab": "जब",
    "sab": "सब",
    "sabhi": "सभी",
    "kuch": "कुछ",
    "bohot": "बहुत",
    "bahut": "बहुत",
    "achha": "अच्छा",
    "achi": "अच्छी",
    "ache": "अच्छे",
    "bura": "बुरा",
    "badi": "बड़ी",
    "bada": "बड़ा",
    "chota": "छोटा",
    "choti": "छोटी",
    "sach": "सच",
    "jhooth": "झूठ",
    "pyar": "प्यार",
    "prem": "प्रेम",
    "khushi": "खुशी",
    "gham": "ग़म",
    "ghar": "घर",
    "desh": "देश",
    "shahar": "शहर",
    "log": "लोग",
    # Numbers & Units
    "ek": "एक", "do": "दो", "teen": "तीन", "chaar": "चार", "paanch": "पाँच",
    "chhe": "छह", "saat": "सात", "aath": "आठ", "nau": "नौ", "das": "दस",
    "sau": "सौ", "hazar": "हज़ार", "lakh": "लाख", "crore": "करोड़", "rupees": "रुपये", "rs": "रुपये",

    # Common Tech & Modern Code-Switching Words (Passed cleanly into Devanagari)
    "video": "वीडियो", "audio": "ऑडियो", "channel": "चैनल", "link": "लिंक",
    "download": "डाउनलोड", "subscribe": "सब्सक्राइब", "app": "ऐप", "phone": "फोन",
    "system": "सिस्टम", "computer": "कंप्यूटर", "software": "सॉफ्टवेयर",
    "provoice": "प्रोवॉयस", "studio": "स्टूडियो", "voice": "वॉयस", "ai": "एआई",
    "movie": "मूवी", "film": "फिल्म", "music": "म्यूजिक", "song": "गाना",

    # Expanded High-Frequency Everyday Words
    "achanak": "अचानक", "andhera": "अंधेरा", "khatra": "खतरा", "darr": "डर",
    "maut": "मौत", "khushi": "खुशी", "dard": "दर्द", "tanha": "तनहा", "rona": "रोना",
    "jeet": "जीत", "kamyabi": "कामयाबी", "shandar": "शानदार", "dil": "दिल", "tuta": "टूटा",
    "bhai": "भाई", "dost": "दोस्त", "yaar": "यार", "baat": "बात", "kaam": "काम",
    "naam": "नाम", "duniya": "दुनिया", "zindagi": "जिंदगी", "waqt": "वक़्त", "samay": "समय",
    "aaj": "आज", "kal": "कल", "parso": "परसों", "ab": "अब", "tab": "तब", "jab": "जब",
    "sab": "सब", "sabhi": "सभी", "kuch": "कुछ", "bohot": "बहुत", "bahut": "बहुत",
    "achha": "अच्छा", "achi": "अच्छी", "ache": "अच्छे", "bura": "बुरा",
    "badi": "बड़ी", "bada": "बड़ा", "chota": "छोटा", "choti": "छोटी",
    "sach": "सच", "jhooth": "झूठ", "pyar": "प्यार", "prem": "प्रेम",
    "ghar": "घर", "desh": "देश", "shahar": "शहर", "log": "लोग", "har": "हर",
}

NUMBER_WORDS = {
    '1': 'एक', '2': 'दो', '3': 'तीन', '4': 'चार', '5': 'पाँच',
    '6': 'छह', '7': 'सात', '8': 'आठ', '9': 'नौ', '10': 'दस',
    '100': 'सौ', '1000': 'एक हज़ार'
}


def normalize_hindi_numbers(text: str) -> str:
    """Converts number and money patterns like '5 crore', '10 lakh', '100 rupees' to Devanagari words."""
    if not text:
        return text

    # Pattern: Digit + space + crore/lakh/rupees
    text = re.sub(r'(\d+)\s*(?:crore|cr)\b', lambda m: f"{NUMBER_WORDS.get(m.group(1), m.group(1))} करोड़", text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+)\s*(?:lakh|lac)\b', lambda m: f"{NUMBER_WORDS.get(m.group(1), m.group(1))} लाख", text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+)\s*(?:rupees|rs|rs\.)\b', lambda m: f"{NUMBER_WORDS.get(m.group(1), m.group(1))} रुपये", text, flags=re.IGNORECASE)

    return text

# Phonetic consonant clusters & consonants mapping
CONSONANTS = [
    ("chhh", "छ्"), ("chh", "छ्"), ("chh", "छ्"),
    ("kh", "ख्"), ("gh", "घ्"), ("ch", "च्"), ("jh", "झ्"),
    ("th", "थ्"), ("dh", "ध्"), ("ph", "फ्"), ("bh", "भ्"),
    ("sh", "श्"), ("sh", "ष्"), ("gy", "ज्ञ्"), ("tr", "त्र्"),
    ("k", "क्"), ("g", "ग्"), ("j", "ज्"), ("t", "त्"), ("d", "द्"),
    ("n", "न्"), ("p", "प्"), ("b", "ब्"), ("m", "म्"), ("y", "य्"),
    ("r", "र्"), ("l", "ल्"), ("v", "व्"), ("w", "व्"), ("s", "स्"),
    ("h", "ह्"), ("z", "ज़्"), ("f", "फ़्"), ("x", "क्स")
]

VOWEL_MATRAS = [
    ("aai", "ाई"), ("aau", "ाऊ"), ("ai", "ै"), ("au", "ौ"),
    ("aa", "ा"), ("ee", "ी"), ("oo", "ू"), ("ea", "िया"),
    ("a", "अ"), ("i", "ि"), ("u", "ु"), ("e", "े"), ("o", "ो")
]

INDEPENDENT_VOWELS = {
    "a": "अ", "aa": "आ", "i": "इ", "ee": "ई", "u": "उ",
    "oo": "ऊ", "e": "ए", "ai": "ऐ", "o": "ओ", "au": "औ"
}


def _rule_based_transliterate_word(word: str) -> str:
    """Phonetic rule-based fallback transliteration for unlisted Roman Hindi words."""
    clean = word.lower().strip()
    if not clean:
        return word

    if clean in HINGLISH_DICTIONARY:
        return HINGLISH_DICTIONARY[clean]

    # Convert simple Latin phonetic patterns to Devanagari
    res = []
    i = 0
    length = len(clean)

    while i < length:
        matched = False

        # Match consonant clusters
        for roman_c, dev_c in CONSONANTS:
            if clean.startswith(roman_c, i):
                i += len(roman_c)
                # Check for vowel following consonant
                vowel_matched = False
                for roman_v, dev_v in [
                    ("aai", "ाई"), ("aau", "ाऊ"), ("ai", "ै"), ("au", "ौ"),
                    ("aa", "ा"), ("ee", "ी"), ("oo", "ू"), ("a", ""),
                    ("i", "ि"), ("u", "ु"), ("e", "े"), ("o", "ो")
                ]:
                    if clean.startswith(roman_v, i):
                        res.append(dev_c[:-1] + dev_v)  # Strip halant and add matra
                        i += len(roman_v)
                        vowel_matched = True
                        break
                
                if not vowel_matched:
                    # If consonant is at end of word or followed by consonant, keep implicit 'a' or halant
                    if i == length:
                        res.append(dev_c[:-1])  # End of word has implicit vowel sound in Hindi
                    else:
                        res.append(dev_c)  # Halant
                matched = True
                break

        if matched:
            continue

        # Match independent vowels if at start or standalone
        for roman_v, dev_v in [
            ("aa", "आ"), ("ai", "ऐ"), ("au", "औ"), ("ee", "ई"), ("oo", "ऊ"),
            ("a", "अ"), ("i", "इ"), ("u", "उ"), ("e", "ए"), ("o", "ओ")
        ]:
            if clean.startswith(roman_v, i):
                res.append(dev_v)
                i += len(roman_v)
                matched = True
                break

        if not matched:
            res.append(clean[i])
            i += 1

    return "".join(res)


def transliterate_hinglish_to_devanagari(text: str) -> str:
    """Detects and converts Roman Hindi (Hinglish) text into Devanagari script."""
    if not text:
        return text

    # Preprocess number patterns (e.g. 5 crore -> पाँच करोड़)
    text = normalize_hindi_numbers(text)

    if not any('a' <= c <= 'z' or 'A' <= c <= 'Z' for c in text):
        return text  # Already Devanagari or non-Latin text

    # Tokenize punctuation and words
    tokens = re.split(r'(\s+|[.,!?;:\-()""])', text)
    result = []

    for token in tokens:
        if not token or token.isspace() or re.match(r'^[.,!?;:\-()""]+$', token):
            result.append(token)
        elif token.isdigit():
            result.append(token)
        else:
            token_lower = token.lower()
            if token_lower in HINGLISH_DICTIONARY:
                dev = HINGLISH_DICTIONARY[token_lower]
                # Preserve capitalized casing style if needed
                result.append(dev)
            else:
                # Use rule-based phonetic engine
                result.append(_rule_based_transliterate_word(token))

    return "".join(result)
