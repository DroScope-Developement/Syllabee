"""University and aggregator syllabus discovery sources."""

from crawler.sources.registry import (
    DEFAULT_SOURCES,
    discover_for_course,
    discover_university_wide,
    list_source_names,
)

__all__ = [
    "DEFAULT_SOURCES",
    "discover_for_course",
    "discover_university_wide",
    "list_source_names",
]
