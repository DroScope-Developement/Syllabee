from __future__ import annotations

from pathlib import Path

import yaml

from crawler.db.catalog import Catalog


def load_seed_data(catalog: Catalog, data_dir: Path) -> None:
    """Load courses, majors, curricula, and major-course links from data/*.yaml."""
    courses_path = data_dir / "courses.yaml"
    programs_path = data_dir / "programs.yaml"

    if courses_path.is_file():
        _load_courses(catalog, courses_path)

    if programs_path.is_file():
        _load_programs(catalog, programs_path)


def _load_courses(catalog: Catalog, path: Path) -> None:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    for row in data.get("courses", []):
        catalog.upsert_course(
            row["slug"],
            row["name"],
            course_code=row.get("code"),
            category=row.get("category"),
            description=row.get("description"),
        )


def _load_programs(catalog: Catalog, path: Path) -> None:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    for major in data.get("majors", []):
        major_id = catalog.upsert_major(
            major["slug"],
            major["name"],
            description=major.get("description"),
        )
        for course_slug in major.get("required_courses", []):
            course = catalog.get_course_by_slug(course_slug)
            if course:
                catalog.link_major_course(major_id, int(course["id"]))

        for curr in major.get("curricula", []):
            curr_id = catalog.upsert_curriculum(
                curr["slug"],
                major_id,
                curr["name"],
                total_years=curr.get("years", 4),
                description=curr.get("description"),
            )
            term_order = 0
            for year_block in curr.get("plan", []):
                year_num = year_block["year"]
                for term in year_block.get("terms", []):
                    term_order += 1
                    term_id = catalog.add_curriculum_term(
                        curr_id,
                        year_number=year_num,
                        term_name=term["name"],
                        term_order=term_order,
                    )
                    for idx, course_slug in enumerate(term.get("courses", [])):
                        course = catalog.get_course_by_slug(course_slug)
                        if not course:
                            continue
                        catalog.add_curriculum_course(
                            term_id,
                            int(course["id"]),
                            credits=term.get("credits"),
                            sort_order=idx,
                        )
