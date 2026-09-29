"""Security guardrails and prompt-injection defenses."""

import re
from typing import Tuple

class Guardrails:
    INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
        re.compile(r"system\s+override", re.IGNORECASE),
        re.compile(r"you\s+are\s+now\s+(in\s+)?(developer\s+mode|unrestricted|dan)", re.IGNORECASE),
        re.compile(r"reveal\s+(system\s+prompt|api\s+key|credentials)", re.IGNORECASE),
    ]

    @classmethod
    def sanitize_input(cls, input_text: str, max_chars: int = 1000) -> Tuple[str, bool]:
        if not input_text:
            return "", False
        trimmed = input_text.strip()[:max_chars]
        is_suspect = any(p.search(trimmed) for p in cls.INJECTION_PATTERNS)
        return trimmed, is_suspect

    @classmethod
    def wrap_untrusted_data(cls, label: str, data: str) -> str:
        safe_data = data.replace("<<<", "").replace(">>>", "")
        return f"<<<DATA_{label.upper()}>>>\n{safe_data}\n<<<END_DATA_{label.upper()}>>>"
