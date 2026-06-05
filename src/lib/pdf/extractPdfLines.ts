import { SyllabusParseError } from "../syllabusErrors";
import { itemsToLines, linesToPlainText } from "./pdfLineLayout";
import { loadPdfJs } from "./setupPdfJsWorker";
import type { PdfLine, PdfTextItem } from "./types";

export { LINE_GAP_LARGE } from "./types";
export { itemsToLines, linesToPlainText } from "./pdfLineLayout";

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

async function extractItemsFromData(
  data: ArrayBuffer | Uint8Array,
): Promise<PdfTextItem[][]> {
  const { getDocument } = await loadPdfJs();
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

/** @deprecated Use extractPdfLines — kept for callers expecting a plain string. */
export async function extractPdfText(file: File): Promise<string> {
  const lines = await extractPdfLines(file);
  return linesToPlainText(lines);
}
