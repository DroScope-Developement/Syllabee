import type { Course } from "../types/course";
import type { PrebuiltTestDefinition } from "../types/prebuiltTest";
import {
  enrichOutlineWithHandoutSummaries,
  mergePrebuiltOutline,
  outlineFromWebpageSnapshot,
} from "../types/prebuiltTest";
import { fetchMath1aCourseWebpage } from "../data/prebuilt/math1aHarvardWebpage";
import { math1aHarvardPrebuiltTest } from "../data/prebuilt/prebuiltTests";
import { parseSyllabusPdf } from "../lib/parseSyllabus";
import { normalizeCourseForDisplay } from "./normalizeCourse";
import { SyllabusParseError } from "../lib/syllabusErrors";

async function fetchPublicPdf(path: string, fileName: string): Promise<File> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new SyllabusParseError(`Could not load ${fileName} from ${path}.`);
  }
  const blob = await response.blob();
  return new File([blob], fileName, { type: "application/pdf" });
}

/**
 * Loads a prebuilt test course from three sources:
 * 1. Syllabus PDF (public/)
 * 2. Textbook PDF (public/)
 * 3. Course webpage snapshot (live fetch layer → bundled fixture for now)
 *
 * **Plug in real integrations here:** OCR/scraper for syllabus PDF, textbook
 * TOC extraction, and a backend proxy for the course webpage.
 */
export async function loadPrebuiltTest(
  definition: PrebuiltTestDefinition = math1aHarvardPrebuiltTest,
): Promise<Course> {
  const [syllabusFile, webpage] = await Promise.all([
    fetchPublicPdf(definition.syllabusPath, definition.syllabusFileName),
    fetchMath1aCourseWebpage(),
  ]);

  let parsedSyllabus = null;
  try {
    parsedSyllabus = await parseSyllabusPdf(syllabusFile);
  } catch {
    // Syllabus PDF is supplemental; webpage + textbook still define the test.
  }

  const webpageOutline = outlineFromWebpageSnapshot(webpage);
  const merged = mergePrebuiltOutline(webpageOutline, parsedSyllabus);
  const enriched = enrichOutlineWithHandoutSummaries({
    ...merged,
    university: definition.university ?? merged.university ?? parsedSyllabus?.university,
    professor: definition.professor ?? merged.professor ?? parsedSyllabus?.professor,
  });
  const course: Course = {
    id: definition.id,
    syllabus: enriched,
    source: "prebuilt",
    fileName: definition.syllabusFileName,
    addedAt: Date.now(),
    prebuiltTestId: definition.id,
    university: definition.university ?? enriched.university,
    professor: definition.professor ?? enriched.professor,
    resources: {
      syllabus: {
        path: definition.syllabusPath,
        fileName: definition.syllabusFileName,
      },
      textbook: definition.textbook,
      coursePage: definition.coursePage,
    },
  };

  return normalizeCourseForDisplay(course);
}

export type PrebuiltTestLoadProgress =
  | "syllabus"
  | "textbook"
  | "webpage"
  | "merging";

export const prebuiltLoadSteps: PrebuiltTestLoadProgress[] = [
  "syllabus",
  "textbook",
  "webpage",
  "merging",
];

export function prebuiltLoadMessage(step: PrebuiltTestLoadProgress): string {
  switch (step) {
    case "syllabus":
      return "Loading syllabus PDF…";
    case "textbook":
      return "Linking textbook…";
    case "webpage":
      return "Fetching course webpage…";
    case "merging":
      return "Building course outline…";
  }
}
