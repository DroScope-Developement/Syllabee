import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfLine, PdfTextItem } from "./types";

export { LINE_GAP_LARGE } from "./types";
import { SyllabusParseError } from "../syllabusErrors";

GlobalWorkerOptions.workerSrc = pdfWorker;

const Y_TOLERANCE = 4;

interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

function isPdfJsTextItem(item: unknown): item is PdfJsTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
}

function fontSizeFromTransform(transform: number[]): number {
  return Math.hypot(transform[0], transform[1]);
}

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

async function extractItemsFromData(
  data: ArrayBuffer | Uint8Array,
): Promise<PdfTextItem[][]> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let pdf;
  try {
    pdf = await getDocument({ data: bytes }).promise;
  } catch {
    throw new SyllabusParseError(
      "Could not open PDF. The file may be corrupted or password-protected.",
    );
  }

  const pages: PdfTextItem[][] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const textItems: PdfJsTextItem[] = [];
    for (const item of content.items) {
      if (isPdfJsTextItem(item)) textItems.push(item);
    }
    pages.push(
      textItems.map((item) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          fontSize: fontSizeFromTransform(item.transform),
        })),
    );
  }
  return pages;
}

/** Core extraction from raw PDF bytes (shared by file upload and tests). */
export async function extractPdfLinesFromData(
  data: ArrayBuffer | Uint8Array,
): Promise<PdfLine[]> {
  const pages = await extractItemsFromData(data);
  const allLines: PdfLine[] = [];
  pages.forEach((items, index) => {
    allLines.push(...itemsToLines(index + 1, items));
  });

  if (allLines.length === 0) {
    throw new SyllabusParseError(
      "This PDF has no extractable text. Scanned documents may require OCR.",
    );
  }

  return allLines;
}

/**
 * Extracts positioned text lines from every page of a PDF.
 * Layout metadata (x, y, font size) powers the format-agnostic parser.
 */
export async function extractPdfLines(file: File): Promise<PdfLine[]> {
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new SyllabusParseError("Could not read the uploaded PDF.");
  }
  return extractPdfLinesFromData(buffer);
}

/** Plain-text join of all lines — useful for debugging or legacy paths. */
export function linesToPlainText(lines: PdfLine[]): string {
  return lines.map((line) => line.text).join("\n");
}

/** @deprecated Use extractPdfLines — kept for callers expecting a plain string. */
export async function extractPdfText(file: File): Promise<string> {
  const lines = await extractPdfLines(file);
  return linesToPlainText(lines);
}
