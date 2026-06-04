from __future__ import annotations

import time


def vprint(msg: str, *, verbose: bool) -> None:
    if verbose:
        print(msg, flush=True)


def vprint_query_progress(
    index: int,
    total: int,
    query: str,
    *,
    verbose: bool,
    new_count: int,
    total_candidates: int,
    elapsed_sec: float,
    error: str | None = None,
) -> None:
    if not verbose:
        return
    label = query if len(query) <= 72 else query[:69] + "..."
    line = f"  [{index:>{len(str(total))}}/{total}] {label}"
    print(line, flush=True)
    if error:
        print(f"       !! {error}", flush=True)
    else:
        print(
            f"       +{new_count} new PDFs in {elapsed_sec:.1f}s "
            f"(running total: {total_candidates})",
            flush=True,
        )


class PhaseTimer:
    def __init__(self, name: str, *, verbose: bool) -> None:
        self.name = name
        self.verbose = verbose
        self._start = 0.0

    def __enter__(self) -> PhaseTimer:
        self._start = time.monotonic()
        vprint(f"\n==> {self.name}", verbose=self.verbose)
        return self

    def __exit__(self, *args: object) -> None:
        if self.verbose:
            elapsed = time.monotonic() - self._start
            print(f"==> {self.name} finished in {elapsed:.1f}s\n", flush=True)
