import { describe, expect, it } from "vitest";
import { plainTextToLines } from "./parsePdfDocument";
import {
  extractSyllabusMetadata,
  inferCourseDisplayTitle,
} from "./extractSyllabusMetadata";

describe("extractSyllabusMetadata", () => {
  it("prefers catalog subject as the display course name", () => {
    const lines = plainTextToLines(`
      Syllabus For Assamese (Code 014)
      Class IX 2024-2025
    `);

    expect(
      inferCourseDisplayTitle(lines, { catalogSubject: "Algorithms" }),
    ).toBe("Algorithms");
  });

  it("extracts a simple subject title from syllabus patterns", () => {
    const lines = plainTextToLines(`
      Common Course Syllabus for Abnormal Psychology, PSYC 2320, Spring 2025
      Instructor: Jane Smith
      Bloomsburg University
    `);

    const metadata = extractSyllabusMetadata(lines);
    expect(metadata.courseTitle).toBe("Abnormal Psychology");
    expect(metadata.university?.name).toMatch(/Bloomsburg University/i);
    expect(metadata.professor?.name).toBe("Jane Smith");
  });

  it("shortens introduction-style titles to the core subject", () => {
    const lines = plainTextToLines(`
      Introduction to Computer Science
      CS 101 Spring 2026
    `);

    expect(inferCourseDisplayTitle(lines)).toBe("Computer Science");
  });

  it("rejects generic document headings as course titles", () => {
    const lines = plainTextToLines(`
      Course Information
      Instructor Contact Information
      MIT OpenCourseWare
    `);

    const title = inferCourseDisplayTitle(lines, {
      fileName: "syllabus-template.pdf",
    });
    expect(title).not.toMatch(/course information/i);
  });
});
