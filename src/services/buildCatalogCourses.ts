import { sylabiCatalog, type SylabiCatalogEntry } from "../data/sylabiCatalog";
import { sylabiCatalogCache } from "../data/sylabiCatalogCache";
import type { Course } from "../types/course";

export function courseFromCatalogEntry(entry: SylabiCatalogEntry): Course | null {
  const syllabus = sylabiCatalogCache[entry.id];
  if (!syllabus) return null;

  return {
    id: `catalog-${entry.id}`,
    syllabus,
    source: "catalog",
    fileName: entry.fileName,
    addedAt: 0,
    catalogId: entry.id,
    catalogSubject: entry.subject,
    university: syllabus.university,
    professor: syllabus.professor,
    resources: {
      syllabus: {
        path: entry.pdfPath,
        fileName: entry.fileName,
      },
    },
  };
}

const catalogCourses = sylabiCatalog
  .map(courseFromCatalogEntry)
  .filter((course): course is Course => course !== null);

export function buildCatalogCourses(): Course[] {
  return catalogCourses;
}

export function getCatalogCourseById(courseId: string): Course | undefined {
  return catalogCourses.find((course) => course.id === courseId);
}
