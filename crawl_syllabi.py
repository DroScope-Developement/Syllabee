#!/usr/bin/env python3
"""
Discover and download public syllabus PDFs into subject folders under sylabi/
and record everything in the SQLite catalog (data/syllabee.db).

Usage:
  python syllabee.py init
  python crawl_syllabi.py --ignore-robots
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx
from tqdm import tqdm

from crawler.config import (
    DEFAULT_DATA_DIR,
    DEFAULT_DB_PATH,
    DEFAULT_MAX_PER_COURSE,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_SEARCH_QUERIES,
    DEFAULT_SEED_URLS,
    USER_AGENT,
)
from crawler.curriculum_loader import load_seed_data
from crawler.db import Catalog
from crawler.discover import discover_from_seed_pages, discover_via_duckduckgo
from crawler.download import SyllabusDownloader
from crawler.log import PhaseTimer, vprint
from crawler.models import PdfCandidate


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
        help="Max PDFs per subject/course folder (default: 10). Use 0 for no per-course limit.",
    )
    parser.add_argument(
        "--max-downloads",
        type=int,
        default=None,
        help="Optional global cap (normally unused; prefer --max-per-course)",
    )
    parser.add_argument(
        "--no-course-queries",
        action="store_true",
        help="Skip auto-generated per-course DuckDuckGo queries",
    )
    parser.add_argument("--max-results-per-query", type=int, default=40)
    parser.add_argument("--max-seed-pages", type=int, default=30)
    parser.add_argument("--queries-file", type=Path)
    parser.add_argument("--seeds-file", type=Path)
    parser.add_argument("--skip-search", action="store_true")
    parser.add_argument("--skip-seeds", action="store_true")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument(
        "--ignore-robots",
        action="store_true",
        help="Download even when robots.txt disallows (permitted sources only)",
    )
    parser.add_argument(
        "--no-init-data",
        action="store_true",
        help="Skip loading courses/majors YAML into DB on startup",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Less console output (progress bars only where applicable)",
    )
    args = parser.parse_args()
    verbose = not args.quiet

    queries = list(DEFAULT_SEARCH_QUERIES) + _load_lines(args.queries_file)
    seeds = list(DEFAULT_SEED_URLS) + _load_lines(args.seeds_file)
    max_per_course = args.max_per_course if args.max_per_course > 0 else None

    candidates: set[PdfCandidate] = set()
    fetched_pages: list[str] = []

    print("SyllaBee syllabus crawler")
    print(f"PDF root:  {args.output_dir.resolve()}")
    print(f"Database:  {args.db.resolve()}")
    if max_per_course:
        print(f"Limit:     up to {max_per_course} PDFs per subject/course")
    print()

    with Catalog(args.db) as catalog:
        if not args.no_init_data:
            load_seed_data(catalog, args.data_dir)

        if not args.no_course_queries:
            course_rows = catalog.list_courses()
            vprint(
                f"Added {len(course_rows) * 2} per-course search queries "
                f"({len(course_rows)} courses).",
                verbose=verbose,
            )
            for course in course_rows:
                name = course["name"]
                queries.append(f'"{name}" syllabus filetype:pdf site:.edu')
                queries.append(f'"{name}" course syllabus pdf')

        vprint(f"Total search queries: {len(queries)}", verbose=verbose)
        session_id = catalog.start_crawl_session(queries=queries, seeds=seeds)

        with httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            if not args.skip_search and queries:
                with PhaseTimer(
                    f"DuckDuckGo search ({len(queries)} queries)", verbose=verbose
                ):
                    found = discover_via_duckduckgo(
                        queries,
                        max_results_per_query=args.max_results_per_query,
                        client=client,
                        max_follow_pages=args.max_seed_pages,
                        verbose=verbose,
                    )
                print(f"  Search found {len(found)} candidate PDF URLs")
                candidates |= found

            if not args.skip_seeds and seeds:
                with PhaseTimer(f"Seed page crawl ({len(seeds)} seeds)", verbose=verbose):
                    found, fetched_pages = discover_from_seed_pages(
                        client,
                        seeds,
                        max_pages=args.max_seed_pages,
                        verbose=verbose,
                    )
                print(
                    f"  Seeds: {len(fetched_pages)} pages fetched, "
                    f"{len(found)} candidate PDFs"
                )
                candidates |= found

        _record_pages(catalog, fetched_pages)
        for c in candidates:
            domain = urlparse(c.url).netloc.lower()
            if domain:
                catalog.touch_domain(domain, pdfs_found_delta=0)

        print(f"\nTotal unique candidates: {len(candidates)}")
        if not candidates:
            catalog.finish_crawl_session(session_id, notes="no_candidates")
            print("No URLs found. Try --queries-file / --seeds-file.")
            return 1

        vprint(
            f"\nDownloading {len(candidates)} candidates "
            f"(up to {max_per_course or '∞'} per course)...",
            verbose=verbose,
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
        ok = skipped = failed = cap_skips = 0
        download_iter = sorted(candidates, key=lambda c: c.url)
        try:
            if verbose:
                iterator = download_iter
            else:
                iterator = tqdm(download_iter, desc="Downloading")
            for candidate in iterator:
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
        finally:
            downloader.close()
            catalog.finish_crawl_session(
                session_id,
                notes=f"ok={ok} skipped={skipped} cap={cap_skips} failed={failed}",
            )
            stats = catalog.stats()

    print()
    print("Done.")
    print(f"  Saved:   {ok}")
    print(f"  Skipped: {skipped} ({cap_skips} already at per-course limit)")
    print(f"  Failed:  {failed}")
    print(f"  Catalog: {stats['syllabi_ok']} syllabi, {stats['courses']} courses, {stats['domains']} domains")
    return 0


if __name__ == "__main__":
    sys.exit(main())
