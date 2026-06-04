from __future__ import annotations

from pathlib import Path

# User-requested output folder name (subject subfolders inside)
DEFAULT_OUTPUT_DIR = Path("sylabi")

# Max successful PDFs stored per course/subject folder (no global cap by default)
DEFAULT_MAX_PER_COURSE = 10

DEFAULT_DB_PATH = Path("data") / "syllabee.db"
DEFAULT_DATA_DIR = Path("data")
DEFAULT_TAXONOMY_PATH = DEFAULT_DATA_DIR / "taxonomy.yaml"

# Polite crawling defaults
DEFAULT_REQUEST_DELAY_SEC = 1.0
DEFAULT_TIMEOUT_SEC = 30.0
DEFAULT_MAX_REDIRECTS = 5
USER_AGENT = (
    "SyllaBeeCrawler/1.0 (+https://github.com/DroScope-Developement/Syllabee; "
    "educational-research; respects robots.txt)"
)

# DuckDuckGo discovery queries (file + web search)
DEFAULT_SEARCH_QUERIES: list[str] = [
    "syllabus filetype:pdf site:.edu",
    "course syllabus filetype:pdf university",
    "class syllabus pdf college",
    "inurl:syllabus filetype:pdf",
    "inurl:syllabi filetype:pdf",
    '"course syllabus" filetype:pdf',
    "syllabus spring 2025 filetype:pdf",
    "syllabus fall 2024 filetype:pdf",
]

# Seed pages that often link to public syllabi (shallow crawl only)
DEFAULT_SEED_URLS: list[str] = [
    "https://www.cmu.edu/teaching/designteach/syllabus/samples/index.html",
    "https://ocw.mit.edu/search/?q=syllabus",
    "https://teaching.berkeley.edu/resources/design/syllabus",
    "https://www.weber.edu/academic-affairs/syllabus-checklist.html",
]

# URL path / query hints for syllabus PDFs
SYLLABUS_URL_HINTS: tuple[str, ...] = (
    "syllabus",
    "syllabi",
    "sylabus",  # common typo
    "course-outline",
    "course_outline",
    "courseoutline",
    "class-outline",
)

PDF_EXTENSIONS = (".pdf",)
