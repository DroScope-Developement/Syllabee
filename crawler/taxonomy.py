from __future__ import annotations

import re
from pathlib import Path

import yaml

from crawler.config import DEFAULT_COURSES_PATH, DEFAULT_TAXONOMY_PATH


def _auto_keywords(slug: str, name: str, course_code: str | None) -> list[str]:
    keywords = [
        name.lower(),
        slug.replace("-", " "),
        slug.replace("-", ""),
    ]
    if course_code:
        code = course_code.strip()
        keywords.append(code.lower())
        keywords.append(code.replace(" ", "").lower())
        keywords.append(code.replace(" ", "_").lower())
        # MATH 141 -> math141, math-141
        parts = code.split()
        if len(parts) == 2:
            keywords.append(f"{parts[0].lower()}{parts[1]}")
            keywords.append(f"{parts[0].lower()}-{parts[1]}")
    return list(dict.fromkeys(k for k in keywords if k))


def load_merged_taxonomy(
    *,
    taxonomy_path: Path = DEFAULT_TAXONOMY_PATH,
    courses_path: Path = DEFAULT_COURSES_PATH,
) -> list[dict]:
    """All catalog courses + extra keyword overrides from taxonomy.yaml."""
    by_slug: dict[str, dict] = {}

    if courses_path.is_file():
        data = yaml.safe_load(courses_path.read_text(encoding="utf-8")) or {}
        for row in data.get("courses", []):
            slug = row["slug"]
            code = row.get("code")
            by_slug[slug] = {
                "slug": slug,
                "name": row["name"],
                "codes": [code] if code else [],
                "keywords": _auto_keywords(slug, row["name"], code),
            }

    if taxonomy_path.is_file():
        data = yaml.safe_load(taxonomy_path.read_text(encoding="utf-8")) or {}
        for row in data.get("courses", []):
            slug = row["slug"]
            if slug not in by_slug:
                by_slug[slug] = {
                    "slug": slug,
                    "name": row["name"],
                    "codes": list(row.get("codes") or []),
                    "keywords": list(row.get("keywords") or []),
                }
            else:
                entry = by_slug[slug]
                for code in row.get("codes") or []:
                    if code not in entry["codes"]:
                        entry["codes"].append(code)
                for kw in row.get("keywords") or []:
                    if kw.lower() not in {k.lower() for k in entry["keywords"]}:
                        entry["keywords"].append(kw)

    return list(by_slug.values())
