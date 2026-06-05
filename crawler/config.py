from __future__ import annotations

from pathlib import Path

# User-requested output folder name (subject subfolders inside)
DEFAULT_OUTPUT_DIR = Path("sylabi")

# Max successful PDFs stored per course/subject folder (no global cap by default)
DEFAULT_MAX_PER_COURSE = 3

DEFAULT_DB_PATH = Path("data") / "syllabee.db"
DEFAULT_DATA_DIR = Path("data")
DEFAULT_TAXONOMY_PATH = DEFAULT_DATA_DIR / "taxonomy.yaml"
DEFAULT_COURSES_PATH = DEFAULT_DATA_DIR / "courses.yaml"

# Loose PDFs that could not be matched still get a small bucket (not 10 slots blocking real courses)
DEFAULT_MAX_UNCLASSIFIED = 15

# Per-course URL queue: retry failed downloads up to this many times
DEFAULT_MAX_DOWNLOAD_ATTEMPTS = 3

# Only run new DuckDuckGo search when pending queue for a course drops below this
DEFAULT_MIN_QUEUE_BEFORE_SEARCH = 1

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

# Top-university and aggregator index pages (used by university-seeds source)
UNIVERSITY_SEED_URLS: list[str] = [
    *DEFAULT_SEED_URLS,
    "https://ocw.mit.edu/courses/",
    "https://cs50.harvard.edu/x/syllabus/",
    "https://pll.harvard.edu/catalog",
    "https://online.stanford.edu/free-courses",
    "https://www.openculture.com/freeonlinecourses",
    "https://academicearth.org/",
    "https://teaching.cornell.edu/resource/course-design/syllabus-design/",
]

# Site-specific search filters for university discovery (DDG site: operator)
UNIVERSITY_SITE_QUERIES: list[tuple[str, str]] = [
    ("site:ocw.mit.edu", "mit_ocw"),
    ("site:cs50.harvard.edu", "harvard_cs50"),
    ("site:pll.harvard.edu", "harvard_pll"),
    ("site:online.stanford.edu", "stanford"),
    ("site:berkeley.edu", "berkeley"),
    ("site:cmu.edu", "cmu"),
    ("site:openculture.com", "openculture"),
    ("site:academicearth.org", "academicearth"),
]

# Default university sources for gap-fill (comma-separated names in CLI)
DEFAULT_UNIVERSITY_SOURCES: tuple[str, ...] = ("mit-ocw", "university-search")

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
