from __future__ import annotations

import sqlite3

import httpx

from crawler.discover import discover_via_duckduckgo
from crawler.download import SyllabusDownloader
from crawler.log import PhaseTimer, vprint
from crawler.db.catalog import Catalog


def _queries_for_course(course: sqlite3.Row) -> list[str]:
    name = course["name"]
    code = course["course_code"] or ""
    queries = [
        f'"{name}" syllabus filetype:pdf site:.edu',
        f'"{name}" course syllabus pdf',
    ]
    if code:
        queries.append(f'"{code}" syllabus filetype:pdf')
        compact = code.replace(" ", "")
        queries.append(f"{compact} syllabus pdf site:.edu")
    return queries


def fill_curriculum_gaps(
    catalog: Catalog,
    downloader: SyllabusDownloader,
    client: httpx.Client,
    *,
    max_per_course: int,
    max_results_per_query: int = 25,
    verbose: bool = True,
) -> dict[str, int]:
    """
    For each catalog course with fewer than max_per_course syllabi,
    run targeted search and download until full or candidates exhausted.
    """
    stats = {"courses_checked": 0, "courses_filled": 0, "saved": 0, "skipped": 0, "failed": 0}

    courses = catalog.list_courses()
    needing = []
    for course in courses:
        have = catalog.count_ok_syllabi_for_course(int(course["id"]))
        need = max_per_course - have
        if need > 0:
            needing.append((course, have, need))

    vprint(
        f"\nCurriculum gap fill: {len(needing)}/{len(courses)} courses below "
        f"{max_per_course} syllabi",
        verbose=verbose,
    )

    with PhaseTimer("Per-course syllabus search", verbose=verbose):
        for course, have, need in needing:
            stats["courses_checked"] += 1
            name = course["name"]
            vprint(
                f"\n  [{name}] have {have}/{max_per_course} — searching...",
                verbose=verbose,
            )
            queries = _queries_for_course(course)
            candidates = discover_via_duckduckgo(
                queries,
                max_results_per_query=max_results_per_query,
                client=client,
                max_follow_pages=8,
                verbose=verbose,
            )
            if not candidates:
                vprint("       no candidates found", verbose=verbose)
                continue

            saved_this_course = 0
            for candidate in sorted(candidates, key=lambda c: c.url):
                if catalog.count_ok_syllabi_for_course(int(course["id"])) >= max_per_course:
                    break
                result = downloader.download_candidate(candidate)
                if result.status == "ok":
                    stats["saved"] += 1
                    saved_this_course += 1
                elif result.status == "skipped":
                    stats["skipped"] += 1
                else:
                    stats["failed"] += 1

            if saved_this_course > 0:
                stats["courses_filled"] += 1
            new_have = catalog.count_ok_syllabi_for_course(int(course["id"]))
            vprint(
                f"       done: +{saved_this_course} saved ({new_have}/{max_per_course} total)",
                verbose=verbose,
            )

    return stats
