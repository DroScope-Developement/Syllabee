from __future__ import annotations

import urllib.robotparser
from urllib.parse import urlparse

import httpx


class RobotsCache:
    """Per-host robots.txt cache."""

    def __init__(self, user_agent: str) -> None:
        self._user_agent = user_agent
        self._parsers: dict[str, urllib.robotparser.RobotFileParser] = {}
        self._disallowed: set[str] = set()

    def _parser_for(self, url: str) -> urllib.robotparser.RobotFileParser | None:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            return None

        host = parsed.netloc.lower()
        if host in self._parsers:
            return self._parsers[host]

        robots_url = f"{parsed.scheme}://{host}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        try:
            rp.read()
        except Exception:
            # If robots.txt is unreachable, allow (common conservative choice for research crawlers)
            pass
        self._parsers[host] = rp
        return rp

    def allowed(self, url: str) -> bool:
        if url in self._disallowed:
            return False
        rp = self._parser_for(url)
        if rp is None:
            return True
        ok = rp.can_fetch(self._user_agent, url)
        if not ok:
            self._disallowed.add(url)
        return ok
