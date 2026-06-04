#!/usr/bin/env python3
"""
Discover and download public syllabus PDFs into ./sylabi/

Usage:
  python -m venv .venv
  source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
  pip install -r requirements.txt
  python crawl_syllabi.py
  python crawl_syllabi.py --max-downloads 50 --output-dir sylabi
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx
from tqdm import tqdm

from crawler.config import (
    DEFAULT_OUTPUT_DIR,
    DEFAULT_SEARCH_QUERIES,
    DEFAULT_SEED_URLS,
    USER_AGENT,
)
from crawler.discover import discover_from_seed_pages, discover_via_duckduckgo
from crawler.download import SyllabusDownloader


def _load_lines(path: Path | None) -> list[str]:
    if path is None or not path.is_file():
        return []
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Find public syllabus PDFs online and save them to sylabi/",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Folder for downloaded PDFs (default: sylabi)",
    )
    parser.add_argument(
        "--max-downloads",
        type=int,
        default=None,
        help="Stop after this many successful new downloads",
    )
    parser.add_argument(
        "--max-results-per-query",
        type=int,
        default=40,
        help="DuckDuckGo results per search query",
    )
    parser.add_argument(
        "--max-seed-pages",
        type=int,
        default=30,
        help="Max HTML pages to fetch from seed URLs",
    )
    parser.add_argument(
        "--queries-file",
        type=Path,
        help="Extra search queries (one per line)",
    )
    parser.add_argument(
        "--seeds-file",
        type=Path,
        help="Extra seed URLs for shallow link extraction",
    )
    parser.add_argument(
        "--skip-search",
        action="store_true",
        help="Only crawl seed URLs, skip DuckDuckGo",
    )
    parser.add_argument(
        "--skip-seeds",
        action="store_true",
        help="Only use DuckDuckGo search, skip seed crawl",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Seconds between download requests",
    )
    parser.add_argument(
        "--ignore-robots",
        action="store_true",
        help="Download even when robots.txt disallows (use only for permitted sources)",
    )
    args = parser.parse_args()

    queries = list(DEFAULT_SEARCH_QUERIES) + _load_lines(args.queries_file)
    seeds = list(DEFAULT_SEED_URLS) + _load_lines(args.seeds_file)

    pdf_urls: set[str] = set()

    print("SyllaBee syllabus crawler")
    print(f"Output: {args.output_dir.resolve()}")
    print()

    with httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        if not args.skip_search and queries:
            print(f"Searching DuckDuckGo ({len(queries)} queries)...")
            found = discover_via_duckduckgo(
                queries,
                max_results_per_query=args.max_results_per_query,
                client=client,
                max_follow_pages=args.max_seed_pages,
            )
            print(f"  Found {len(found)} candidate PDF URLs from search")
            pdf_urls |= found

        if not args.skip_seeds and seeds:
            print(f"Shallow crawl of {len(seeds)} seed pages...")
            found, pages = discover_from_seed_pages(
                client,
                seeds,
                max_pages=args.max_seed_pages,
            )
            print(f"  Fetched {len(pages)} pages, {len(found)} candidate PDF URLs")
            pdf_urls |= found

    print(f"\nTotal unique candidate URLs: {len(pdf_urls)}")
    if not pdf_urls:
        print("No URLs found. Try again later or add --queries-file / --seeds-file.")
        return 1

    downloader = SyllabusDownloader(
        args.output_dir,
        delay_sec=args.delay,
        respect_robots=not args.ignore_robots,
    )
    try:
        ok = skipped = failed = 0
        for url in tqdm(sorted(pdf_urls), desc="Downloading"):
            if args.max_downloads is not None and ok >= args.max_downloads:
                break
            record = downloader.download_url(url)
            if not record:
                continue
            if record.status == "ok":
                ok += 1
            elif record.status == "skipped":
                skipped += 1
            else:
                failed += 1
    finally:
        downloader.close()

    print()
    print("Done.")
    print(f"  Saved:   {ok}")
    print(f"  Skipped: {skipped} (duplicate, robots, or already in manifest)")
    print(f"  Failed:  {failed}")
    print(f"  Manifest: {(args.output_dir / 'manifest.jsonl').resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
