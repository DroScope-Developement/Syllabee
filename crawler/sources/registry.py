from __future__ import annotations

import sqlite3

import httpx

from crawler.log import vprint
from crawler.models import PdfCandidate
from crawler.sources.base import SyllabusSource, merge_candidates
from crawler.sources.mit_ocw import MitOcwSource
from crawler.sources.university import (
    UniversitySearchSource,
    UniversitySeedSource,
    discover_trusted_html_syllabus_pages,
)

DEFAULT_SOURCES: dict[str, SyllabusSource] = {
    "mit-ocw": MitOcwSource(),
    "university-search": UniversitySearchSource(),
    "university-seeds": UniversitySeedSource(),
}

DEFAULT_SOURCE_NAMES: tuple[str, ...] = ("mit-ocw", "university-search")


def list_source_names() -> list[str]:
    return sorted(DEFAULT_SOURCES.keys())


def _resolve_sources(names: list[str] | None) -> list[SyllabusSource]:
    if not names:
        names = list(DEFAULT_SOURCE_NAMES)
    resolved: list[SyllabusSource] = []
    for name in names:
        key = name.strip().lower()
        if key not in DEFAULT_SOURCES:
            raise ValueError(f"Unknown source {name!r}. Choose from: {', '.join(list_source_names())}")
        resolved.append(DEFAULT_SOURCES[key])
    return resolved


def discover_for_course(
    course: sqlite3.Row,
    client: httpx.Client,
    *,
    source_names: list[str] | None = None,
    include_trusted_html: bool = True,
    verbose: bool = True,
) -> set[PdfCandidate]:
    """Run configured university sources for one catalog course."""
    sources = _resolve_sources(source_names)
    groups: list[set[PdfCandidate]] = []
    for source in sources:
        vprint(f"       source: {source.label}", verbose=verbose)
        groups.append(source.discover_for_course(course, client, verbose=verbose))
    if include_trusted_html:
        groups.append(
            discover_trusted_html_syllabus_pages(course, client, verbose=verbose)
        )
    return merge_candidates(*groups)


def discover_university_wide(
    client: httpx.Client,
    *,
    source_names: list[str] | None = None,
    verbose: bool = True,
) -> set[PdfCandidate]:
    """Broad discovery from seed-based sources."""
    sources = _resolve_sources(source_names or ["university-seeds"])
    groups: list[set[PdfCandidate]] = []
    for source in sources:
        vprint(f"  University source: {source.label}", verbose=verbose)
        groups.append(source.discover_all(client, verbose=verbose))
    return merge_candidates(*groups)
