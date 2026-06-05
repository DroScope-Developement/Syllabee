from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from crawler.classify import classify_syllabus
from crawler.config import DEFAULT_COURSES_PATH, DEFAULT_OUTPUT_DIR, DEFAULT_TAXONOMY_PATH
from crawler.db.catalog import Catalog
from crawler.metadata import extract_pdf_metadata
from crawler.paths import course_storage_dir, unclassified_dir


def reorganize_sylabi(
    catalog: Catalog,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    *,
    taxonomy_path: Path = DEFAULT_TAXONOMY_PATH,
    courses_path: Path = DEFAULT_COURSES_PATH,
) -> tuple[int, int]:
    """
    Move loose PDFs into course folders and refresh DB paths/classification.
    Returns (moved, updated_db).
    """
    if not output_dir.is_dir():
        return 0, 0

    moved = 0
    updated = 0
    for pdf in list(output_dir.glob("*.pdf")):
        data = pdf.read_bytes()
        if not data.startswith(b"%PDF"):
            continue
        sha = hashlib.sha256(data).hexdigest()

        pdf_meta = extract_pdf_metadata(data)
        classification = classify_syllabus(
            url=f"file://{pdf.resolve()}",
            filename=pdf.name,
            pdf_title=pdf_meta.title,
            pdf_text_sample=pdf_meta.text_sample,
            taxonomy_path=taxonomy_path,
            courses_path=courses_path,
        )

        if classification.course_name:
            dest_dir = course_storage_dir(output_dir, classification.course_name)
        else:
            dest_dir = unclassified_dir(output_dir)

        dest = dest_dir / pdf.name
        if dest.resolve() != pdf.resolve():
            if dest.exists():
                stem, suffix = pdf.stem, pdf.suffix
                dest = dest_dir / f"{stem}_{sha[:8]}{suffix}"
            shutil.move(str(pdf), str(dest))
            moved += 1

        rel = str(dest.relative_to(output_dir))
        course_id = None
        if classification.course_slug:
            row = catalog.get_course_by_slug(classification.course_slug)
            if row:
                course_id = int(row["id"])

        if catalog.has_syllabus_hash(sha):
            catalog.update_syllabus_file(
                sha,
                file_path=rel,
                course_id=course_id,
                source_url=f"file://{dest.resolve()}",
            )
        else:
            catalog.upsert_syllabus(
                source_url=f"file://{dest.resolve()}",
                status="ok",
                file_path=rel,
                sha256=sha,
                file_size=len(data),
                course_id=course_id,
                title=classification.title or pdf_meta.title,
                discovery_source="reorganize",
            )
        updated += 1

    return moved, updated
