from __future__ import annotations

import re
import time
from typing import Iterable
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from ddgs import DDGS

from crawler.config import PDF_EXTENSIONS, SYLLABUS_URL_HINTS
from crawler.log import PhaseTimer, vprint, vprint_query_progress
from crawler.models import PdfCandidate

_PDF_URL_RE = re.compile(
    r"https?://[^\s\"'<>]+\.pdf(?:\?[^\s\"'<>]*)?",
    re.IGNORECASE,
)


def _normalize_url(url: str) -> str | None:
    url = url.strip()
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.netloc:
        return None
    return url.split("#", 1)[0]


def looks_like_syllabus_pdf(url: str) -> bool:
    lower = url.lower()
    if not any(lower.endswith(ext) or f"{ext}?" in lower for ext in PDF_EXTENSIONS):
        return False
    return any(hint in lower for hint in SYLLABUS_URL_HINTS)


def _page_mentions_syllabus(html: str, page_url: str) -> bool:
    text = (html[:8000] + page_url).lower()
    return any(hint in text for hint in SYLLABUS_URL_HINTS)


def extract_pdf_candidates(
    html: str,
    base_url: str,
    *,
    discovery_source: str,
    permissive: bool | None = None,
) -> set[PdfCandidate]:
    if permissive is None:
        permissive = _page_mentions_syllabus(html, base_url)

    found: set[PdfCandidate] = set()
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        absolute = _normalize_url(urljoin(base_url, href))
        if not absolute:
            continue
        lower = absolute.lower()
        if not any(lower.endswith(ext) or f"{ext}?" in lower for ext in PDF_EXTENSIONS):
            continue
        if permissive or looks_like_syllabus_pdf(absolute):
            link_text = tag.get_text(strip=True) or None
            found.add(
                PdfCandidate(
                    url=absolute,
                    discovery_source=discovery_source,
                    referrer_url=base_url,
                    link_text=link_text,
                )
            )
    for match in _PDF_URL_RE.finditer(html):
        absolute = _normalize_url(match.group(0))
        if absolute and (permissive or looks_like_syllabus_pdf(absolute)):
            found.add(
                PdfCandidate(
                    url=absolute,
                    discovery_source=discovery_source,
                    referrer_url=base_url,
                )
            )
    return found


def _candidates_from_search_row(row: dict) -> set[PdfCandidate]:
    found: set[PdfCandidate] = set()
    for key in ("href", "url"):
        href = row.get(key)
        if href:
            normalized = _normalize_url(href)
            if normalized and looks_like_syllabus_pdf(normalized):
                found.add(PdfCandidate(url=normalized, discovery_source="search"))
    body = row.get("body") or ""
    for match in _PDF_URL_RE.finditer(body):
        normalized = _normalize_url(match.group(0))
        if normalized and looks_like_syllabus_pdf(normalized):
            found.add(PdfCandidate(url=normalized, discovery_source="search_snippet"))
    return found


def discover_via_duckduckgo(
    queries: Iterable[str],
    *,
    max_results_per_query: int = 40,
    client: httpx.Client | None = None,
    max_follow_pages: int = 20,
    verbose: bool = True,
) -> set[PdfCandidate]:
    candidates: set[PdfCandidate] = set()
    pages_to_follow: list[str] = []
    query_list = list(queries)
    total = len(query_list)

    vprint(
        f"  Running {total} search queries ({max_results_per_query} results each)...",
        verbose=verbose,
    )
    vprint("  (Each query can take several seconds — progress prints below.)\n", verbose=verbose)

    ddgs = DDGS()

    for index, query in enumerate(query_list, start=1):
        before = len(candidates)
        t0 = time.monotonic()
        err: str | None = None
        try:
            for row in ddgs.text(query, max_results=max_results_per_query):
                candidates |= _candidates_from_search_row(row)
                href = row.get("href") or row.get("url")
                if href:
                    normalized = _normalize_url(href)
                    if normalized and not looks_like_syllabus_pdf(normalized):
                        lower = normalized.lower()
                        if any(h in lower for h in SYLLABUS_URL_HINTS):
                            pages_to_follow.append(normalized)
        except Exception as exc:
            err = f"{type(exc).__name__}: {exc}"

        vprint_query_progress(
            index,
            total,
            query,
            verbose=verbose,
            new_count=len(candidates) - before,
            total_candidates=len(candidates),
            elapsed_sec=time.monotonic() - t0,
            error=err,
        )

    if client and pages_to_follow:
        unique_pages = list(dict.fromkeys(pages_to_follow))[:max_follow_pages]
        vprint(
            f"\n  Following {len(unique_pages)} syllabus listing pages for more PDF links...",
            verbose=verbose,
        )
        seen: set[str] = set()
        for page_index, page_url in enumerate(unique_pages, start=1):
            if page_url in seen:
                continue
            seen.add(page_url)
            before = len(candidates)
            vprint(f"    [{page_index}/{len(unique_pages)}] GET {page_url}", verbose=verbose)
            try:
                resp = client.get(page_url, follow_redirects=True)
                resp.raise_for_status()
            except Exception as exc:
                vprint(f"         skip: {exc}", verbose=verbose)
                continue
            if "html" not in resp.headers.get("content-type", "").lower():
                if "<html" not in resp.text[:800].lower():
                    vprint("         skip: not HTML", verbose=verbose)
                    continue
            candidates |= extract_pdf_candidates(
                resp.text, str(resp.url), discovery_source="search_follow"
            )
            vprint(
                f"         +{len(candidates) - before} PDFs (total: {len(candidates)})",
                verbose=verbose,
            )

    return candidates


def discover_from_seed_pages(
    client: httpx.Client,
    seed_urls: Iterable[str],
    *,
    max_pages: int = 30,
    verbose: bool = True,
) -> tuple[set[PdfCandidate], list[str]]:
    candidates: set[PdfCandidate] = set()
    fetched_pages: list[str] = []
    queue = [_normalize_url(u) for u in seed_urls]
    queue = [u for u in queue if u]
    seen_pages: set[str] = set()

    vprint(f"  Seed queue: {len(queue)} URLs (max {max_pages} pages)", verbose=verbose)

    while queue and len(fetched_pages) < max_pages:
        page_url = queue.pop(0)
        if page_url in seen_pages:
            continue
        seen_pages.add(page_url)

        vprint(
            f"  [{len(fetched_pages) + 1}/{max_pages}] GET {page_url}  (queue: {len(queue)})",
            verbose=verbose,
        )
        try:
            resp = client.get(page_url, follow_redirects=True)
            resp.raise_for_status()
        except Exception as exc:
            vprint(f"       skip: {exc}", verbose=verbose)
            continue

        content_type = resp.headers.get("content-type", "").lower()
        if "pdf" in content_type or page_url.lower().endswith(".pdf"):
            if looks_like_syllabus_pdf(page_url):
                candidates.add(
                    PdfCandidate(url=page_url, discovery_source="seed_direct")
                )
                vprint("       direct PDF link", verbose=verbose)
            continue

        if "html" not in content_type and "<html" not in resp.text[:500].lower():
            vprint("       skip: not HTML/PDF", verbose=verbose)
            continue

        before = len(candidates)
        fetched_pages.append(page_url)
        candidates |= extract_pdf_candidates(
            resp.text, str(resp.url), discovery_source="seed_crawl"
        )
        vprint(
            f"       +{len(candidates) - before} PDFs (total: {len(candidates)})",
            verbose=verbose,
        )

        if len(fetched_pages) >= max_pages:
            break
        soup = BeautifulSoup(resp.text, "html.parser")
        base_host = urlparse(str(resp.url)).netloc
        added_links = 0
        for tag in soup.find_all("a", href=True):
            href = tag["href"].strip()
            absolute = _normalize_url(urljoin(str(resp.url), href))
            if not absolute:
                continue
            if urlparse(absolute).netloc != base_host:
                continue
            lower = absolute.lower()
            if any(h in lower for h in SYLLABUS_URL_HINTS) and absolute not in seen_pages:
                if len(queue) < max_pages * 2:
                    queue.append(absolute)
                    added_links += 1
        if verbose and added_links:
            vprint(f"       queued {added_links} same-site syllabus links", verbose=verbose)

    return candidates, fetched_pages
