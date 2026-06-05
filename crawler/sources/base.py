from __future__ import annotations

import sqlite3
from abc import ABC, abstractmethod
from typing import Iterable

import httpx

from crawler.models import PdfCandidate


class SyllabusSource(ABC):
    """Pluggable discovery backend for a university or aggregator."""

    name: str
    label: str

    @abstractmethod
    def discover_for_course(
        self,
        course: sqlite3.Row,
        client: httpx.Client,
        *,
        verbose: bool = True,
    ) -> set[PdfCandidate]:
        """Find syllabus candidates relevant to one catalog course."""

    def discover_all(
        self,
        client: httpx.Client,
        *,
        verbose: bool = True,
    ) -> set[PdfCandidate]:
        """Optional broad discovery not tied to a single course."""
        return set()


def merge_candidates(*groups: Iterable[PdfCandidate]) -> set[PdfCandidate]:
    merged: set[PdfCandidate] = set()
    for group in groups:
        merged |= set(group)
    return merged
