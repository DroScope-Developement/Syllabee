from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from crawler.config import DEFAULT_COURSES_PATH, DEFAULT_TAXONOMY_PATH
from crawler.taxonomy import load_merged_taxonomy

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

# Common URL/course-number patterns (biol1406, cs201, math141, nur-345)
_COURSE_NUM_RE = re.compile(
    r"\b([a-z]{2,6})[\s\-_/]?(\d{3,4}[a-z]?)\b",
    re.IGNORECASE,
)


@dataclass
class CourseLink:
    """A single (course -> confidence/reason) match for one syllabus."""

    slug: str
    name: str
    confidence: float
    reason: str


@dataclass
class CourseScore:
    slug: str
    name: str
    score: float
    reasons: list[str]
    has_code: bool


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
    # Per-course matches (best first), each with its own confidence/reason.
    course_links: list[CourseLink]


# Minimum score for the best course to be assigned at all.
_PRIMARY_MIN_SCORE = 1.8
# Extra (non-best) courses must clear a higher bar so a single syllabus does
# not get linked to many loosely related courses.
_EXTRA_MIN_SCORE = 3.0


def _token_pattern(token: str) -> re.Pattern[str] | None:
    """Build a word-boundary pattern for a keyword/code.

    Spaces in the token match any run of space/hyphen/underscore, and the
    match must not be part of a larger alphanumeric run. This prevents
    substring false positives such as "calculus ii" matching "calculus iii".
    """
    tok = str(token).lower().strip()
    if not tok:
        return None
    esc = re.escape(tok)
    # collapse escaped separators so "calc 2" == "calc-2" == "calc_2"
    esc = re.sub(r"(\\ |\\-|_)+", r"[\\s\\-_]+", esc)
    return re.compile(rf"(?<![a-z0-9]){esc}(?![a-z0-9])")


def _token_matches(token: str | int | float, lower: str) -> bool:
    pattern = _token_pattern(str(token))
    if pattern is None:
        return False
    return pattern.search(lower) is not None


def score_courses(blob: str, taxonomy: list[dict]) -> list[CourseScore]:
    """Score every taxonomy course against a text blob (boundary-aware)."""
    lower = blob.lower()
    scores: list[CourseScore] = []
    for entry in taxonomy:
        score = 0.0
        reasons: list[str] = []
        has_code = False

        for code in entry.get("codes", []) or []:
            if _token_matches(code, lower):
                score += 3.5
                reasons.append(f"code:{code}")
                has_code = True

        for kw in entry.get("keywords", []) or []:
            if _token_matches(kw, lower):
                multiword = (" " in str(kw)) or ("-" in str(kw))
                score += 2.5 if multiword else 1.8
                reasons.append(f"kw:{kw}")

        slug = entry["slug"]
        if _token_matches(slug.replace("-", " "), lower):
            score += 2.5
            reasons.append("slug")

        scores.append(
            CourseScore(
                slug=slug,
                name=entry["name"],
                score=score,
                reasons=reasons,
                has_code=has_code,
            )
        )
    return scores


def classify_links(blob: str, taxonomy: list[dict]) -> list[CourseLink]:
    """Return per-course links for a syllabus, best match first.

    Only the best course (>= primary threshold) plus extras with a strong
    signal (code match or high score) are kept, each with its own
    confidence and reason.
    """
    ranked = sorted(score_courses(blob, taxonomy), key=lambda s: s.score, reverse=True)
    if not ranked or ranked[0].score < _PRIMARY_MIN_SCORE:
        return []

    links: list[CourseLink] = []
    for i, cs in enumerate(ranked):
        if cs.score <= 0:
            continue
        is_best = i == 0
        keep = is_best or cs.has_code or cs.score >= _EXTRA_MIN_SCORE
        if not keep:
            continue
        links.append(
            CourseLink(
                slug=cs.slug,
                name=cs.name,
                confidence=round(min(1.0, cs.score / 5.0), 4),
                reason=",".join(cs.reasons) if cs.reasons else "weak",
            )
        )
    return links


def classify_syllabus(
    *,
    url: str,
    filename: str,
    pdf_title: str | None = None,
    pdf_text_sample: str | None = None,
    link_text: str | None = None,
    taxonomy_path: Path = DEFAULT_TAXONOMY_PATH,
    courses_path: Path = DEFAULT_COURSES_PATH,
) -> ClassificationResult:
    taxonomy = load_merged_taxonomy(
        taxonomy_path=taxonomy_path, courses_path=courses_path
    )
    blob = " ".join(p for p in (url, filename, pdf_title, pdf_text_sample, link_text) if p)

    links = classify_links(blob, taxonomy)

    best = links[0] if links else None
    extra = [link.slug for link in links[1:]]

    term = extract_term_label(blob)
    title = pdf_title or _guess_title_from_filename(filename)
    institution = infer_institution(blob, url)

    return ClassificationResult(
        course_slug=best.slug if best else None,
        course_name=best.name if best else None,
        confidence=best.confidence if best else 0.0,
        match_reason=best.reason if best else "none",
        extra_course_slugs=extra,
        term_label=term,
        title=title,
        institution=institution,
        course_links=links,
    )


_JUNK_RE = re.compile(
    r"""
    \.dvi\b | \.tex\b           # latex artifacts
    | \brec[_\-\ ]?\d           # lecture/recitation clip ids
    | _\d{2,4}k\b               # bitrate-style ids (300k)
    | square[_\-\ ]brackets
    | \btemplate\b | \btips\b
    | preparing.*syllabus | creating.*syllabus
    | \bguideline | \bunknown\b
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _is_junk_syllabus(title: str | None, filename: str | None) -> bool:
    """Heuristic: does this look like a non-syllabus artifact, not a course?"""
    hay = f"{title or ''} {filename or ''}"
    if _JUNK_RE.search(hay):
        return True
    letters = re.sub(r"[^a-z]", "", (title or "").lower())
    return len(letters) < 3


def resolve_syllabus_links(
    *,
    folder: str | None,
    title: str | None,
    filename: str | None,
    url: str | None,
    taxonomy: list[dict],
) -> list[CourseLink]:
    """Decide which courses a syllabus belongs to, combining two signals.

    1. Content (title + filename + url) classified with boundary matching wins
       when it produces a confident match - this keeps wrongly-filed PDFs out
       of the wrong course.
    2. The folder the PDF was filed under is a fallback used only when the
       content is silent, and only if the document is not obvious junk.
    """
    content_blob = " ".join(p for p in (title, filename, url) if p)
    content_links = classify_links(content_blob, taxonomy)

    folder_links = classify_links(folder, taxonomy) if folder else []
    folder_best = folder_links[0] if folder_links else None

    result = list(content_links)
    have = {link.slug for link in result}

    if folder_best and folder_best.slug not in have:
        # Trust the folder only when content gave no signal at all and the
        # document does not look like junk.
        if not content_links and not _is_junk_syllabus(title, filename):
            result.append(
                CourseLink(
                    slug=folder_best.slug,
                    name=folder_best.name,
                    confidence=folder_best.confidence,
                    reason=f"folder:{folder}",
                )
            )

    return result


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
