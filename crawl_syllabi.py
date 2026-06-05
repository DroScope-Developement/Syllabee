#!/usr/bin/env python3
"""
Discover and download public syllabus PDFs into subject folders under sylabi/
and record everything in the SQLite catalog (data/syllabee.db).

Default mode fills each of the 74 catalog courses up to --max-per-course (3).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx

from crawler.config import (
    DEFAULT_DATA_DIR,
    DEFAULT_DB_PATH,
    DEFAULT_MAX_PER_COURSE,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_SEARCH_QUERIES,
    DEFAULT_SEED_URLS,
    DEFAULT_UNIVERSITY_SOURCES,
    USER_AGENT,
)
from crawler.curriculum_loader import load_seed_data
from crawler.db import Catalog
from crawler.discover import discover_from_seed_pages, discover_via_duckduckgo
from crawler.download import SyllabusDownloader
from crawler.queue import fill_curriculum_gaps
from crawler.log import PhaseTimer, vprint
from crawler.models import PdfCandidate
from crawler.reorganize import reorganize_sylabi
from crawler.sources.registry import discover_university_wide, list_source_names


def _load_lines(path: Path | None) -> list[str]:
    if path is None or not path.is_file():
        return []
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def _record_pages(catalog: Catalog, pages: list[str]) -> None:
    for page_url in pages:
        domain = urlparse(page_url).netloc.lower()
        if domain:
            catalog.touch_domain(domain, pages_delta=1)


def _print_coverage(catalog: Catalog, max_per_course: int) -> None:
    rows = catalog.coverage_report(max_per_course)
    full = sum(1 for r in rows if r["have"] >= max_per_course)
    empty = sum(1 for r in rows if r["have"] == 0)
    print(f"\nCoverage: {full}/{len(rows)} courses at {max_per_course}+ syllabi, {empty} empty")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Crawl public syllabus PDFs into subject folders + SQLite catalog",
    )
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument(
        "--max-per-course",
        type=int,
        default=DEFAULT_MAX_PER_COURSE,
        help="Target PDFs per catalog course (default: 3). Use 0 for no limit.",
    )
    parser.add_argument("--max-downloads", type=int, default=None)
    parser.add_argument(
        "--fill-gaps",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Search per course that is below the cap (default: on)",
    )
    parser.add_argument(
        "--broad-discovery",
        action="store_true",
        help="Also run generic + all-course DuckDuckGo queries before gap fill",
    )
    parser.add_argument(
        "--no-course-queries",
        action="store_true",
        help="With --broad-discovery, skip auto per-course query expansion",
    )
    parser.add_argument("--max-results-per-query", type=int, default=25)
    parser.add_argument("--max-seed-pages", type=int, default=30)
    parser.add_argument("--queries-file", type=Path)
    parser.add_argument("--seeds-file", type=Path)
    parser.add_argument("--skip-search", action="store_true")
    parser.add_argument("--skip-seeds", action="store_true")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--ignore-robots", action="store_true")
    parser.add_argument("--no-init-data", action="store_true")
    parser.add_argument(
        "--sources",
        type=str,
        default=",".join(DEFAULT_UNIVERSITY_SOURCES),
        help=(
            "Comma-separated university sources for gap-fill "
            f"({', '.join(list_source_names())}). Use 'none' to disable."
        ),
    )
    parser.add_argument(
        "--no-university-sources",
        action="store_true",
        help="Skip MIT OCW / university search during gap fill",
    )
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument(
        "--reorganize-first",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Move loose PDFs in sylabi/ into course folders before crawling",
    )
    args = parser.parse_args()
    verbose = not args.quiet
    max_per_course = args.max_per_course if args.max_per_course > 0 else None
    if args.no_university_sources or args.sources.strip().lower() == "none":
        university_sources: list[str] | None = None
        use_university_sources = False
    else:
        university_sources = [s.strip() for s in args.sources.split(",") if s.strip()]
        use_university_sources = True

    print("SyllaBee syllabus crawler")
    print(f"PDF root:  {args.output_dir.resolve()}")
    print(f"Database:  {args.db.resolve()}")
    if max_per_course:
        print(f"Target:    {max_per_course} PDFs per catalog course (gap-fill mode)")
    print()

    ok = skipped = failed = cap_skips = 0

    with Catalog(args.db) as catalog:
        if not args.no_init_data:
            load_seed_data(catalog, args.data_dir)

        if args.reorganize_first:
            moved, _ = reorganize_sylabi(catalog, args.output_dir)
            if moved:
                vprint(f"Reorganized {moved} loose PDF(s) into course folders.", verbose=verbose)

        _print_coverage(catalog, max_per_course or DEFAULT_MAX_PER_COURSE)

        session_id = catalog.start_crawl_session(
            queries=["fill-gaps"] if args.fill_gaps else [],
            seeds=[],
        )

        downloader = SyllabusDownloader(
            catalog,
            args.output_dir,
            delay_sec=args.delay,
            respect_robots=not args.ignore_robots,
            crawl_session_id=session_id,
            max_per_course=max_per_course,
            verbose=verbose,
        )

        try:
            with httpx.Client(
                headers={"User-Agent": USER_AGENT},
                timeout=30.0,
                follow_redirects=True,
            ) as client:
                if args.broad_discovery:
                    queries = list(DEFAULT_SEARCH_QUERIES) + _load_lines(args.queries_file)
                    seeds = list(DEFAULT_SEED_URLS) + _load_lines(args.seeds_file)
                    candidates: set[PdfCandidate] = set()
                    fetched_pages: list[str] = []

                    if not args.no_course_queries:
                        for course in catalog.list_courses():
                            name = course["name"]
                            queries.append(f'"{name}" syllabus filetype:pdf site:.edu')

                    if not args.skip_search and queries:
                        with PhaseTimer(
                            f"Broad search ({len(queries)} queries)", verbose=verbose
                        ):
                            candidates |= discover_via_duckduckgo(
                                queries,
                                max_results_per_query=args.max_results_per_query,
                                client=client,
                                max_follow_pages=args.max_seed_pages,
                                verbose=verbose,
                            )

                    if not args.skip_seeds and seeds:
                        with PhaseTimer("Seed crawl", verbose=verbose):
                            found, fetched_pages = discover_from_seed_pages(
                                client,
                                seeds,
                                max_pages=args.max_seed_pages,
                                verbose=verbose,
                            )
                            candidates |= found
                        _record_pages(catalog, fetched_pages)

                    with PhaseTimer("University index crawl", verbose=verbose):
                        candidates |= discover_university_wide(
                            client,
                            source_names=["university-seeds"],
                            verbose=verbose,
                        )

                    vprint(f"\nBroad discovery: {len(candidates)} candidates", verbose=verbose)
                    for candidate in sorted(candidates, key=lambda c: c.url):
                        if args.max_downloads is not None and ok >= args.max_downloads:
                            break
                        result = downloader.download_candidate(candidate)
                        if result.status == "ok":
                            ok += 1
                        elif result.status == "skipped":
                            skipped += 1
                            if result.reason and str(result.reason).startswith("course_cap"):
                                cap_skips += 1
                        else:
                            failed += 1

                if args.fill_gaps and max_per_course:
                    gap_stats = fill_curriculum_gaps(
                        catalog,
                        downloader,
                        client,
                        max_per_course=max_per_course,
                        max_results_per_query=args.max_results_per_query,
                        university_sources=university_sources,
                        use_university_sources=use_university_sources,
                        verbose=verbose,
                    )
                    ok += gap_stats.get("saved", 0)
                    skipped += gap_stats.get("skipped", 0)
                    failed += gap_stats.get("failed", 0)
                    vprint(
                        f"  Gap fill: +{gap_stats.get('queued_new', 0)} URLs queued, "
                        f"{gap_stats.get('search_rounds', 0)} search rounds",
                        verbose=verbose,
                    )

        finally:
            downloader.close()
            catalog.finish_crawl_session(
                session_id,
                notes=f"ok={ok} skipped={skipped} failed={failed}",
            )
            stats = catalog.stats()
            _print_coverage(catalog, max_per_course or DEFAULT_MAX_PER_COURSE)

    print()
    print("Done.")
    print(f"  Saved this run: {ok}")
    print(f"  Skipped:        {skipped}")
    print(f"  Failed:         {failed}")
    print(f"  Catalog OK:     {stats['syllabi_ok']} syllabi across {stats['courses']} courses")
    print(
        f"  URL queue:      {stats.get('candidates_pending', 0)} pending / "
        f"{stats.get('candidates_total', 0)} total discovered"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
