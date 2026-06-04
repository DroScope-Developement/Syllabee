from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PdfCandidate:
    url: str
    discovery_source: str = "search"
    referrer_url: str | None = None
    link_text: str | None = None
