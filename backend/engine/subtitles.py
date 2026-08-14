import re
from typing import List, Dict, Any

class SubtitleParser:
    """Parses SRT, VTT, ASS subtitle files into structured narration items."""

    @staticmethod
    def parse_time_to_seconds(time_str: str) -> float:
        """Convert HH:MM:SS,mmm or HH:MM:SS.mmm to seconds float."""
        time_str = time_str.replace(',', '.')
        parts = time_str.strip().split(':')
        if len(parts) == 3:
            h, m, s = parts
            return float(h) * 3600 + float(m) * 60 + float(s)
        elif len(parts) == 2:
            m, s = parts
            return float(m) * 60 + float(s)
        return float(parts[0])

    def parse_srt(self, content: str) -> List[Dict[str, Any]]:
        """Parse SubRip (.srt) subtitle string."""
        blocks = re.split(r'\n\s*\n', content.strip())
        subtitles = []

        for block in blocks:
            lines = [line.strip() for line in block.split('\n') if line.strip()]
            if len(lines) < 2:
                continue

            time_line = lines[1] if '-->' in lines[1] else (lines[0] if '-->' in lines[0] else None)
            if not time_line:
                continue

            time_parts = time_line.split('-->')
            start_time = self.parse_time_to_seconds(time_parts[0])
            end_time = self.parse_time_to_seconds(time_parts[1].split()[0])

            # Text content
            text_lines = lines[2:] if '-->' in lines[1] else lines[1:]
            text = ' '.join(text_lines)
            # Remove HTML tags (<i>, <b>, etc.)
            clean_text = re.sub(r'<[^>]+>', '', text).strip()

            if clean_text:
                subtitles.append({
                    "id": len(subtitles) + 1,
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration": round(end_time - start_time, 3),
                    "text": clean_text
                })

        return subtitles

    def parse_vtt(self, content: str) -> List[Dict[str, Any]]:
        """Parse WebVTT (.vtt) subtitle string."""
        # Strip WEBVTT header
        content = re.sub(r'^WEBVTT.*?\n\n', '', content, flags=re.DOTALL)
        return self.parse_srt(content)

    def parse_file(self, content: str, filename: str = "subtitle.srt") -> List[Dict[str, Any]]:
        ext = filename.lower().split('.')[-1]
        if ext == 'vtt':
            return self.parse_vtt(content)
        else:
            return self.parse_srt(content)

subtitle_parser = SubtitleParser()
