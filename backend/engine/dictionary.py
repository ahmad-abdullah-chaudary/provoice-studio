import re
from typing import List, Dict, Any

class PronunciationDictionary:
    """Manages phonetic mapping and text replacement rules."""

    def __init__(self):
        # Default global rules
        self.global_rules: List[Dict[str, str]] = [
            {"word": "SQL", "replace": "Sequel", "case_sensitive": False},
            {"word": "API", "replace": "A P I", "case_sensitive": False},
            {"word": "UI/UX", "replace": "U I U X", "case_sensitive": False},
            {"word": "Hermione", "replace": "Her-my-oh-nee", "case_sensitive": True},
            {"word": "ProVoice", "replace": "Pro Voice", "case_sensitive": False},
            {"word": "SaaS", "replace": "Sass", "case_sensitive": False},
            {"word": "TTS", "replace": "T T S", "case_sensitive": False},
        ]
        self.project_rules: List[Dict[str, str]] = []

    def apply_rules(self, text: str, extra_rules: List[Dict[str, str]] = None) -> str:
        """Apply global, project, and custom dictionary rules to input text."""
        if not text:
            return ""

        all_rules = self.global_rules + self.project_rules + (extra_rules or [])
        processed_text = text

        for rule in all_rules:
            target = rule.get("word", "").strip()
            replacement = rule.get("replace", "").strip()
            case_sensitive = rule.get("case_sensitive", False)

            if not target or not replacement:
                continue

            # Word boundary regex replacement
            flags = 0 if case_sensitive else re.IGNORECASE
            pattern = r'\b' + re.escape(target) + r'\b'
            processed_text = re.sub(pattern, replacement, processed_text, flags=flags)

        return processed_text

    def add_rule(self, word: str, replace: str, is_global: bool = True, case_sensitive: bool = False):
        rule = {"word": word.strip(), "replace": replace.strip(), "case_sensitive": case_sensitive}
        if is_global:
            self.global_rules.append(rule)
        else:
            self.project_rules.append(rule)

    def remove_rule(self, word: str, is_global: bool = True):
        target_list = self.global_rules if is_global else self.project_rules
        new_list = [r for r in target_list if r["word"].lower() != word.lower()]
        if is_global:
            self.global_rules = new_list
        else:
            self.project_rules = new_list

dictionary_engine = PronunciationDictionary()
