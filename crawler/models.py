from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PdfCandidate:
    url: str
    discovery_source: str = "search"
    referrer_url: str | None = None
    link_text: str | None = None
    target_course_id: int | None = None
    queue_id: int | None = None
    content_type: str = "pdf"  # "pdf" or "html" (HTML syllabus pages from OCW, CS50, etc.)


def infer_content_type(url: str, discovery_source: str | None = None) -> str:
    src = (discovery_source or "").lower()
    if ":html" in src:
        return "html"
    lower = url.lower()
    if lower.endswith(".pdf") or ".pdf?" in lower:
        return "pdf"
    if "/pages/syllabus" in lower or lower.rstrip("/").endswith("/syllabus"):
        return "html"
    return "pdf"
