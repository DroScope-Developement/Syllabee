from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO

_PDF_DATE_RE = re.compile(r"D:(\d{4})(\d{2})(\d{2})")


@dataclass
class PdfMetadata:
    title: str | None
    author: str | None
    release_date: str | None  # ISO date YYYY-MM-DD
    text_sample: str | None


def extract_pdf_metadata(data: bytes, *, max_text_chars: int = 4000) -> PdfMetadata:
    title = author = release_date = None
    text_sample: str | None = None

    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        info = reader.metadata
        if info:
            title = _clean(info.title)
            author = _clean(info.author)
            if info.creation_date:
                release_date = _pdf_date_to_iso(str(info.creation_date))
            elif info.modification_date:
                release_date = _pdf_date_to_iso(str(info.modification_date))

        if reader.pages:
            chunks: list[str] = []
            total = 0
            for page in reader.pages[:3]:
                try:
                    t = page.extract_text() or ""
                except Exception:
                    t = ""
                if t:
                    chunks.append(t)
                    total += len(t)
                    if total >= max_text_chars:
                        break
            if chunks:
                text_sample = "\n".join(chunks)[:max_text_chars]
                if not title:
                    title = _title_from_text(text_sample)
    except Exception:
        pass

    return PdfMetadata(
        title=title,
        author=author,
        release_date=release_date,
        text_sample=text_sample,
    )


def _clean(value: object | None) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _pdf_date_to_iso(raw: str) -> str | None:
    m = _PDF_DATE_RE.search(raw)
    if not m:
        return None
    try:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date().isoformat()
    except ValueError:
        return None


def _title_from_text(text: str) -> str | None:
    for line in text.splitlines()[:12]:
        line = line.strip()
        if 8 <= len(line) <= 120 and re.search(r"[a-zA-Z]{4}", line):
            return line
    return None
