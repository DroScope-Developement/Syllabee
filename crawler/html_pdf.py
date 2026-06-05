from __future__ import annotations

import re
from io import BytesIO

from bs4 import BeautifulSoup
from fpdf import FPDF


def _clean_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"\s+\n", "\n", text)
    return text.strip()


def html_to_pdf_bytes(html: str, *, title: str | None = None) -> bytes:
    """Render syllabus HTML into a simple text PDF for storage."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "noscript"]):
        tag.decompose()

    page_title = title
    if not page_title:
        title_tag = soup.find("title")
        page_title = title_tag.get_text(strip=True) if title_tag else "Syllabus"

    h1 = soup.find("h1")
    if h1:
        heading = h1.get_text("\n", strip=True)
    else:
        heading = page_title

    body = _clean_text(soup.get_text("\n", strip=True))
    if not body:
        body = heading or "Syllabus content unavailable."

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    effective_width = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(effective_width, 8, _latin1_safe(heading[:200]))
    pdf.ln(4)
    pdf.set_font("Helvetica", size=10)
    for line in body.splitlines():
        line = line.strip()
        if not line:
            pdf.ln(2)
            continue
        pdf.multi_cell(effective_width, 5, _latin1_safe(line[:500]))
    out = BytesIO()
    pdf.output(out)
    return out.getvalue()


def _latin1_safe(text: str) -> str:
    """FPDF core fonts are Latin-1; replace unsupported characters."""
    return text.encode("latin-1", errors="replace").decode("latin-1")
