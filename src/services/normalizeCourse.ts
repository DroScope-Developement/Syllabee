import { math1aHarvardWebpage } from "../data/prebuilt/math1aHarvardWebpage";
import { math1aHarvardPrebuiltTest } from "../data/prebuilt/prebuiltTests";
import type { Course } from "../types/course";
import {
  enrichOutlineWithHandoutSummaries,
  outlineFromWebpageSnapshot,
} from "../types/prebuiltTest";
import type { SyllabusOutlineData } from "../types/syllabus";

const PREBUILT_TEMPLATE_OUTLINE = outlineFromWebpageSnapshot(math1aHarvardWebpage);

function mergePrebuiltResources(
  saved: SyllabusOutlineData,
  template: SyllabusOutlineData,
): SyllabusOutlineData {
  return {
    ...saved,
    courseTitle: template.courseTitle,
    courseCode: template.courseCode,
    term: template.term ?? saved.term,
    sections: saved.sections.map((section, index) => {
      const templateSection =
        template.sections.find((item) => item.id === section.id) ??
        template.sections[index];
      if (!templateSection) return section;

      return {
        ...section,
        subpoints: section.subpoints.map((subpoint, subIndex) => ({
          ...subpoint,
          resource:
            subpoint.resource ??
            templateSection.subpoints[subIndex]?.resource,
        })),
      };
    }),
  };
}

/** Re-attach prebuilt metadata and handout previews for saved or stale courses. */
export function normalizeCourseForDisplay(course: Course): Course {
  if (course.source !== "prebuilt" && !course.prebuiltTestId) {
    return course;
  }

  const withResources = mergePrebuiltResources(
    course.syllabus,
    PREBUILT_TEMPLATE_OUTLINE,
  );
  const syllabus = enrichOutlineWithHandoutSummaries(withResources);

  const prebuiltInstitution =
    course.prebuiltTestId === math1aHarvardPrebuiltTest.id
      ? {
          university: math1aHarvardPrebuiltTest.university,
          professor: math1aHarvardPrebuiltTest.professor,
        }
      : {};

  return {
    ...course,
    syllabus,
    university:
      course.university ??
      syllabus.university ??
      prebuiltInstitution.university,
    professor:
      course.professor ??
      syllabus.professor ??
      prebuiltInstitution.professor,
  };
}

export function normalizeCoursesForDisplay(courses: Course[]): Course[] {
  return courses.map(normalizeCourseForDisplay);
}
