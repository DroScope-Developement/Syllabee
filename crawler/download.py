from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

from crawler.config import (
    DEFAULT_MANIFEST,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_REQUEST_DELAY_SEC,
    DEFAULT_TIMEOUT_SEC,
    USER_AGENT,
)
from crawler.robots import RobotsCache

_PDF_MAGIC = b"%PDF"


@dataclass
class DownloadRecord:
    url: str
    filename: str
    sha256: str
    bytes: int
    source: str
    status: str  # ok | skipped | failed


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


class SyllabusDownloader:
    def __init__(
        self,
        output_dir: Path = DEFAULT_OUTPUT_DIR,
        *,
        user_agent: str = USER_AGENT,
        delay_sec: float = DEFAULT_REQUEST_DELAY_SEC,
        timeout_sec: float = DEFAULT_TIMEOUT_SEC,
        respect_robots: bool = True,
    ) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.manifest_path = self.output_dir / "manifest.jsonl"
        self.delay_sec = delay_sec
        self.respect_robots = respect_robots
        self.robots = RobotsCache(user_agent)
        self._seen_urls: set[str] = set()
        self._seen_hashes: set[str] = set()
        self._load_manifest()

        self.client = httpx.Client(
            headers={"User-Agent": user_agent, "Accept": "application/pdf,*/*"},
            timeout=timeout_sec,
            follow_redirects=True,
        )

    def _load_manifest(self) -> None:
        if not self.manifest_path.exists():
            return
        with self.manifest_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if row.get("url"):
                    self._seen_urls.add(row["url"])
                if row.get("sha256"):
                    self._seen_hashes.add(row["sha256"])

    def _append_manifest(self, record: DownloadRecord) -> None:
        with self.manifest_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")

    def close(self) -> None:
        self.client.close()

    def _skip(
        self, url: str, *, source: str, reason: str, sha256: str = "", nbytes: int = 0
    ) -> DownloadRecord:
        record = DownloadRecord(
            url=url,
            filename="",
            sha256=sha256,
            bytes=nbytes,
            source=f"{source}:{reason}",
            status="skipped",
        )
        self._seen_urls.add(url)
        self._append_manifest(record)
        return record

    def download_url(self, url: str, *, source: str = "discover") -> DownloadRecord | None:
        if url in self._seen_urls:
            return self._skip(url, source=source, reason="duplicate_url")

        if self.respect_robots and not self.robots.allowed(url):
            return self._skip(url, source=source, reason="robots_txt")

        time.sleep(self.delay_sec)

        try:
            with self.client.stream("GET", url) as resp:
                resp.raise_for_status()
                headers = resp.headers
                data = resp.read()
        except Exception:
            record = DownloadRecord(
                url=url,
                filename="",
                sha256="",
                bytes=0,
                source=source,
                status="failed",
            )
            self._seen_urls.add(url)
            self._append_manifest(record)
            return record

        if not data.startswith(_PDF_MAGIC):
            # Some servers mislabel; still reject obvious HTML
            if data[:15].lower().startswith(b"<!doctype") or data[:6].lower() == b"<html":
                record = DownloadRecord(
                    url=url,
                    filename="",
                    sha256="",
                    bytes=0,
                    source=source,
                    status="failed",
                )
                self._seen_urls.add(url)
                self._append_manifest(record)
                return record

        sha = hashlib.sha256(data).hexdigest()
        if sha in self._seen_hashes:
            record = DownloadRecord(
                url=url,
                filename="",
                sha256=sha,
                bytes=len(data),
                source=source,
                status="skipped",
            )
            self._seen_urls.add(url)
            self._append_manifest(record)
            return record

        filename = _filename_from_headers(url, headers)
        path = _unique_path(self.output_dir, filename, sha)
        path.write_bytes(data)

        record = DownloadRecord(
            url=url,
            filename=path.name,
            sha256=sha,
            bytes=len(data),
            source=source,
            status="ok",
        )
        self._seen_urls.add(url)
        self._seen_hashes.add(sha)
        self._append_manifest(record)
        return record

    def download_many(
        self,
        urls: set[str],
        *,
        max_downloads: int | None = None,
        source: str = "discover",
    ) -> list[DownloadRecord]:
        results: list[DownloadRecord] = []
        count_ok = 0
        for url in sorted(urls):
            if max_downloads is not None and count_ok >= max_downloads:
                break
            record = self.download_url(url, source=source)
            if record:
                results.append(record)
                if record.status == "ok":
                    count_ok += 1
        return results
