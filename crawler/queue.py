from __future__ import annotations

import sqlite3

from crawler.config import (
    DEFAULT_MAX_DOWNLOAD_ATTEMPTS,
    DEFAULT_MIN_QUEUE_BEFORE_SEARCH,
)
from crawler.db.catalog import Catalog
from crawler.discover import discover_via_duckduckgo
from crawler.download import SyllabusDownloader
from crawler.log import vprint
from crawler.models import PdfCandidate


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


def _try_attach_existing_ok(
    catalog: Catalog,
    *,
    course_id: int,
    url: str,
    queue_id: int,
) -> bool:
    """If URL already downloaded OK elsewhere, link it to this course and fulfill queue row."""
    row = catalog.get_syllabus_row_by_url(url)
    if not row or row["status"] != "ok":
        return False
    syllabus_id = int(row["id"])
    catalog.link_syllabus_courses(syllabus_id, [course_id], match_reason="existing_ok")
    catalog.update_candidate(
        queue_id,
        status="fulfilled",
        syllabus_id=syllabus_id,
        skip_reason="linked_existing",
    )
    return True


def _is_permanent_global_skip(row: sqlite3.Row | None) -> bool:
    if not row:
        return False
    if row["status"] != "skipped":
        return False
    src = (row["discovery_source"] or "").lower()
    return any(
        x in src
        for x in ("robots_txt", "duplicate_url", "duplicate_hash", "already_attempted")
    )


def process_course_queue(
    catalog: Catalog,
    downloader: SyllabusDownloader,
    course: sqlite3.Row,
    *,
    max_per_course: int,
    max_attempts: int = DEFAULT_MAX_DOWNLOAD_ATTEMPTS,
    verbose: bool = True,
) -> dict[str, int]:
    """Download from queued URLs until course has max_per_course OK syllabi."""
    course_id = int(course["id"])
    stats = {"saved": 0, "skipped": 0, "failed": 0, "fulfilled_existing": 0}

    while catalog.count_ok_syllabi_for_course(course_id) < max_per_course:
        pending = catalog.list_pending_candidates(course_id, max_attempts=max_attempts)
        if not pending:
            break

        vprint(
            f"       queue: {len(pending)} pending URL(s) to try",
            verbose=verbose,
        )

        made_progress = False
        for row in pending:
            if catalog.count_ok_syllabi_for_course(course_id) >= max_per_course:
                break

            url = row["source_url"]
            queue_id = int(row["id"])

            if _try_attach_existing_ok(
                catalog, course_id=course_id, url=url, queue_id=queue_id
            ):
                stats["fulfilled_existing"] += 1
                stats["saved"] += 1
                made_progress = True
                continue

            global_row = catalog.get_syllabus_row_by_url(url)
            if _is_permanent_global_skip(global_row):
                catalog.update_candidate(
                    queue_id,
                    status="skipped",
                    skip_reason=global_row["discovery_source"],
                )
                stats["skipped"] += 1
                continue

            candidate = PdfCandidate(
                url=url,
                discovery_source=row["discovery_source"] or "queue",
                referrer_url=row["referrer_url"],
                link_text=row["link_text"],
                target_course_id=course_id,
                queue_id=queue_id,
            )
            result = downloader.download_candidate(candidate)
            if result.status == "ok":
                stats["saved"] += 1
                made_progress = True
            elif result.status == "skipped":
                stats["skipped"] += 1
            else:
                stats["failed"] += 1

        if not made_progress and pending:
            # Avoid infinite loop when every pending URL fails/skips
            break

    return stats


def discover_and_enqueue(
    catalog: Catalog,
    course: sqlite3.Row,
    client,
    *,
    max_results_per_query: int = 25,
    verbose: bool = True,
) -> int:
    """Search and add new candidates to the per-course queue."""
    course_id = int(course["id"])
    queries = _queries_for_course(course)
    found = discover_via_duckduckgo(
        queries,
        max_results_per_query=max_results_per_query,
        client=client,
        max_follow_pages=8,
        verbose=verbose,
    )
    added = catalog.register_candidates(course_id, list(found))
    vprint(
        f"       search: {len(found)} URLs found, {added} new in queue "
        f"({catalog.count_candidates_for_course(course_id)} total for course)",
        verbose=verbose,
    )
    return added


def fill_curriculum_gaps(
    catalog: Catalog,
    downloader: SyllabusDownloader,
    client,
    *,
    max_per_course: int,
    max_results_per_query: int = 25,
    max_attempts: int = DEFAULT_MAX_DOWNLOAD_ATTEMPTS,
    min_queue_before_search: int = DEFAULT_MIN_QUEUE_BEFORE_SEARCH,
    verbose: bool = True,
) -> dict[str, int]:
    """
    For each course below the cap:
      1) Process queued URLs (including retries) until full or queue exhausted
      2) Search only when pending queue is empty
      3) Process new queue entries; repeat search if still not full
    """
    totals = {
        "courses_checked": 0,
        "courses_at_target": 0,
        "saved": 0,
        "skipped": 0,
        "failed": 0,
        "queued_new": 0,
        "search_rounds": 0,
    }

    courses = catalog.list_courses()
    needing = [
        c
        for c in courses
        if catalog.count_ok_syllabi_for_course(int(c["id"])) < max_per_course
    ]

    vprint(
        f"\nCurriculum gap fill: {len(needing)}/{len(courses)} courses below "
        f"{max_per_course} syllabi (queue-first)",
        verbose=verbose,
    )

    for course in needing:
        course_id = int(course["id"])
        name = course["name"]
        totals["courses_checked"] += 1
        have = catalog.count_ok_syllabi_for_course(course_id)

        vprint(
            f"\n  [{name}] {have}/{max_per_course} OK — "
            f"{catalog.count_pending_candidates(course_id, max_attempts=max_attempts)} queued",
            verbose=verbose,
        )

        # 1) Drain existing queue (from prior runs)
        qstats = process_course_queue(
            catalog,
            downloader,
            course,
            max_per_course=max_per_course,
            max_attempts=max_attempts,
            verbose=verbose,
        )
        totals["saved"] += qstats["saved"]
        totals["skipped"] += qstats["skipped"]
        totals["failed"] += qstats["failed"]

        # 2) Search + drain until full or no new URLs
        max_search_rounds = 3
        for round_num in range(1, max_search_rounds + 1):
            have = catalog.count_ok_syllabi_for_course(course_id)
            if have >= max_per_course:
                break

            pending = catalog.count_pending_candidates(
                course_id, max_attempts=max_attempts
            )
            if pending >= min_queue_before_search:
                vprint(
                    f"       still {pending} queued — skipping search this round",
                    verbose=verbose,
                )
                qstats = process_course_queue(
                    catalog,
                    downloader,
                    course,
                    max_per_course=max_per_course,
                    max_attempts=max_attempts,
                    verbose=verbose,
                )
                totals["saved"] += qstats["saved"]
                totals["skipped"] += qstats["skipped"]
                totals["failed"] += qstats["failed"]
                continue

            totals["search_rounds"] += 1
            vprint(f"       search round {round_num}...", verbose=verbose)
            added = discover_and_enqueue(
                catalog,
                course,
                client,
                max_results_per_query=max_results_per_query,
                verbose=verbose,
            )
            totals["queued_new"] += added

            if added == 0 and pending == 0:
                vprint("       no new URLs discovered", verbose=verbose)
                break

            qstats = process_course_queue(
                catalog,
                downloader,
                course,
                max_per_course=max_per_course,
                max_attempts=max_attempts,
                verbose=verbose,
            )
            totals["saved"] += qstats["saved"]
            totals["skipped"] += qstats["skipped"]
            totals["failed"] += qstats["failed"]

        have = catalog.count_ok_syllabi_for_course(course_id)
        if have >= max_per_course:
            totals["courses_at_target"] += 1
        vprint(f"       final: {have}/{max_per_course} OK", verbose=verbose)

    return totals
