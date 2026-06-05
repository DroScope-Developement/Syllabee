from __future__ import annotations

import sqlite3
from urllib.parse import urlparse

import httpx

from crawler.config import UNIVERSITY_SEED_URLS, UNIVERSITY_SITE_QUERIES
from crawler.discover import discover_from_seed_pages, discover_via_duckduckgo, extract_pdf_candidates
from crawler.log import vprint
from crawler.models import PdfCandidate
from crawler.sources.base import SyllabusSource

_TRUSTED_SYLLABUS_HOSTS = frozenset(
    {
        "ocw.mit.edu",
        "cs50.harvard.edu",
        "pll.harvard.edu",
        "online.stanford.edu",
        "open.stanford.edu",
        "berkeley.edu",
        "teaching.berkeley.edu",
        "openculture.com",
        "academicearth.org",
        "cmu.edu",
        "cornell.edu",
    }
)


def _host_allowed(netloc: str) -> bool:
    host = netloc.lower().removeprefix("www.")
    return any(host == trusted or host.endswith("." + trusted) for trusted in _TRUSTED_SYLLABUS_HOSTS)


def _looks_like_html_syllabus(url: str) -> bool:
    lower = url.lower()
    return any(
        hint in lower
        for hint in ("/syllabus", "/syllabi", "pages/syllabus", "course-outline")
    )


def _queries_for_course(course: sqlite3.Row) -> list[str]:
    name = course["name"]
    code = course["course_code"] or ""
    queries: list[str] = []
    for site_filter, _label in UNIVERSITY_SITE_QUERIES:
        queries.append(f'"{name}" syllabus filetype:pdf {site_filter}')
        if code:
            queries.append(f'"{code}" syllabus filetype:pdf {site_filter}')
        queries.append(f'"{name}" syllabus {site_filter}')
    return queries


class UniversitySearchSource(SyllabusSource):
    name = "university-search"
    label = "Site-specific university search (DDG)"

    def discover_for_course(
        self,
        course: sqlite3.Row,
        client: httpx.Client,
        *,
        verbose: bool = True,
    ) -> set[PdfCandidate]:
        queries = _queries_for_course(course)
        found = discover_via_duckduckgo(
            queries,
            max_results_per_query=15,
            client=client,
            max_follow_pages=10,
            verbose=verbose,
        )
        course_id = int(course["id"])
        tagged: set[PdfCandidate] = set()
        for candidate in found:
            host = urlparse(candidate.url).netloc
            if not _host_allowed(host):
                continue
            tagged.add(
                PdfCandidate(
                    url=candidate.url,
                    discovery_source=f"university_search:{host}",
                    referrer_url=candidate.referrer_url,
                    link_text=candidate.link_text,
                    target_course_id=course_id,
                    content_type=candidate.content_type,
                )
            )
        if tagged:
            vprint(
                f"       University search: {len(tagged)} candidate(s) for {course['name']}",
                verbose=verbose,
            )
        return tagged


class UniversitySeedSource(SyllabusSource):
    name = "university-seeds"
    label = "University syllabus index pages"

    def discover_all(
        self,
        client: httpx.Client,
        *,
        verbose: bool = True,
    ) -> set[PdfCandidate]:
        found, _pages = discover_from_seed_pages(
            client,
            UNIVERSITY_SEED_URLS,
            max_pages=50,
            verbose=verbose,
        )
        return found

    def discover_for_course(
        self,
        course: sqlite3.Row,
        client: httpx.Client,
        *,
        verbose: bool = True,
    ) -> set[PdfCandidate]:
        name = course["name"].lower()
        code = (course["course_code"] or "").lower()
        course_id = int(course["id"])
        candidates: set[PdfCandidate] = set()

        for seed_url in UNIVERSITY_SEED_URLS:
            try:
                resp = client.get(seed_url, follow_redirects=True)
                resp.raise_for_status()
            except Exception:
                continue
            if "html" not in resp.headers.get("content-type", "").lower():
                continue
            html = resp.text.lower()
            if name not in html and (not code or code.replace(" ", "") not in html.replace(" ", "")):
                continue
            page_candidates = extract_pdf_candidates(
                resp.text,
                str(resp.url),
                discovery_source="university_seed",
                permissive=True,
            )
            for candidate in page_candidates:
                candidates.add(
                    PdfCandidate(
                        url=candidate.url,
                        discovery_source=candidate.discovery_source,
                        referrer_url=candidate.referrer_url,
                        link_text=candidate.link_text,
                        target_course_id=course_id,
                    )
                )
        return candidates


def discover_trusted_html_syllabus_pages(
    course: sqlite3.Row,
    client: httpx.Client,
    *,
    verbose: bool = True,
) -> set[PdfCandidate]:
    """Follow DDG HTML syllabus hits on trusted hosts (CS50, Harvard PLL, etc.)."""
    queries = [
        f'"{course["name"]}" syllabus site:cs50.harvard.edu',
        f'"{course["name"]}" syllabus site:pll.harvard.edu',
        f'"{course["name"]}" syllabus site:ocw.mit.edu/pages/syllabus',
    ]
    course_id = int(course["id"])
    candidates: set[PdfCandidate] = set()

    for query in queries:
        rows: list[dict] = []
        try:
            from ddgs import DDGS

            for row in DDGS().text(query, max_results=8):
                rows.append(row)
        except Exception:
            continue

        for row in rows:
            href = row.get("href") or row.get("url")
            if not href:
                continue
            host = urlparse(href).netloc
            if not _host_allowed(host):
                continue
            if not _looks_like_html_syllabus(href):
                continue
            if href.lower().endswith(".pdf"):
                candidates.add(
                    PdfCandidate(
                        url=href,
                        discovery_source=f"university_html:{host}",
                        target_course_id=course_id,
                    )
                )
                continue
            try:
                resp = client.get(href, follow_redirects=True)
                resp.raise_for_status()
            except Exception:
                continue
            ct = resp.headers.get("content-type", "").lower()
            if "html" not in ct:
                continue
            pdfs = extract_pdf_candidates(
                resp.text, str(resp.url), discovery_source="university_html", permissive=True
            )
            if pdfs:
                for pdf in pdfs:
                    candidates.add(
                        PdfCandidate(
                            url=pdf.url,
                            discovery_source=pdf.discovery_source,
                            referrer_url=pdf.referrer_url,
                            link_text=pdf.link_text,
                            target_course_id=course_id,
                        )
                    )
            elif _looks_like_html_syllabus(str(resp.url)):
                candidates.add(
                    PdfCandidate(
                        url=str(resp.url),
                        discovery_source=f"university_html:{host}",
                        referrer_url=seed_url if (seed_url := href) else None,
                        link_text=course["name"],
                        target_course_id=course_id,
                        content_type="html",
                    )
                )

    if candidates:
        vprint(
            f"       Trusted HTML: {len(candidates)} candidate(s) for {course['name']}",
            verbose=verbose,
        )
    return candidates
