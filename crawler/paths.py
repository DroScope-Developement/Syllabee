from __future__ import annotations

import re
from pathlib import Path

_UNCLASSIFIED = "_unclassified"


def safe_dir_name(name: str, max_len: int = 80) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "", name).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        return _UNCLASSIFIED
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip()
    return cleaned


def course_storage_dir(output_root: Path, course_name: str) -> Path:
    return output_root / safe_dir_name(course_name)


def unclassified_dir(output_root: Path) -> Path:
    return output_root / _UNCLASSIFIED
