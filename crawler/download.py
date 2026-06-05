from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

from crawler.classify import ClassificationResult, classify_syllabus
from crawler.config import (
    DEFAULT_COURSES_PATH,
    DEFAULT_MAX_PER_COURSE,
    DEFAULT_MAX_UNCLASSIFIED,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_REQUEST_DELAY_SEC,
    DEFAULT_TAXONOMY_PATH,
    DEFAULT_TIMEOUT_SEC,
    USER_AGENT,
)
from crawler.db.catalog import Catalog
from crawler.html_pdf import html_to_pdf_bytes
from crawler.metadata import extract_pdf_metadata
from crawler.models import PdfCandidate
from crawler.paths import course_storage_dir, unclassified_dir
from crawler.log import vprint
from crawler.robots import RobotsCache

_PDF_MAGIC = b"%PDF"


@dataclass
class DownloadResult:
    url: str
    status: str
    file_path: str | None = None
    course_name: str | None = None
    reason: str | None = None


def _safe_filename(name: str, max_len: int = 120) -> str:
    name = unquote(name)
    name = re.sub(r"[^\w.\-]+", "_", name, flags=re.UNICODE).strip("._")
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    if len(name) > max_len:
        stem, dot, ext = name.rpartition(".")
        name = stem[: max_len - len(ext) - 1] + dot + ext
    return name or "syllabus.pdf"


def _filename_from_url(url: str) -> str:
    path = urlparse(url).path
    base = path.rsplit("/", 1)[-1] if path else "syllabus.pdf"
    return _safe_filename(base)


def _filename_from_headers(url: str, headers: httpx.Headers) -> str:
    cd = headers.get("content-disposition", "")
    match = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";\n]+)"?', cd, re.I)
    if match:
        return _safe_filename(match.group(1))
    return _filename_from_url(url)


def _unique_path(directory: Path, filename: str, url_hash: str) -> Path:
    candidate = directory / filename
    if not candidate.exists():
        return candidate
    stem = Path(filename).stem
    suffix = Path(filename).suffix or ".pdf"
    return directory / f"{stem}_{url_hash[:8]}{suffix}"


def _domain_from_url(url: str) -> str:
    return urlparse(url).netloc.lower()


class SyllabusDownloader:
    def __init__(
        self,
        catalog: Catalog,
        output_dir: Path = DEFAULT_OUTPUT_DIR,
        *,
        taxonomy_path: Path = DEFAULT_TAXONOMY_PATH,
        courses_path: Path = DEFAULT_COURSES_PATH,
        user_agent: str = USER_AGENT,
        delay_sec: float = DEFAULT_REQUEST_DELAY_SEC,
        timeout_sec: float = DEFAULT_TIMEOUT_SEC,
        respect_robots: bool = True,
        crawl_session_id: int | None = None,
        max_per_course: int | None = DEFAULT_MAX_PER_COURSE,
        max_unclassified: int | None = DEFAULT_MAX_UNCLASSIFIED,
        verbose: bool = True,
    ) -> None:
        self.catalog = catalog
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.taxonomy_path = taxonomy_path
        self.courses_path = courses_path
        self.delay_sec = delay_sec
        self.respect_robots = respect_robots
        self.crawl_session_id = crawl_session_id
        self.max_per_course = max_per_course
        self.max_unclassified = max_unclassified
        self.verbose = verbose
        self._session_ok_by_course: dict[str, int] = {}
        self.robots = RobotsCache(user_agent)

        self.client = httpx.Client(
            headers={"User-Agent": user_agent, "Accept": "application/pdf,*/*"},
            timeout=timeout_sec,
            follow_redirects=True,
        )

    def close(self) -> None:
        self.client.close()

    def download_candidate(self, candidate: PdfCandidate) -> DownloadResult:
        url = candidate.url
        domain = _domain_from_url(url)
        self.catalog.touch_domain(domain, pdfs_found_delta=1)
        target_id = candidate.target_course_id
        queue_id = candidate.queue_id
        target_course = None
        if target_id is not None:
            target_course = self.catalog.get_course_by_id(target_id)

        if target_id is None:
            if self.catalog.has_syllabus_url(url):
                self._log_result(url, "skipped", "already saved")
                return DownloadResult(url, "skipped", reason="duplicate_url")
            if self.catalog.has_attempted_url(url):
                self._log_result(url, "skipped", "already attempted")
                return DownloadResult(url, "skipped", reason="already_attempted")
        elif self.catalog.has_syllabus_url(url):
            return self._fulfill_queue_from_ok(url, candidate, target_id, queue_id)

        if self.respect_robots and not self.robots.allowed(url):
            self._record_skip(url, candidate, reason="robots_txt")
            self._mark_queue(queue_id, "skipped", "robots_txt")
            self._log_result(url, "skipped", "robots.txt")
            return DownloadResult(url, "skipped", reason="robots_txt")

        preview = classify_syllabus(
            url=url,
            filename=_filename_from_url(url),
            link_text=candidate.link_text,
            taxonomy_path=self.taxonomy_path,
            courses_path=self.courses_path,
        )

        if target_id is not None:
            if self._at_target_cap(target_id):
                self._mark_queue(queue_id, "skipped", "course_full")
                self._log_result(url, "skipped", "target course full")
                return DownloadResult(url, "skipped", reason="course_cap")
        elif self._at_course_cap(preview.course_slug):
            self._record_skip(url, candidate, reason="course_cap")
            label = preview.course_name or "_unclassified"
            self._log_result(url, "skipped", f"cap reached for {label}")
            return DownloadResult(url, "skipped", reason=f"course_cap:{label}")

        if self.verbose:
            if target_course:
                label = target_course["name"]
            else:
                label = preview.course_name or "unclassified"
            vprint(f"  GET [{label}] {url}", verbose=True)

        time.sleep(self.delay_sec)

        try:
            if candidate.content_type == "html":
                resp = self.client.get(url, follow_redirects=True)
                resp.raise_for_status()
                headers = httpx.Headers({"content-type": "text/html"})
                data = html_to_pdf_bytes(
                    resp.text,
                    title=candidate.link_text,
                )
            else:
                with self.client.stream("GET", url) as resp:
                    resp.raise_for_status()
                    headers = resp.headers
                    data = resp.read()
        except Exception:
            self.catalog.upsert_syllabus(
                source_url=url,
                status="failed",
                discovery_source=candidate.discovery_source,
                referrer_url=candidate.referrer_url,
                crawl_session_id=self.crawl_session_id,
            )
            self._mark_queue(queue_id, "failed", "http_error", increment_attempt=True)
            self._log_result(url, "failed", "HTTP error")
            return DownloadResult(url, "failed")

        if not data.startswith(_PDF_MAGIC):
            if data[:15].lower().startswith(b"<!doctype") or data[:6].lower() == b"<html":
                self.catalog.upsert_syllabus(
                    source_url=url,
                    status="failed",
                    discovery_source=candidate.discovery_source,
                    referrer_url=candidate.referrer_url,
                    crawl_session_id=self.crawl_session_id,
                )
                self._mark_queue(queue_id, "failed", "not_pdf", increment_attempt=True)
                self._log_result(url, "failed", "not a PDF")
                return DownloadResult(url, "failed", reason="not_pdf")

        sha = hashlib.sha256(data).hexdigest()
        if self.catalog.has_syllabus_hash(sha):
            self.catalog.upsert_syllabus(
                source_url=url,
                status="skipped",
                sha256=sha,
                file_size=len(data),
                discovery_source=candidate.discovery_source,
                referrer_url=candidate.referrer_url,
                crawl_session_id=self.crawl_session_id,
            )
            self._mark_queue(queue_id, "skipped", "duplicate_hash")
            self._log_result(url, "skipped", "duplicate file hash")
            return DownloadResult(url, "skipped", reason="duplicate_hash")

        filename = _filename_from_headers(url, headers)
        if candidate.content_type == "html" and not filename.lower().endswith(".pdf"):
            stem = Path(filename).stem or "syllabus"
            filename = _safe_filename(f"{stem}.pdf")
        pdf_meta = extract_pdf_metadata(data)
        classification = classify_syllabus(
            url=url,
            filename=filename,
            pdf_title=pdf_meta.title,
            pdf_text_sample=pdf_meta.text_sample,
            link_text=candidate.link_text,
            taxonomy_path=self.taxonomy_path,
            courses_path=self.courses_path,
        )

        if target_course:
            storage_dir = course_storage_dir(self.output_dir, target_course["name"])
        else:
            storage_dir = self._resolve_storage_dir(classification)
        storage_dir.mkdir(parents=True, exist_ok=True)
        path = _unique_path(storage_dir, filename, sha)
        path.write_bytes(data)

        rel_path = str(path.relative_to(self.output_dir))
        course_ids = self._resolve_course_ids(classification)
        if target_id is not None and target_id not in course_ids:
            course_ids = [target_id, *course_ids]
        elif target_id is not None:
            course_ids = [target_id] + [c for c in course_ids if c != target_id]
        primary_course_id = course_ids[0] if course_ids else None

        release_date = pdf_meta.release_date
        term_label = classification.term_label or extract_term_from_classification(
            classification, pdf_meta.text_sample
        )

        syllabus_id = self.catalog.upsert_syllabus(
            source_url=url,
            status="ok",
            file_path=rel_path,
            sha256=sha,
            file_size=len(data),
            course_id=primary_course_id,
            title=classification.title or pdf_meta.title,
            institution=classification.institution,
            term_label=term_label,
            release_date=release_date,
            discovery_source=candidate.discovery_source,
            referrer_url=candidate.referrer_url,
            crawl_session_id=self.crawl_session_id,
            metadata={
                "author": pdf_meta.author,
                "classification": {
                    "confidence": classification.confidence,
                    "match_reason": classification.match_reason,
                },
            },
        )

        if course_ids:
            conf_by_slug = {
                link.slug: (link.confidence, link.reason)
                for link in classification.course_links
            }
            links: list[tuple[int, float, str | None]] = []
            for cid in course_ids:
                row = self.catalog.get_course_by_id(cid)
                slug = row["slug"] if row else None
                conf, reason = conf_by_slug.get(
                    slug, (classification.confidence, classification.match_reason)
                )
                if cid == target_id and slug not in conf_by_slug:
                    conf, reason = 1.0, "target"
                links.append((cid, conf, reason))
            self.catalog.set_syllabus_course_links(syllabus_id, links)

        self.catalog.touch_domain(domain, pdfs_downloaded_delta=1)
        if target_id is not None:
            if target_course:
                self._record_session_ok(target_course["slug"])
            self._mark_queue(queue_id, "fulfilled", syllabus_id=syllabus_id)
            course_name = target_course["name"] if target_course else "course"
        else:
            self._record_session_ok(classification.course_slug)
            course_name = classification.course_name or "_unclassified"
        self._log_result(url, "saved", f"{course_name} -> {rel_path}")
        return DownloadResult(url, "ok", file_path=rel_path, course_name=course_name)

    def _log_result(self, url: str, status: str, detail: str) -> None:
        if not self.verbose:
            return
        short = url if len(url) <= 70 else url[:67] + "..."
        vprint(f"       {status}: {detail}  ({short})", verbose=True)

    def _at_target_cap(self, course_id: int) -> bool:
        if self.max_per_course is None:
            return False
        return (
            self.catalog.count_ok_syllabi_for_course(course_id) >= self.max_per_course
        )

    def _mark_queue(
        self,
        queue_id: int | None,
        status: str,
        reason: str | None = None,
        *,
        syllabus_id: int | None = None,
        increment_attempt: bool = False,
    ) -> None:
        if queue_id is None:
            return
        self.catalog.update_candidate(
            queue_id,
            status=status,
            skip_reason=reason,
            syllabus_id=syllabus_id,
            increment_attempt=increment_attempt,
        )

    def _fulfill_queue_from_ok(
        self,
        url: str,
        candidate: PdfCandidate,
        target_id: int,
        queue_id: int | None,
    ) -> DownloadResult:
        row = self.catalog.get_syllabus_row_by_url(url)
        if not row:
            return DownloadResult(url, "skipped", reason="duplicate_url")
        syllabus_id = int(row["id"])
        self.catalog.link_syllabus_courses(
            syllabus_id, [target_id], match_reason="existing_ok"
        )
        self._mark_queue(queue_id, "fulfilled", syllabus_id=syllabus_id)
        course = self.catalog.get_course_by_id(target_id)
        name = course["name"] if course else "course"
        self._log_result(url, "skipped", f"already OK, linked to {name}")
        return DownloadResult(url, "ok", course_name=name)

    def _cap_key(self, course_slug: str | None) -> str:
        return course_slug if course_slug else "__unclassified__"

    def _at_course_cap(self, course_slug: str | None) -> bool:
        key = self._cap_key(course_slug)
        in_db = self.catalog.count_ok_syllabi_for_course_slug(course_slug)
        in_session = self._session_ok_by_course.get(key, 0)
        have = in_db + in_session
        if not course_slug:
            limit = self.max_unclassified
        else:
            limit = self.max_per_course
        if limit is None:
            return False
        return have >= limit

    def _record_session_ok(self, course_slug: str | None) -> None:
        key = self._cap_key(course_slug)
        self._session_ok_by_course[key] = self._session_ok_by_course.get(key, 0) + 1

    def _resolve_storage_dir(self, classification: ClassificationResult) -> Path:
        if classification.course_name:
            return course_storage_dir(self.output_dir, classification.course_name)
        return unclassified_dir(self.output_dir)

    def _resolve_course_ids(self, classification: ClassificationResult) -> list[int]:
        ids: list[int] = []
        slugs = []
        if classification.course_slug:
            slugs.append(classification.course_slug)
        slugs.extend(classification.extra_course_slugs)
        for slug in dict.fromkeys(slugs):
            row = self.catalog.get_course_by_slug(slug)
            if row:
                ids.append(int(row["id"]))
        return ids

    def _record_skip(self, url: str, candidate: PdfCandidate, *, reason: str) -> None:
        self.catalog.upsert_syllabus(
            source_url=url,
            status="skipped",
            discovery_source=f"{candidate.discovery_source}:{reason}",
            referrer_url=candidate.referrer_url,
            crawl_session_id=self.crawl_session_id,
        )


def extract_term_from_classification(
    classification: ClassificationResult, text: str | None
) -> str | None:
    if classification.term_label:
        return classification.term_label
    if not text:
        return None
    from crawler.classify import extract_term_label

    return extract_term_label(text.lower())
