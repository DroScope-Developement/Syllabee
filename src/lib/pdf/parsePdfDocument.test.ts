import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { itemsToLines } from "./extractPdfLines";
import { extractTopicLabel, parsePdfLines, plainTextToLines } from "./parsePdfDocument";
import type { PdfTextItem } from "./types";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../../../public");

function fontSizeFromTransform(transform: number[]): number {
  return Math.hypot(transform[0], transform[1]);
}

async function loadPdfLines(fileName: string) {
  const data = new Uint8Array(readFileSync(join(publicDir, fileName)));
  const pdf = await getDocument({ data }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = content.items
      .filter((item): item is typeof item & { str: string } => "str" in item)
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        fontSize: fontSizeFromTransform(item.transform),
      }));
    allLines.push(...itemsToLines(pageNum, items));
  }

  return allLines;
}

describe("extractTopicLabel", () => {
  it("takes the trailing informative segment after colons", () => {
    expect(extractTopicLabel("Mon Jan 22: Unit 1: Introduction")).toBe(
      "Introduction",
    );
    expect(extractTopicLabel("Wed Mar 27: Unit 25: Fundamental theorem")).toBe(
      "Fundamental theorem",
    );
  });
});

describe("parsePdfLines", () => {
  it("builds hierarchical sections from vertical spacing (no format regex)", () => {
    const lines = plainTextToLines(`
Intro to CS
CS 101 Spring 2026

Week 1 Topic A
Item one
Item two

Week 2 Topic B
Item three
    `);

    const result = parsePdfLines(lines);
    expect(result.sections.length).toBeGreaterThanOrEqual(2);
    expect(result.sections[0].subpoints.length).toBeGreaterThanOrEqual(2);
  });

  it("parses cs101-syllabus.pdf from vertical grouping without Week/ bullet regex", async () => {
    const lines = await loadPdfLines("cs101-syllabus.pdf");
    const result = parsePdfLines(lines, { fileName: "cs101-syllabus.pdf" });

    expect(result.courseTitle).toMatch(/Introduction to Computer Science/i);
    expect(result.courseCode).toBe("CS 101");
    expect(result.sections.length).toBeGreaterThanOrEqual(4);
    expect(result.sections[0].subpoints.length).toBeGreaterThanOrEqual(2);
    expect(result.sections.some((s) => /computing|problem/i.test(s.title))).toBe(
      true,
    );
  });

  it("parses syllabus.pdf schedule rows from typography and colon segments", async () => {
    const lines = await loadPdfLines("syllabus.pdf");
    const result = parsePdfLines(lines, { fileName: "syllabus.pdf" });

    expect(result.courseTitle).toMatch(/calculus/i);
    expect(result.sections.length).toBeGreaterThanOrEqual(20);
    expect(
      result.sections.some((s) => /introduction|functions|limits|chain rule/i.test(s.title)),
    ).toBe(true);
  });

  it("throws when given empty lines", () => {
    expect(() => parsePdfLines([])).toThrow(/No readable text/);
  });
});
