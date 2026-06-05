import { describe, expect, it } from "vitest";
import {
  buildHandoutSectionDescription,
  formatHandoutText,
  isBoilerplateHandoutText,
  pickHandoutPreview,
  truncateHandoutText,
} from "./formatHandoutText";

describe("formatHandoutText", () => {
  it("fixes hyphenation and spacing artifacts", () => {
    expect(formatHandoutText("model the sit- uation. Their graphs")).toBe(
      "model the situation. Their graphs",
    );
  });

  it("flags boilerplate headers", () => {
    expect(isBoilerplateHandoutText("MATH 1A")).toBe(true);
    expect(isBoilerplateHandoutText("A function is continuous")).toBe(false);
  });

  it("picks a useful preview without truncating", () => {
    const longText = "Imagine throwing a ball and display its trajectory as a function of time. ".repeat(5);
    const preview = pickHandoutPreview({
      title: "Unit 1",
      kind: "worksheet",
      sourceUrl: "https://example.com",
      summary: "MATH 1A",
      topics: [],
      problems: [
        {
          label: "Problem 1",
          text: longText,
        },
      ],
      bullets: [],
      figures: [],
    });

    expect(preview).toBe(formatHandoutText(longText));
    expect(truncateHandoutText("a".repeat(200)).length).toBeLessThanOrEqual(181);
  });

  it("joins summary, topics, and problems for section descriptions", () => {
    const description = buildHandoutSectionDescription({
      title: "Unit 15",
      kind: "lecture",
      sourceUrl: "https://example.com",
      summary: "A function f is continuous at a.",
      topics: [{ label: "15.1", text: "The derivative tells whether the function is increasing." }],
      problems: [{ label: "Problem 1", text: "Find the limit as x approaches zero for sin(x)/x." }],
      bullets: [],
      figures: [],
    });

    expect(description).toContain("continuous at a");
    expect(description).toContain("derivative tells");
    expect(description).toContain("sin(x)/x");
  });
});
