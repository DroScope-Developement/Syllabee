import { describe, expect, it } from "vitest";
import { math1aHarvardWebpage } from "../data/prebuilt/math1aHarvardWebpage";
import {
  enrichOutlineWithHandoutSummaries,
  mergePrebuiltOutline,
  outlineFromWebpageSnapshot,
} from "./prebuiltTest";

describe("prebuilt test outline", () => {
  it("builds 36 units from the Harvard webpage snapshot", () => {
    const outline = outlineFromWebpageSnapshot(math1aHarvardWebpage);

    expect(outline.courseTitle).toBe("Introduction to Calculus");
    expect(outline.courseCode).toBe("Math 1a");
    expect(outline.term).toBe("Spring 2024");
    expect(outline.sections).toHaveLength(36);
    expect(outline.sections[1].subpoints).toHaveLength(2);
    expect(outline.sections[0].subpoints[0].title).toBe("Lecture notes");
    expect(outline.sections[1].subpoints[0].resource?.kind).toBe("lecture");
  });

  it("merges webpage structure with syllabus PDF metadata", () => {
    const webpage = outlineFromWebpageSnapshot(math1aHarvardWebpage);
    const merged = mergePrebuiltOutline(webpage, {
      courseTitle: "Intro to Computer Science",
      courseCode: "CS 101",
      term: "Spring 2026",
      sections: [{ id: "w1", title: "Week 1", subpoints: [{ id: "t1", title: "Topic" }] }],
    });

    expect(merged.courseTitle).toBe("Introduction to Calculus");
    expect(merged.courseCode).toBe("Math 1a");
    expect(merged.sections).toHaveLength(36);
  });

  it("enriches generic unit labels with handout titles and content", () => {
    const outline = enrichOutlineWithHandoutSummaries(
      outlineFromWebpageSnapshot(math1aHarvardWebpage),
    );

    expect(outline.sections[15].title).toBe("Unit 15: Important functions");
    expect(outline.sections[9].title).toBe("Unit 9: Hospital's Rule");
    expect(outline.sections[15].description).toMatch(/continuous at a/i);
  });
});
