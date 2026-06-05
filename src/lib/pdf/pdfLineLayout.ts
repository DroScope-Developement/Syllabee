import type { PdfLine, PdfTextItem } from "./types";

export { LINE_GAP_LARGE } from "./types";

const Y_TOLERANCE = 4;

export function itemsToLines(pageNum: number, items: PdfTextItem[]): PdfLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rawLines: { y: number; items: PdfTextItem[] }[] = [];

  for (const item of sorted) {
    if (!item.text.trim()) continue;
    const existing = rawLines.find((line) => Math.abs(line.y - item.y) <= Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
      existing.y = (existing.y + item.y) / 2;
    } else {
      rawLines.push({ y: item.y, items: [item] });
    }
  }

  rawLines.sort((a, b) => b.y - a.y);

  const lines: PdfLine[] = rawLines.map((raw) => {
    raw.items.sort((a, b) => a.x - b.x);
    const text = raw.items
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      page: pageNum,
      y: raw.y,
      x: Math.min(...raw.items.map((item) => item.x)),
      fontSize: Math.max(...raw.items.map((item) => item.fontSize)),
      text,
      items: raw.items,
      gapAbove: 0,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  });

  for (let i = 1; i < lines.length; i++) {
    lines[i].gapAbove = lines[i - 1].y - lines[i].y;
  }

  return lines;
}

export function linesToPlainText(lines: PdfLine[]): string {
  return lines.map((line) => line.text).join("\n");
}
