import { describe, expect, it } from "vitest";
import { parseSyllabusText } from "./pdf/parsePdfDocument";

const SAMPLE_TEXT = `
Introduction to Computer Science
CS 101 · Spring 2026

Week 1 — Computing & Problem Solving
- History of computing and abstraction
- Algorithms and pseudocode
- Introductory Python syntax

Week 2 — Data & Control Flow
- Variables, types, and expressions
- Conditional statements
- For and while loops
`.trim();

describe("parseSyllabusText", () => {
  it("parses plain text through the layout-aware pipeline", () => {
    const result = parseSyllabusText(SAMPLE_TEXT);

    expect(result.courseTitle).toBe("Computer Science");
    expect(result.courseCode).toBe("CS 101");
    expect(result.term).toBe("Spring 2026");
    expect(result.sections.length).toBeGreaterThanOrEqual(2);
  });

  it("throws when no topics can be detected", () => {
    expect(() => parseSyllabusText("   \n  ")).toThrow(/No readable text/);
  });
});
