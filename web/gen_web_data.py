#!/usr/bin/env python3
"""Generate the static catalog the SyllaBee web app consumes.

Reads the existing YAML catalog (courses + programs) and the populated
SQLite database, then emits:

  - web/src/data/catalog.json   (majors, curricula, courses, syllabi metadata)
  - web/public/syllabi/<course-slug>/<file>.pdf   (copied static assets)

No database or backend is used at runtime; the site is fully static.

Run from anywhere:  python web/gen_web_data.py
"""

from __future__ import annotations

import json
import re
import shutil
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent

# Allow importing the crawler's shared classifier so the website applies the
# same boundary-aware relevance check (non-destructive; the DB is untouched).
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
DATA_DIR = REPO_ROOT / "data"
SYLABI_DIR = REPO_ROOT / "sylabi"
DB_PATH = DATA_DIR / "syllabee.db"

WEB_DIR = Path(__file__).resolve().parent
JSON_OUT = WEB_DIR / "src" / "data" / "catalog.json"
PDF_OUT_DIR = WEB_DIR / "public" / "syllabi"


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def safe_segment(value: str) -> str:
    """Make a filesystem/url-safe path segment."""
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("_")
    return value or "file"


def build_courses(courses_yaml: dict) -> dict:
    courses: dict[str, dict] = {}
    for entry in courses_yaml.get("courses", []):
        slug = entry["slug"]
        courses[slug] = {
            "slug": slug,
            "name": entry.get("name", slug),
            "code": entry.get("code"),
            "category": entry.get("category", "general"),
            "description": entry.get("description"),
            "requiredBy": [],   # major slugs that list it as a required course
            "sharedIn": [],     # major slugs whose plan includes it
            "syllabi": [],
        }
    return courses


def build_majors(programs_yaml: dict, courses: dict) -> list[dict]:
    majors: list[dict] = []
    plan_membership: dict[str, set[str]] = defaultdict(set)
    required_membership: dict[str, set[str]] = defaultdict(set)

    for major in programs_yaml.get("majors", []):
        major_slug = major["slug"]
        for course_slug in major.get("required_courses", []) or []:
            required_membership[course_slug].add(major_slug)

        curricula_out = []
        for curriculum in major.get("curricula", []) or []:
            plan_out = []
            course_count = 0
            for year_block in curriculum.get("plan", []) or []:
                terms_out = []
                for term in year_block.get("terms", []) or []:
                    term_courses = list(term.get("courses", []) or [])
                    course_count += len(term_courses)
                    for cs in term_courses:
                        plan_membership[cs].add(major_slug)
                    terms_out.append({
                        "name": term.get("name", ""),
                        "courses": term_courses,
                    })
                plan_out.append({
                    "year": year_block.get("year"),
                    "terms": terms_out,
                })
            curricula_out.append({
                "slug": curriculum["slug"],
                "name": curriculum.get("name", curriculum["slug"]),
                "years": curriculum.get("years", len(plan_out)),
                "courseCount": course_count,
                "plan": plan_out,
            })

        # A major has exactly one curriculum in the current data; keep the first
        # as the primary curriculum but retain the list for forward-compat.
        primary = curricula_out[0] if curricula_out else None
        majors.append({
            "slug": major_slug,
            "name": major.get("name", major_slug),
            "description": major.get("description"),
            "requiredCourses": list(major.get("required_courses", []) or []),
            "curriculum": primary,
            "curricula": curricula_out,
        })

    for slug, major_set in plan_membership.items():
        if slug in courses:
            courses[slug]["sharedIn"] = sorted(major_set)
    for slug, major_set in required_membership.items():
        if slug in courses:
            courses[slug]["requiredBy"] = sorted(major_set)

    return majors


def _load_relevance_checker():
    """Return a function(blob) -> set[str] of relevant course slugs.

    Uses the crawler's boundary-aware classifier so the website only shows a
    syllabus under a course when that course actually matches the syllabus's
    title / filename / URL. This is a non-destructive safety net independent
    of the database contents.
    """
    try:
        from crawler.classify import resolve_syllabus_links
        from crawler.config import DEFAULT_COURSES_PATH, DEFAULT_TAXONOMY_PATH
        from crawler.taxonomy import load_merged_taxonomy
    except Exception as exc:  # pragma: no cover - optional dependency path
        print(f"NOTE: relevance filter disabled ({exc}).", file=sys.stderr)
        return None

    taxonomy = load_merged_taxonomy(
        taxonomy_path=DEFAULT_TAXONOMY_PATH, courses_path=DEFAULT_COURSES_PATH
    )

    def relevant_slugs(*, folder: str, title: str | None, filename: str, url: str | None) -> set[str]:
        links = resolve_syllabus_links(
            folder=folder, title=title, filename=filename, url=url, taxonomy=taxonomy
        )
        return {link.slug for link in links}

    return relevant_slugs


def attach_syllabi(courses: dict) -> tuple[int, int, int]:
    """Pull status='ok' syllabi from the DB, copy PDFs, attach metadata.

    Returns (syllabi_attached, pdfs_copied, links_filtered).
    """
    if not DB_PATH.exists():
        print(f"WARNING: {DB_PATH} not found; skipping syllabi.", file=sys.stderr)
        return (0, 0, 0)

    relevant_slugs = _load_relevance_checker()

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT c.slug        AS course_slug,
               s.id          AS syllabus_id,
               s.title       AS title,
               s.institution AS institution,
               s.term_label  AS term_label,
               s.source_url  AS source_url,
               s.file_path   AS file_path,
               sc.confidence AS confidence
          FROM syllabi s
          JOIN syllabus_courses sc ON sc.syllabus_id = s.id
          JOIN courses c           ON c.id = sc.course_id
         WHERE s.status = 'ok'
           AND s.file_path IS NOT NULL
         ORDER BY c.slug, s.institution, s.title
        """
    ).fetchall()
    conn.close()

    if PDF_OUT_DIR.exists():
        shutil.rmtree(PDF_OUT_DIR)
    PDF_OUT_DIR.mkdir(parents=True, exist_ok=True)

    attached = 0
    copied = 0
    filtered = 0
    seen_per_course: dict[str, set[str]] = defaultdict(set)
    relevance_cache: dict[int, set[str]] = {}

    for row in rows:
        course_slug = row["course_slug"]
        if course_slug not in courses:
            continue

        src = SYLABI_DIR / row["file_path"]
        if not src.exists():
            continue

        # Non-destructive relevance check: drop links where this course does
        # not actually match the syllabus title/filename/URL.
        if relevant_slugs is not None:
            sid = row["syllabus_id"]
            allowed = relevance_cache.get(sid)
            if allowed is None:
                file_path = row["file_path"] or ""
                filename = Path(file_path).name
                folder = Path(file_path).parent.name if file_path else ""
                if folder in (".", "_unclassified"):
                    folder = ""
                allowed = relevant_slugs(
                    folder=folder,
                    title=row["title"],
                    filename=filename,
                    url=row["source_url"],
                )
                relevance_cache[sid] = allowed
            if course_slug not in allowed:
                filtered += 1
                continue

        src_name = Path(row["file_path"]).name
        # Some PDFs come from URLs ending in "/syllabus/" and land on disk with an
        # empty stem (".pdf" or a deduped ".pdf_<hash>.pdf"). Those are hidden
        # dot-files that static hosts may not serve, so give them a real, servable
        # filename derived from the course.
        if Path(src_name).suffix == "" or src_name.startswith("."):
            src_name = f"{course_slug}-{row['syllabus_id']}.pdf"
        basename = safe_segment(src_name)
        # de-dupe identical filenames within a course folder
        if basename in seen_per_course[course_slug]:
            stem = Path(basename).stem
            suffix = Path(basename).suffix
            basename = f"{stem}_{row['syllabus_id']}{suffix}"
        seen_per_course[course_slug].add(basename)

        dest_dir = PDF_OUT_DIR / course_slug
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / basename
        if not dest.exists():
            shutil.copy2(src, dest)
            copied += 1

        web_path = f"/syllabi/{course_slug}/{basename}"
        stem_title = Path(src_name).stem.replace("_", " ").strip()
        title = (row["title"] or "").strip() or stem_title or f"{courses[course_slug]['name']} Syllabus"
        courses[course_slug]["syllabi"].append({
            "title": title,
            "institution": (row["institution"] or "").strip() or None,
            "term": (row["term_label"] or "").strip() or None,
            "file": web_path,
            "source": row["source_url"],
        })
        attached += 1

    return (attached, copied, filtered)


def main() -> None:
    courses_yaml = load_yaml(DATA_DIR / "courses.yaml")
    programs_yaml = load_yaml(DATA_DIR / "programs.yaml")

    courses = build_courses(courses_yaml)
    majors = build_majors(programs_yaml, courses)
    attached, copied, filtered = attach_syllabi(courses)

    catalog = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "majors": len(majors),
            "courses": len(courses),
            "syllabi": attached,
        },
        "majors": majors,
        "courses": courses,
    }

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    with JSON_OUT.open("w", encoding="utf-8") as fh:
        json.dump(catalog, fh, indent=2, ensure_ascii=False)

    print(f"Wrote {JSON_OUT.relative_to(REPO_ROOT)}")
    print(f"  majors:  {len(majors)}")
    print(f"  courses: {len(courses)}")
    print(f"  syllabi: {attached} (copied {copied} PDFs into "
          f"{PDF_OUT_DIR.relative_to(REPO_ROOT)})")
    print(f"  filtered out {filtered} irrelevant link(s) by relevance check")


if __name__ == "__main__":
    main()
