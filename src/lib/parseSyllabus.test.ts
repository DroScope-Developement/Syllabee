import { describe, expect, it } from "vitest";
import { parseSyllabusJson } from "./parseSyllabus";

describe("parseSyllabusJson", () => {
  it("parses a valid syllabus JSON object", () => {
    const result = parseSyllabusJson({
      courseTitle: "Introduction to Computer Science",
      courseCode: "CS 101",
      term: "Spring 2026",
      sections: [
        {
          id: "week-1",
          title: "Week 1",
          subpoints: [{ id: "w1-1", title: "Algorithms" }],
        },
      ],
    });

    expect(result.courseTitle).toBe("Introduction to Computer Science");
    expect(result.courseCode).toBe("CS 101");
    expect(result.sections).toHaveLength(1);
  });

  it("rejects syllabus JSON missing courseTitle", () => {
    expect(() => parseSyllabusJson({ sections: [] })).toThrow(/courseTitle/);
  });

  it("rejects syllabus JSON with empty sections", () => {
    expect(() =>
      parseSyllabusJson({ courseTitle: "Test", sections: [] }),
    ).toThrow(/at least one unit/);
  });

  it("rejects sections with empty subpoints", () => {
    expect(() =>
      parseSyllabusJson({
        courseTitle: "Test",
        sections: [{ id: "s1", title: "Unit 1", subpoints: [] }],
      }),
    ).toThrow(/at least one topic/);
  });
});
