import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { itemsToLines } from "./pdfLineLayout";
import { parseHandoutLines } from "./parseHandoutContent";

async function loadPdfLinesFromFile(path: string) {
  const data = new Uint8Array(readFileSync(path));
  const pdf = await getDocument({ data }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string } => "str" in item)
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        fontSize: Math.hypot(item.transform[0], item.transform[1]),
      }));
    allLines.push(...itemsToLines(pageNum, items));
  }

  return allLines;
}

describe("parseHandoutLines", () => {
  it("extracts lecture topics and homework from lecture01", async () => {
    const lines = await loadPdfLinesFromFile("/tmp/lecture01.pdf");
    const parsed = parseHandoutLines(
      lines,
      "lecture",
      "https://example.com/lecture01.pdf",
    );

    expect(parsed.title).toMatch(/Unit 1/i);
    expect(parsed.topics.length).toBeGreaterThanOrEqual(3);
    expect(parsed.topics[0].label).toBe("1.1");
    expect(parsed.problems.length).toBeGreaterThanOrEqual(3);
    expect(parsed.problems[0].label).toMatch(/Problem 1\.1/);
  });

  it("extracts worksheet problems and bullets", async () => {
    const lines = await loadPdfLinesFromFile("/tmp/worksheet01.pdf");
    const parsed = parseHandoutLines(
      lines,
      "worksheet",
      "https://example.com/worksheet01.pdf",
    );

    expect(parsed.problems.length).toBeGreaterThanOrEqual(2);
    expect(parsed.bullets.length).toBeGreaterThan(0);
  });
});
