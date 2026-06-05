import type {
  CoursePageResource,
  ProfessorInfo,
  TextbookResource,
  UniversityInfo,
} from "./course";
import type { SyllabusOutlineData } from "./syllabus";
import { handoutContentCache } from "../data/prebuilt/handoutContentCache";
import { buildSectionMetaFromHandouts, parseSectionUnitNumber } from "../lib/deriveUnitSectionMeta";

export interface PrebuiltTestDefinition {
  id: string;
  title: string;
  description: string;
  syllabusPath: string;
  syllabusFileName: string;
  textbook: TextbookResource;
  coursePage: CoursePageResource;
  university?: UniversityInfo;
  professor?: ProfessorInfo;
}

/** Builds a syllabus outline from the Harvard course webpage unit table. */
export function outlineFromWebpageSnapshot(snapshot: {
  subtitle: string;
  courseCode: string;
  term: string;
  units: Array<{
    number: number;
    label: string;
    lectureFetchPath?: string;
    lectureUrl?: string;
    worksheetFetchPath?: string;
    worksheetUrl?: string;
  }>;
}): SyllabusOutlineData {
  return {
    courseTitle: snapshot.subtitle,
    courseCode: snapshot.courseCode,
    term: snapshot.term,
    sections: snapshot.units.map((unit) => {
      const subpoints = [];

      if (unit.lectureFetchPath && unit.lectureUrl) {
        subpoints.push({
          id: `unit-${unit.number}-lecture`,
          title: "Lecture notes",
          resource: {
            fetchPath: unit.lectureFetchPath,
            sourceUrl: unit.lectureUrl,
            kind: "lecture" as const,
          },
        });
      }
      if (unit.worksheetFetchPath && unit.worksheetUrl) {
        subpoints.push({
          id: `unit-${unit.number}-worksheet`,
          title: "Practice worksheet",
          resource: {
            fetchPath: unit.worksheetFetchPath,
            sourceUrl: unit.worksheetUrl,
            kind: "worksheet" as const,
          },
        });
      }
      if (subpoints.length === 0) {
        subpoints.push({
          id: `unit-${unit.number}-overview`,
          title: "Unit overview",
        });
      }

      return {
        id: `unit-${String(unit.number).padStart(2, "0")}`,
        title: unit.label,
        subpoints,
      };
    }),
  };
}

/** Prefer webpage structure for prebuilt; PDF is supplemental metadata only. */
export function mergePrebuiltOutline(
  fromWebpage: SyllabusOutlineData,
  fromPdf: SyllabusOutlineData | null,
): SyllabusOutlineData {
  if (!fromPdf) return fromWebpage;

  const pdfLooksLikeWrongCourse =
    /computer science|cs\s*101|cs101|intro to computer/i.test(
      fromPdf.courseTitle,
    ) ||
    /cs\s*101|cs101/i.test(fromPdf.courseCode ?? "");

  return {
    courseTitle: pdfLooksLikeWrongCourse
      ? fromWebpage.courseTitle
      : fromWebpage.courseTitle || fromPdf.courseTitle,
    courseCode: pdfLooksLikeWrongCourse
      ? fromWebpage.courseCode
      : fromPdf.courseCode ?? fromWebpage.courseCode,
    term: fromPdf.term ?? fromWebpage.term,
    university: fromWebpage.university ?? fromPdf?.university,
    professor: fromWebpage.professor ?? fromPdf?.professor,
    sections: fromWebpage.sections,
  };
}

/** Attach cached handout titles and summaries to unit sections when available. */
export function enrichOutlineWithHandoutSummaries(
  outline: SyllabusOutlineData,
): SyllabusOutlineData {
  return {
    ...outline,
    sections: outline.sections.map((section) => {
      const unitNumber = parseSectionUnitNumber(section.id);
      if (unitNumber === undefined) return section;

      const lecture = section.subpoints.find(
        (subpoint) => subpoint.resource?.kind === "lecture",
      );
      const worksheet = section.subpoints.find(
        (subpoint) => subpoint.resource?.kind === "worksheet",
      );

      const lectureRaw = lecture?.resource
        ? handoutContentCache[lecture.resource.fetchPath]
        : undefined;
      const worksheetRaw = worksheet?.resource
        ? handoutContentCache[worksheet.resource.fetchPath]
        : undefined;

      if (!lectureRaw && !worksheetRaw) return section;

      const meta = buildSectionMetaFromHandouts(
        unitNumber,
        section.title,
        lectureRaw,
        worksheetRaw,
      );

      return {
        ...section,
        title: meta.title,
        description: meta.description ?? section.description,
      };
    }),
  };
}
