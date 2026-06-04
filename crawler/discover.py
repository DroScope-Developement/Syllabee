from __future__ import annotations

import re
from typing import Iterable
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from ddgs import DDGS

from crawler.config import PDF_EXTENSIONS, SYLLABUS_URL_HINTS

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


def extract_pdf_links(html: str, base_url: str, *, permissive: bool | None = None) -> set[str]:
    """Extract PDF links; on syllabus listing pages, include all PDFs on that host."""
    if permissive is None:
        permissive = _page_mentions_syllabus(html, base_url)

    found: set[str] = set()
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
            found.add(absolute)
    for match in _PDF_URL_RE.finditer(html):
        absolute = _normalize_url(match.group(0))
        if absolute and (permissive or looks_like_syllabus_pdf(absolute)):
            found.add(absolute)
    return found


def _urls_from_search_row(row: dict) -> set[str]:
    urls: set[str] = set()
    for key in ("href", "url"):
        href = row.get(key)
        if href:
            normalized = _normalize_url(href)
            if normalized:
                if looks_like_syllabus_pdf(normalized):
                    urls.add(normalized)
    body = row.get("body") or ""
    for match in _PDF_URL_RE.finditer(body):
        normalized = _normalize_url(match.group(0))
        if normalized and looks_like_syllabus_pdf(normalized):
            urls.add(normalized)
    return urls


def discover_via_duckduckgo(
    queries: Iterable[str],
    *,
    max_results_per_query: int = 40,
    client: httpx.Client | None = None,
    max_follow_pages: int = 20,
) -> set[str]:
    """
    Find syllabus PDF URLs via DuckDuckGo (ddgs) search.
    Also shallow-fetches top HTML result pages that mention syllabi.
    """
    urls: set[str] = set()
    pages_to_follow: list[str] = []
    ddgs = DDGS()

    for query in queries:
        try:
            for row in ddgs.text(query, max_results=max_results_per_query):
                urls |= _urls_from_search_row(row)
                href = row.get("href") or row.get("url")
                if href:
                    normalized = _normalize_url(href)
                    if normalized and not looks_like_syllabus_pdf(normalized):
                        lower = normalized.lower()
                        if any(h in lower for h in SYLLABUS_URL_HINTS):
                            pages_to_follow.append(normalized)
        except Exception:
            continue

    if client and pages_to_follow:
        seen: set[str] = set()
        for page_url in pages_to_follow[:max_follow_pages]:
            if page_url in seen:
                continue
            seen.add(page_url)
            try:
                resp = client.get(page_url, follow_redirects=True)
                resp.raise_for_status()
            except Exception:
                continue
            if "html" not in resp.headers.get("content-type", "").lower():
                if "<html" not in resp.text[:800].lower():
                    continue
            urls |= extract_pdf_links(resp.text, str(resp.url))

    return urls


def discover_from_page(html: str, page_url: str) -> set[str]:
    return extract_pdf_links(html, page_url)


def discover_from_seed_pages(
    client: httpx.Client,
    seed_urls: Iterable[str],
    *,
    max_pages: int = 30,
) -> tuple[set[str], list[str]]:
    """
    Shallow crawl of seed pages for syllabus PDF links.
    Returns (pdf_urls, pages_fetched).
    """
    pdf_urls: set[str] = set()
    fetched_pages: list[str] = []
    queue = [_normalize_url(u) for u in seed_urls]
    queue = [u for u in queue if u]
    seen_pages: set[str] = set()

    while queue and len(fetched_pages) < max_pages:
        page_url = queue.pop(0)
        if page_url in seen_pages:
            continue
        seen_pages.add(page_url)

        try:
            resp = client.get(page_url, follow_redirects=True)
            resp.raise_for_status()
        except Exception:
            continue

        content_type = resp.headers.get("content-type", "").lower()
        if "pdf" in content_type or page_url.lower().endswith(".pdf"):
            if looks_like_syllabus_pdf(page_url):
                pdf_urls.add(page_url)
            continue

        if "html" not in content_type and "<html" not in resp.text[:500].lower():
            continue

        fetched_pages.append(page_url)
        pdf_urls |= extract_pdf_links(resp.text, str(resp.url))

        if len(fetched_pages) >= max_pages:
            break
        soup = BeautifulSoup(resp.text, "html.parser")
        base_host = urlparse(str(resp.url)).netloc
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

    return pdf_urls, fetched_pages
