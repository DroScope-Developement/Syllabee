from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@dataclass
class SyllabusRow:
    id: int
    source_url: str
    file_path: str | None
    sha256: str | None
    status: str
    course_id: int | None
    title: str | None
    term_label: str | None
    release_date: str | None


class Catalog:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._init_schema()

    def _init_schema(self) -> None:
        sql = _SCHEMA_PATH.read_text(encoding="utf-8")
        self._conn.executescript(sql)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> Catalog:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    # --- crawl sessions & domains ---

    def start_crawl_session(
        self, *, queries: list[str] | None = None, seeds: list[str] | None = None
    ) -> int:
        cur = self._conn.execute(
            """
            INSERT INTO crawl_sessions (started_at, queries_json, seeds_json)
            VALUES (?, ?, ?)
            """,
            (
                _utc_now(),
                json.dumps(queries or []),
                json.dumps(seeds or []),
            ),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def finish_crawl_session(self, session_id: int, *, notes: str | None = None) -> None:
        self._conn.execute(
            "UPDATE crawl_sessions SET finished_at = ?, notes = ? WHERE id = ?",
            (_utc_now(), notes, session_id),
        )
        self._conn.commit()

    def touch_domain(
        self,
        domain: str,
        *,
        pages_delta: int = 0,
        pdfs_found_delta: int = 0,
        pdfs_downloaded_delta: int = 0,
    ) -> None:
        now = _utc_now()
        row = self._conn.execute(
            "SELECT id FROM crawled_domains WHERE domain = ?", (domain,)
        ).fetchone()
        if row:
            self._conn.execute(
                """
                UPDATE crawled_domains
                SET last_crawled_at = ?,
                    pages_fetched = pages_fetched + ?,
                    pdfs_discovered = pdfs_discovered + ?,
                    pdfs_downloaded = pdfs_downloaded + ?
                WHERE domain = ?
                """,
                (now, pages_delta, pdfs_found_delta, pdfs_downloaded_delta, domain),
            )
        else:
            self._conn.execute(
                """
                INSERT INTO crawled_domains (
                    domain, first_crawled_at, last_crawled_at,
                    pages_fetched, pdfs_discovered, pdfs_downloaded
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (domain, now, now, pages_delta, pdfs_found_delta, pdfs_downloaded_delta),
            )
        self._conn.commit()

    # --- courses ---

    def upsert_course(
        self,
        slug: str,
        name: str,
        *,
        course_code: str | None = None,
        category: str | None = None,
        description: str | None = None,
    ) -> int:
        self._conn.execute(
            """
            INSERT INTO courses (slug, name, course_code, category, description)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                course_code = COALESCE(excluded.course_code, courses.course_code),
                category = COALESCE(excluded.category, courses.category),
                description = COALESCE(excluded.description, courses.description)
            """,
            (slug, name, course_code, category, description),
        )
        self._conn.commit()
        row = self._conn.execute("SELECT id FROM courses WHERE slug = ?", (slug,)).fetchone()
        return int(row["id"])

    def get_course_by_slug(self, slug: str) -> sqlite3.Row | None:
        return self._conn.execute("SELECT * FROM courses WHERE slug = ?", (slug,)).fetchone()

    def count_ok_syllabi_for_course(self, course_id: int) -> int:
        row = self._conn.execute(
            """
            SELECT COUNT(DISTINCT s.id)
            FROM syllabi s
            LEFT JOIN syllabus_courses sc ON sc.syllabus_id = s.id
            WHERE s.status = 'ok'
              AND (s.course_id = ? OR sc.course_id = ?)
            """,
            (course_id, course_id),
        ).fetchone()
        return int(row[0]) if row else 0

    def count_ok_syllabi_unclassified(self) -> int:
        row = self._conn.execute(
            """
            SELECT COUNT(*) FROM syllabi s
            WHERE s.status = 'ok'
              AND s.course_id IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM syllabus_courses sc WHERE sc.syllabus_id = s.id
              )
            """
        ).fetchone()
        return int(row[0]) if row else 0

    def count_ok_syllabi_for_course_slug(self, course_slug: str | None) -> int:
        if not course_slug:
            return self.count_ok_syllabi_unclassified()
        row = self.get_course_by_slug(course_slug)
        if not row:
            return 0
        return self.count_ok_syllabi_for_course(int(row["id"]))

    def list_courses(self) -> list[sqlite3.Row]:
        return list(self._conn.execute("SELECT * FROM courses ORDER BY name").fetchall())

    # --- majors & curricula ---

    def upsert_major(self, slug: str, name: str, *, description: str | None = None) -> int:
        self._conn.execute(
            """
            INSERT INTO majors (slug, name, description)
            VALUES (?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                description = COALESCE(excluded.description, majors.description)
            """,
            (slug, name, description),
        )
        self._conn.commit()
        row = self._conn.execute("SELECT id FROM majors WHERE slug = ?", (slug,)).fetchone()
        return int(row["id"])

    def upsert_curriculum(
        self,
        slug: str,
        major_id: int,
        name: str,
        *,
        total_years: int = 4,
        description: str | None = None,
    ) -> int:
        self._conn.execute(
            """
            INSERT INTO curricula (slug, major_id, name, total_years, description)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                total_years = excluded.total_years,
                description = COALESCE(excluded.description, curricula.description)
            """,
            (slug, major_id, name, total_years, description),
        )
        self._conn.commit()
        row = self._conn.execute("SELECT id FROM curricula WHERE slug = ?", (slug,)).fetchone()
        return int(row["id"])

    def add_curriculum_term(
        self,
        curriculum_id: int,
        *,
        year_number: int,
        term_name: str,
        term_order: int,
    ) -> int:
        self._conn.execute(
            """
            INSERT INTO curriculum_terms (curriculum_id, year_number, term_name, term_order)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(curriculum_id, year_number, term_name) DO UPDATE SET
                term_order = excluded.term_order
            """,
            (curriculum_id, year_number, term_name, term_order),
        )
        self._conn.commit()
        row = self._conn.execute(
            """
            SELECT id FROM curriculum_terms
            WHERE curriculum_id = ? AND year_number = ? AND term_name = ?
            """,
            (curriculum_id, year_number, term_name),
        ).fetchone()
        return int(row["id"])

    def add_curriculum_course(
        self,
        curriculum_term_id: int,
        course_id: int,
        *,
        credits: float | None = None,
        sort_order: int = 0,
        is_required: bool = True,
    ) -> None:
        self._conn.execute(
            """
            INSERT INTO curriculum_courses (
                curriculum_term_id, course_id, is_required, credits, sort_order
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(curriculum_term_id, course_id) DO UPDATE SET
                credits = COALESCE(excluded.credits, curriculum_courses.credits),
                sort_order = excluded.sort_order
            """,
            (curriculum_term_id, course_id, int(is_required), credits, sort_order),
        )
        self._conn.commit()

    def link_major_course(self, major_id: int, course_id: int, *, is_core: bool = True) -> None:
        self._conn.execute(
            """
            INSERT INTO major_courses (major_id, course_id, is_core)
            VALUES (?, ?, ?)
            ON CONFLICT(major_id, course_id) DO UPDATE SET is_core = excluded.is_core
            """,
            (major_id, course_id, int(is_core)),
        )
        self._conn.commit()

    def shared_courses_between_majors(self, slug_a: str, slug_b: str) -> list[sqlite3.Row]:
        return list(
            self._conn.execute(
                """
                SELECT c.slug, c.name, c.course_code
                FROM courses c
                JOIN major_courses mc1 ON mc1.course_id = c.id
                JOIN majors m1 ON m1.id = mc1.major_id AND m1.slug = ?
                JOIN major_courses mc2 ON mc2.course_id = c.id
                JOIN majors m2 ON m2.id = mc2.major_id AND m2.slug = ?
                ORDER BY c.name
                """,
                (slug_a, slug_b),
            ).fetchall()
        )

    # --- syllabi ---

    def has_syllabus_url(self, url: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM syllabi WHERE source_url = ? AND status = 'ok'", (url,)
        ).fetchone()
        return row is not None

    def has_attempted_url(self, url: str, *, retry_failed: bool = True) -> bool:
        """True if we already tried this URL (skip re-download). Failed URLs may retry."""
        row = self._conn.execute(
            "SELECT status FROM syllabi WHERE source_url = ?", (url,)
        ).fetchone()
        if row is None:
            return False
        if row["status"] == "failed" and retry_failed:
            return False
        return True

    def coverage_report(self, max_per_course: int) -> list[sqlite3.Row]:
        return list(
            self._conn.execute(
                """
                SELECT c.slug, c.name, c.course_code,
                       COUNT(s.id) AS have,
                       MAX(0, ? - COUNT(s.id)) AS need
                FROM courses c
                LEFT JOIN syllabi s ON s.course_id = c.id AND s.status = 'ok'
                GROUP BY c.id
                ORDER BY have ASC, c.name
                """,
                (max_per_course,),
            ).fetchall()
        )

    def has_syllabus_hash(self, sha256: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM syllabi WHERE sha256 = ? AND status = 'ok'", (sha256,)
        ).fetchone()
        return row is not None

    def update_syllabus_file(
        self,
        sha256: str,
        *,
        file_path: str,
        course_id: int | None,
        source_url: str | None = None,
    ) -> None:
        self._conn.execute(
            """
            UPDATE syllabi
            SET file_path = ?, course_id = ?,
                source_url = COALESCE(?, source_url),
                updated_at = datetime('now')
            WHERE sha256 = ?
            """,
            (file_path, course_id, source_url, sha256),
        )
        self._conn.commit()

    def upsert_syllabus(
        self,
        *,
        source_url: str,
        status: str,
        file_path: str | None = None,
        sha256: str | None = None,
        file_size: int | None = None,
        course_id: int | None = None,
        title: str | None = None,
        institution: str | None = None,
        term_label: str | None = None,
        release_date: str | None = None,
        discovery_source: str | None = None,
        referrer_url: str | None = None,
        crawl_session_id: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        now = _utc_now()
        meta_json = json.dumps(metadata) if metadata else None
        downloaded_at = now if status == "ok" else None

        self._conn.execute(
            """
            INSERT INTO syllabi (
                source_url, file_path, sha256, file_size, status, course_id,
                title, institution, term_label, release_date, downloaded_at,
                discovery_source, referrer_url, crawl_session_id, metadata_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(source_url) DO UPDATE SET
                file_path = COALESCE(excluded.file_path, syllabi.file_path),
                sha256 = COALESCE(excluded.sha256, syllabi.sha256),
                file_size = COALESCE(excluded.file_size, syllabi.file_size),
                status = excluded.status,
                course_id = COALESCE(excluded.course_id, syllabi.course_id),
                title = COALESCE(excluded.title, syllabi.title),
                institution = COALESCE(excluded.institution, syllabi.institution),
                term_label = COALESCE(excluded.term_label, syllabi.term_label),
                release_date = COALESCE(excluded.release_date, syllabi.release_date),
                downloaded_at = COALESCE(excluded.downloaded_at, syllabi.downloaded_at),
                discovery_source = COALESCE(excluded.discovery_source, syllabi.discovery_source),
                referrer_url = COALESCE(excluded.referrer_url, syllabi.referrer_url),
                crawl_session_id = COALESCE(excluded.crawl_session_id, syllabi.crawl_session_id),
                metadata_json = COALESCE(excluded.metadata_json, syllabi.metadata_json),
                updated_at = excluded.updated_at
            """,
            (
                source_url,
                file_path,
                sha256,
                file_size,
                status,
                course_id,
                title,
                institution,
                term_label,
                release_date,
                downloaded_at,
                discovery_source,
                referrer_url,
                crawl_session_id,
                meta_json,
                now,
                now,
            ),
        )
        self._conn.commit()
        row = self._conn.execute(
            "SELECT id FROM syllabi WHERE source_url = ?", (source_url,)
        ).fetchone()
        return int(row["id"])

    def link_syllabus_courses(
        self,
        syllabus_id: int,
        course_ids: list[int],
        *,
        confidence: float = 1.0,
        match_reason: str | None = None,
    ) -> None:
        for cid in course_ids:
            self._conn.execute(
                """
                INSERT INTO syllabus_courses (syllabus_id, course_id, confidence, match_reason)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(syllabus_id, course_id) DO UPDATE SET
                    confidence = excluded.confidence,
                    match_reason = COALESCE(excluded.match_reason, syllabus_courses.match_reason)
                """,
                (syllabus_id, cid, confidence, match_reason),
            )
        self._conn.commit()

    def list_syllabi(self, *, course_slug: str | None = None) -> list[sqlite3.Row]:
        if course_slug:
            return list(
                self._conn.execute(
                    """
                    SELECT s.*, c.name AS course_name, c.slug AS course_slug
                    FROM syllabi s
                    LEFT JOIN courses c ON c.id = s.course_id
                    LEFT JOIN syllabus_courses sc ON sc.syllabus_id = s.id
                    LEFT JOIN courses c2 ON c2.id = sc.course_id
                    WHERE c.slug = ? OR c2.slug = ?
                    ORDER BY s.downloaded_at DESC
                    """,
                    (course_slug, course_slug),
                ).fetchall()
            )
        return list(
            self._conn.execute(
                """
                SELECT s.*, c.name AS course_name, c.slug AS course_slug
                FROM syllabi s
                LEFT JOIN courses c ON c.id = s.course_id
                ORDER BY s.downloaded_at DESC
                """
            ).fetchall()
        )

    def list_domains(self) -> list[sqlite3.Row]:
        return list(
            self._conn.execute(
                "SELECT * FROM crawled_domains ORDER BY last_crawled_at DESC"
            ).fetchall()
        )

    def get_curriculum_tree(self, curriculum_slug: str) -> list[sqlite3.Row]:
        return list(
            self._conn.execute(
                """
                SELECT
                    cu.slug AS curriculum_slug,
                    cu.name AS curriculum_name,
                    m.slug AS major_slug,
                    m.name AS major_name,
                    ct.year_number,
                    ct.term_name,
                    ct.term_order,
                    co.slug AS course_slug,
                    co.name AS course_name,
                    co.course_code,
                    cc.credits,
                    cc.is_required
                FROM curricula cu
                JOIN majors m ON m.id = cu.major_id
                JOIN curriculum_terms ct ON ct.curriculum_id = cu.id
                JOIN curriculum_courses cc ON cc.curriculum_term_id = ct.id
                JOIN courses co ON co.id = cc.course_id
                WHERE cu.slug = ?
                ORDER BY ct.term_order, cc.sort_order, co.name
                """,
                (curriculum_slug,),
            ).fetchall()
        )

    def list_curricula(self) -> list[sqlite3.Row]:
        return list(
            self._conn.execute(
                """
                SELECT cu.slug, cu.name, m.slug AS major_slug, m.name AS major_name,
                       cu.total_years
                FROM curricula cu
                JOIN majors m ON m.id = cu.major_id
                ORDER BY m.name, cu.slug
                """
            ).fetchall()
        )

    def list_majors_with_curricula(self) -> list[sqlite3.Row]:
        return list(
            self._conn.execute(
                """
                SELECT m.slug, m.name, c.slug AS curriculum_slug, c.name AS curriculum_name
                FROM majors m
                LEFT JOIN curricula c ON c.major_id = m.id
                ORDER BY m.name, c.slug
                """
            ).fetchall()
        )

    def stats(self) -> dict[str, int]:
        def count(sql: str) -> int:
            row = self._conn.execute(sql).fetchone()
            return int(row[0]) if row else 0

        return {
            "courses": count("SELECT COUNT(*) FROM courses"),
            "majors": count("SELECT COUNT(*) FROM majors"),
            "curricula": count("SELECT COUNT(*) FROM curricula"),
            "syllabi_ok": count("SELECT COUNT(*) FROM syllabi WHERE status = 'ok'"),
            "syllabi_total": count("SELECT COUNT(*) FROM syllabi"),
            "domains": count("SELECT COUNT(*) FROM crawled_domains"),
        }
