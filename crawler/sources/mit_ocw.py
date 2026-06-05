from __future__ import annotations

import json
import re
import sqlite3
import time
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from crawler.config import DEFAULT_DATA_DIR
from crawler.log import vprint
from crawler.models import PdfCandidate
from crawler.sources.base import SyllabusSource
from crawler.taxonomy import load_merged_taxonomy

MIT_LEARN_API = "https://api.learn.mit.edu/api/v1/courses/"
OCW_PLATFORM = "ocw"
_CACHE_PATH = DEFAULT_DATA_DIR / "mit_ocw_courses.json"
_CACHE_MAX_AGE_SEC = 7 * 24 * 3600
_MAX_MATCHES_PER_COURSE = 5
_MIN_MATCH_SCORE = 3


def _normalize_text(text: str | int | float) -> str:
    return re.sub(r"\s+", " ", str(text).lower()).strip()


def _course_search_terms(course: sqlite3.Row) -> set[str]:
    name = _normalize_text(course["name"])
    terms = {name}
    if course["course_code"]:
        terms.add(_normalize_text(course["course_code"]))
    slug = course["slug"]
    for entry in load_merged_taxonomy():
        if entry.get("slug") == slug:
            for kw in entry.get("keywords", []):
                terms.add(_normalize_text(kw))
            for code in entry.get("codes", []):
                terms.add(_normalize_text(code))
            break
    return {t for t in terms if len(t) >= 3}


def _score_ocw_course(title: str, description: str, terms: set[str]) -> int:
    blob = _normalize_text(f"{title} {description}")
    score = 0
    for term in terms:
        if term in blob:
            score += 2 + min(len(term.split()), 3)
        else:
            for word in term.split():
                if len(word) >= 4 and word in blob:
                    score += 1
    return score


def _fetch_ocw_catalog(client: httpx.Client, *, verbose: bool) -> list[dict]:
    if _CACHE_PATH.is_file():
        age = time.time() - _CACHE_PATH.stat().st_mtime
        if age < _CACHE_MAX_AGE_SEC:
            try:
                cached = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
                if isinstance(cached, list) and cached:
                    vprint(
                        f"       MIT OCW: using cached catalog ({len(cached)} courses)",
                        verbose=verbose,
                    )
                    return cached
            except (json.JSONDecodeError, OSError):
                pass

    courses: list[dict] = []
    offset = 0
    limit = 100
    vprint("       MIT OCW: fetching course catalog from MIT Learn API...", verbose=verbose)

    while True:
        resp = client.get(
            MIT_LEARN_API,
            params={"platform": OCW_PLATFORM, "limit": limit, "offset": offset},
        )
        resp.raise_for_status()
        payload = resp.json()
        batch = payload.get("results") or []
        if not batch:
            break
        for row in batch:
            run = (row.get("runs") or [{}])[0]
            courses.append(
                {
                    "title": row.get("title") or run.get("title") or "",
                    "description": row.get("description") or run.get("description") or "",
                    "url": row.get("url") or run.get("url") or "",
                    "semester": run.get("semester"),
                    "year": run.get("year"),
                    "features": row.get("course_feature") or [],
                }
            )
        offset += limit
        if not payload.get("next"):
            break
        time.sleep(0.3)

    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(courses, indent=0), encoding="utf-8")
    vprint(f"       MIT OCW: cached {len(courses)} courses", verbose=verbose)
    return courses


def _syllabus_page_url(course_url: str) -> str:
    base = course_url.rstrip("/") + "/"
    return urljoin(base, "pages/syllabus/")


def _extract_syllabus_candidates(
    html: str,
    page_url: str,
    *,
    course_title: str,
) -> set[PdfCandidate]:
    found: set[PdfCandidate] = set()
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        absolute = urljoin(page_url, href)
        lower = absolute.lower()
        link_text = tag.get_text(strip=True) or None

        if lower.endswith(".pdf") or ".pdf?" in lower:
            if "syllabus" in lower or (link_text and "syllabus" in link_text.lower()):
                found.add(
                    PdfCandidate(
                        url=absolute,
                        discovery_source="mit_ocw:pdf",
                        referrer_url=page_url,
                        link_text=link_text or course_title,
                    )
                )
        elif "/pages/syllabus" in lower or lower.rstrip("/").endswith("/syllabus"):
            if absolute != page_url:
                continue
            found.add(
                PdfCandidate(
                    url=page_url,
                    discovery_source="mit_ocw:html",
                    referrer_url=page_url,
                    link_text=course_title,
                    content_type="html",
                )
            )

    if not found and "syllabus" in html.lower()[:12000]:
        found.add(
            PdfCandidate(
                url=page_url,
                discovery_source="mit_ocw:html",
                referrer_url=page_url,
                link_text=course_title,
                content_type="html",
            )
        )
    return found


class MitOcwSource(SyllabusSource):
    name = "mit-ocw"
    label = "MIT OpenCourseWare (MIT Learn API)"

    def __init__(self, *, max_matches: int = _MAX_MATCHES_PER_COURSE) -> None:
        self.max_matches = max_matches
        self._catalog: list[dict] | None = None

    def _catalog_for(self, client: httpx.Client, *, verbose: bool) -> list[dict]:
        if self._catalog is None:
            self._catalog = _fetch_ocw_catalog(client, verbose=verbose)
        return self._catalog

    def discover_for_course(
        self,
        course: sqlite3.Row,
        client: httpx.Client,
        *,
        verbose: bool = True,
    ) -> set[PdfCandidate]:
        terms = _course_search_terms(course)
        catalog = self._catalog_for(client, verbose=verbose)
        scored: list[tuple[int, dict]] = []
        for row in catalog:
            if not row.get("url"):
                continue
            score = _score_ocw_course(row["title"], row["description"], terms)
            if score >= _MIN_MATCH_SCORE:
                scored.append((score, row))
        scored.sort(key=lambda x: x[0], reverse=True)

        candidates: set[PdfCandidate] = set()
        course_id = int(course["id"])
        for _, row in scored[: self.max_matches]:
            page_url = _syllabus_page_url(row["url"])
            try:
                resp = client.get(page_url, follow_redirects=True)
                if resp.status_code == 404:
                    continue
                resp.raise_for_status()
            except Exception as exc:
                vprint(f"       MIT OCW skip {page_url}: {exc}", verbose=verbose)
                continue

            content_type = resp.headers.get("content-type", "").lower()
            if "html" not in content_type and "<html" not in resp.text[:400].lower():
                continue

            for candidate in _extract_syllabus_candidates(
                resp.text, str(resp.url), course_title=row["title"]
            ):
                candidates.add(
                    PdfCandidate(
                        url=candidate.url,
                        discovery_source=candidate.discovery_source,
                        referrer_url=candidate.referrer_url,
                        link_text=candidate.link_text,
                        target_course_id=course_id,
                        content_type=candidate.content_type,
                    )
                )
            time.sleep(0.5)

        if candidates:
            vprint(
                f"       MIT OCW: {len(candidates)} candidate(s) for {course['name']}",
                verbose=verbose,
            )
        return candidates
