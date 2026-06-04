from __future__ import annotations

import hashlib
from pathlib import Path

from crawler.classify import classify_syllabus
from crawler.config import DEFAULT_TAXONOMY_PATH
from crawler.db.catalog import Catalog
from crawler.paths import course_storage_dir, unclassified_dir


def import_existing_pdfs(
    catalog: Catalog,
    output_dir: Path,
    *,
    taxonomy_path: Path = DEFAULT_TAXONOMY_PATH,
) -> tuple[int, int]:
    """Import PDFs already on disk into the catalog (flat or subject folders)."""
    if not output_dir.is_dir():
        return 0, 0

    imported = 0
    skipped = 0
    for pdf in output_dir.rglob("*.pdf"):
        if pdf.name.startswith("."):
            continue
        data = pdf.read_bytes()
        if not data.startswith(b"%PDF"):
            continue
        sha = hashlib.sha256(data).hexdigest()
        if catalog.has_syllabus_hash(sha):
            skipped += 1
            continue

        rel = str(pdf.relative_to(output_dir))
        parent_name = pdf.parent.name
        if parent_name.startswith("_") or pdf.parent == output_dir:
            parent_name = None

        classification = classify_syllabus(
            url=f"file://{pdf.resolve()}",
            filename=pdf.name,
            taxonomy_path=taxonomy_path,
        )
        if parent_name and parent_name != "_unclassified":
            classification.course_name = parent_name

        course_ids: list[int] = []
        if classification.course_slug:
            row = catalog.get_course_by_slug(classification.course_slug)
            if row:
                course_ids.append(int(row["id"]))
        primary = course_ids[0] if course_ids else None

        sid = catalog.upsert_syllabus(
            source_url=f"file://{pdf.resolve()}",
            status="ok",
            file_path=rel,
            sha256=sha,
            file_size=len(data),
            course_id=primary,
            title=classification.title,
            discovery_source="import",
        )
        if course_ids:
            catalog.link_syllabus_courses(sid, course_ids)
        imported += 1

    return imported, skipped
