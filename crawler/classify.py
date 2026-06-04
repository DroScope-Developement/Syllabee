from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

_TERM_RE = re.compile(
    r"\b(fall|spring|summer|winter)\s*['']?\s*(\d{2,4})\b",
    re.IGNORECASE,
)
_YEAR_RE = re.compile(r"\b(20\d{2})\b")
_INSTITUTION_HINTS = (
    (r"\bmit\b", "MIT"),
    (r"\bstanford\b", "Stanford University"),
    (r"\bberkeley\b", "UC Berkeley"),
    (r"\bcmu\b", "Carnegie Mellon University"),
    (r"\bharvard\b", "Harvard University"),
)


@dataclass
class ClassificationResult:
    course_slug: str | None
    course_name: str | None
    confidence: float
    match_reason: str
    extra_course_slugs: list[str]
    term_label: str | None
    title: str | None
    institution: str | None


def _load_taxonomy(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return list(data.get("courses", []))


def _text_blob(*parts: str | None) -> str:
    return " ".join(p for p in parts if p).lower()


def classify_syllabus(
    *,
    url: str,
    filename: str,
    pdf_title: str | None = None,
    pdf_text_sample: str | None = None,
    link_text: str | None = None,
    taxonomy_path: Path,
) -> ClassificationResult:
    taxonomy = _load_taxonomy(taxonomy_path)
    blob = _text_blob(url, filename, pdf_title, pdf_text_sample, link_text)

    best_slug: str | None = None
    best_name: str | None = None
    best_score = 0.0
    best_reason = "none"
    matched_slugs: list[str] = []

    for entry in taxonomy:
        slug = entry["slug"]
        name = entry["name"]
        score = 0.0
        reasons: list[str] = []

        for code in entry.get("codes", []) or []:
            if code.lower() in blob:
                score += 3.0
                reasons.append(f"code:{code}")

        for kw in entry.get("keywords", []) or []:
            kw_l = kw.lower()
            if kw_l in blob:
                weight = 2.0 if " " in kw_l else 1.2
                score += weight
                reasons.append(f"kw:{kw}")

        if slug.replace("-", " ") in blob or name.lower() in blob:
            score += 2.5
            reasons.append("name")

        if score > best_score:
            best_score = score
            best_slug = slug
            best_name = name
            best_reason = ",".join(reasons) if reasons else "weak"
        if score >= 2.0:
            matched_slugs.append(slug)

    confidence = min(1.0, best_score / 6.0) if best_slug else 0.0
    if confidence < 0.35:
        best_slug = None
        best_name = None

    term = extract_term_label(blob)
    title = pdf_title or _guess_title_from_filename(filename)
    institution = infer_institution(blob, url)

    extra = [s for s in dict.fromkeys(matched_slugs) if s != best_slug]

    return ClassificationResult(
        course_slug=best_slug,
        course_name=best_name,
        confidence=confidence,
        match_reason=best_reason,
        extra_course_slugs=extra,
        term_label=term,
        title=title,
        institution=institution,
    )


def extract_term_label(text: str) -> str | None:
    m = _TERM_RE.search(text)
    if m:
        season = m.group(1).title()
        year = m.group(2)
        if len(year) == 2:
            year = "20" + year
        return f"{season} {year}"
    years = _YEAR_RE.findall(text)
    if years:
        return years[0]
    return None


def infer_institution(text: str, url: str) -> str | None:
    combined = f"{text} {url}".lower()
    for pattern, name in _INSTITUTION_HINTS:
        if re.search(pattern, combined):
            return name
    if ".edu" in url:
        from urllib.parse import urlparse

        host = urlparse(url).netloc
        if host.startswith("www."):
            host = host[4:]
        parts = host.split(".")
        if len(parts) >= 2:
            return parts[0].replace("-", " ").title() + " (.edu)"
    return None


def _guess_title_from_filename(filename: str) -> str | None:
    stem = Path(filename).stem.replace("_", " ").replace("-", " ")
    if len(stem) < 4:
        return None
    if "syllabus" in stem.lower():
        return stem.title()
    return None
