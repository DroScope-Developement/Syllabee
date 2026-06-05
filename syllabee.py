#!/usr/bin/env python3
"""SyllaBee catalog & curriculum CLI."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from crawler.config import (
    DEFAULT_DATA_DIR,
    DEFAULT_DB_PATH,
    DEFAULT_MAX_PER_COURSE,
    DEFAULT_OUTPUT_DIR,
)
from crawler.curriculum_loader import load_seed_data
from crawler.db import Catalog
from crawler.migrate import import_existing_pdfs
from crawler.reorganize import reorganize_sylabi


def cmd_init(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    with Catalog(Path(args.db)) as catalog:
        load_seed_data(catalog, data_dir)
        stats = catalog.stats()
    print(f"Database ready: {Path(args.db).resolve()}")
    print(json.dumps(stats, indent=2))
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        print(json.dumps(catalog.stats(), indent=2))
    return 0


def cmd_domains(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        rows = catalog.list_domains()
    if not rows:
        print("No domains crawled yet.")
        return 0
    for r in rows:
        print(
            f"{r['domain']:40}  pages={r['pages_fetched']:4}  "
            f"pdfs={r['pdfs_downloaded']}/{r['pdfs_discovered']}  last={r['last_crawled_at']}"
        )
    return 0


def cmd_syllabi(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        rows = catalog.list_syllabi(course_slug=args.course)
    if not rows:
        print("No syllabi in catalog.")
        return 0
    for r in rows:
        course = r["course_name"] or r["course_slug"] or "—"
        print(
            f"[{r['status']}] {course:28}  {r['term_label'] or '—':12}  "
            f"{r['file_path'] or '—'}\n       {r['source_url']}"
        )
    return 0


def cmd_curriculum(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        rows = catalog.get_curriculum_tree(args.slug)
    if not rows:
        print(f"Unknown curriculum: {args.slug}")
        print("Run: python syllabee.py init")
        return 1

    major = rows[0]["major_name"]
    curr = rows[0]["curriculum_name"]
    print(f"{curr} — {major}\n")

    current_year = None
    current_term = None
    for r in rows:
        y, t = r["year_number"], r["term_name"]
        if (y, t) != (current_year, current_term):
            current_year, current_term = y, t
            print(f"Year {y} · {t}")
        code = f" ({r['course_code']})" if r["course_code"] else ""
        print(f"  • {r['course_name']}{code}")
    return 0


def cmd_overlap(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        rows = catalog.shared_courses_between_majors(args.major_a, args.major_b)
    if not rows:
        print("No shared courses (run init first).")
        return 0
    print(f"Shared courses: {args.major_a} ∩ {args.major_b}\n")
    for r in rows:
        code = f" ({r['course_code']})" if r["course_code"] else ""
        print(f"  • {r['name']}{code}  [{r['slug']}]")
    return 0


def cmd_gaps(args: argparse.Namespace) -> int:
    target = args.max_per_course
    with Catalog(Path(args.db)) as catalog:
        rows = catalog.coverage_report(target)
    if not rows:
        print("No courses in catalog. Run: python syllabee.py init")
        return 1
    print(f"Target: {target} syllabi per course\n")
    print(f"{'Have':>4}  {'Need':>4}  {'Queue':>5}  Course")
    print("-" * 58)
    for r in rows:
        if args.empty_only and r["have"] > 0:
            continue
        if args.incomplete_only and r["need"] == 0:
            continue
        print(f"{r['have']:4}  {r['need']:4}  {r['queued']:5}  {r['name']}")
    full = sum(1 for r in rows if r["need"] == 0)
    print(f"\n{full}/{len(rows)} courses at target")
    return 0


def cmd_reclassify(args: argparse.Namespace) -> int:
    from crawler.classify import resolve_syllabus_links
    from crawler.config import DEFAULT_COURSES_PATH, DEFAULT_TAXONOMY_PATH
    from crawler.taxonomy import load_merged_taxonomy

    taxonomy = load_merged_taxonomy(
        taxonomy_path=DEFAULT_TAXONOMY_PATH, courses_path=DEFAULT_COURSES_PATH
    )

    processed = 0
    relinked = 0
    cleared = 0
    slug_to_id: dict[str, int] = {}

    with Catalog(Path(args.db)) as catalog:
        rows = catalog.all_ok_syllabi()
        for s in rows:
            file_path = s["file_path"] or ""
            filename = Path(file_path).name if file_path else ""
            # The folder a PDF was filed under is the course the crawler
            # assigned (e.g. "Calculus 2/..."); used as a fallback signal.
            folder = Path(file_path).parent.name if file_path else ""
            if folder in (".", "_unclassified"):
                folder = ""
            links = resolve_syllabus_links(
                folder=folder,
                title=s["title"],
                filename=filename,
                url=s["source_url"],
                taxonomy=taxonomy,
            )

            db_links: list[tuple[int, float, str | None]] = []
            for link in links:
                cid = slug_to_id.get(link.slug)
                if cid is None:
                    row = catalog.get_course_by_slug(link.slug)
                    if not row:
                        continue
                    cid = int(row["id"])
                    slug_to_id[link.slug] = cid
                db_links.append((cid, link.confidence, link.reason))

            catalog.set_syllabus_course_links(s["id"], db_links, replace=True)
            primary = db_links[0][0] if db_links else None
            catalog.set_syllabus_primary_course(s["id"], primary)

            processed += 1
            if db_links:
                relinked += len(db_links)
            else:
                cleared += 1

    print(
        f"Reclassified {processed} syllabi: {relinked} course link(s), "
        f"{cleared} now unmatched."
    )
    return 0


def cmd_reorganize(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        moved, updated = reorganize_sylabi(catalog, Path(args.output_dir))
    print(f"Moved {moved} file(s), updated {updated} catalog row(s).")
    return 0


def cmd_import(args: argparse.Namespace) -> int:
    out = Path(args.output_dir)
    with Catalog(Path(args.db)) as catalog:
        if not args.no_init_data:
            load_seed_data(catalog, Path(args.data_dir))
        imported, skipped = import_existing_pdfs(catalog, out)
    print(f"Imported {imported} PDFs ({skipped} already in catalog).")
    return 0


def cmd_curricula(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        rows = catalog.list_curricula()
    if not rows:
        print("No curricula. Run: python syllabee.py init")
        return 1
    print(f"{'Slug':<32} {'Program':<40} Major")
    print("-" * 90)
    for r in rows:
        print(f"{r['slug']:<32} {r['name']:<40} {r['major_name']}")
    print(f"\nTotal: {len(rows)} curricula")
    return 0


def cmd_majors(args: argparse.Namespace) -> int:
    with Catalog(Path(args.db)) as catalog:
        rows = catalog.list_majors_with_curricula()
    if not rows:
        print("No majors. Run: python syllabee.py init")
        return 1
    last_slug = None
    for r in rows:
        if r["slug"] != last_slug:
            last_slug = r["slug"]
            print(f"\n{r['name']} ({r['slug']})")
        if r["curriculum_slug"]:
            print(f"  └─ {r['curriculum_name']} [{r['curriculum_slug']}]")
    print()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="SyllaBee catalog & curricula")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="Create DB and load courses/majors/curricula")
    p_init.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    p_init.set_defaults(func=cmd_init)

    sub.add_parser("stats", help="Catalog counts").set_defaults(func=cmd_stats)
    sub.add_parser("domains", help="Crawled domains").set_defaults(func=cmd_domains)

    p_syl = sub.add_parser("syllabi", help="List syllabi in database")
    p_syl.add_argument("--course", help="Filter by course slug")
    p_syl.set_defaults(func=cmd_syllabi)

    p_curr = sub.add_parser("curriculum", help="Show year/semester plan")
    p_curr.add_argument("slug", help="Curriculum slug, e.g. software-engineering-bs")
    p_curr.set_defaults(func=cmd_curriculum)

    p_ov = sub.add_parser("overlap", help="Shared courses between two majors")
    p_ov.add_argument("major_a")
    p_ov.add_argument("major_b")
    p_ov.set_defaults(func=cmd_overlap)

    sub.add_parser("majors", help="List majors and curriculum variants").set_defaults(
        func=cmd_majors
    )

    sub.add_parser("curricula", help="List all curriculum slugs (top programs)").set_defaults(
        func=cmd_curricula
    )

    p_imp = sub.add_parser("import", help="Register existing PDFs under sylabi/ in the DB")
    p_imp.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    p_imp.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    p_imp.add_argument("--no-init-data", action="store_true")
    p_imp.set_defaults(func=cmd_import)

    p_gaps = sub.add_parser("gaps", help="Show courses missing syllabi")
    p_gaps.add_argument(
        "--max-per-course",
        type=int,
        default=DEFAULT_MAX_PER_COURSE,
    )
    p_gaps.add_argument("--empty-only", action="store_true")
    p_gaps.add_argument("--incomplete-only", action="store_true", default=True)
    p_gaps.set_defaults(func=cmd_gaps)

    p_reorg = sub.add_parser("reorganize", help="Move loose PDFs into course folders")
    p_reorg.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    p_reorg.set_defaults(func=cmd_reorganize)

    sub.add_parser(
        "reclassify",
        help="Recompute syllabus->course links from stored metadata (fixes false matches)",
    ).set_defaults(func=cmd_reclassify)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
