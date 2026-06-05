import type { PrebuiltTestDefinition } from "../../types/prebuiltTest";

/** Prebuilt test: syllabus PDF + textbook PDF + Harvard course webpage. */
export const math1aHarvardPrebuiltTest: PrebuiltTestDefinition = {
  id: "math1a-harvard-2024",
  title: "Math 1a Harvard",
  description:
    "Introduction to Calculus — syllabus, 337-page course text, and live course page structure.",
  syllabusPath: "/syllabus.pdf",
  syllabusFileName: "syllabus.pdf",
  textbook: {
    title: "Math 1a Course Notes (2024)",
    path: "/1a_2024.pdf",
    fileName: "1a_2024.pdf",
    sourceUrl:
      "https://people.math.harvard.edu/~knill/teaching/math1a2024/handouts/1a_2024.pdf",
    pageCount: 337,
  },
  coursePage: {
    title: "Math 1a Spring 2024 — Oliver Knill",
    url: "https://people.math.harvard.edu/~knill/teaching/math1a2024/",
  },
  university: {
    name: "Harvard University",
    logoUrl: "/universities/harvard.svg",
  },
  professor: {
    name: "Oliver Knill",
  },
};

export const prebuiltTests = [math1aHarvardPrebuiltTest];
