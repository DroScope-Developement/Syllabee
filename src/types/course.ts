import type { SyllabusOutlineData } from "./syllabus";

export interface UniversityInfo {
  name: string;
  logoUrl?: string;
}

export interface ProfessorInfo {
  name: string;
  photoUrl?: string;
}

export type SyllabusSource = "default" | "upload" | "example" | "prebuilt" | "catalog";

export interface TextbookResource {
  title: string;
  path: string;
  fileName: string;
  sourceUrl?: string;
  pageCount?: number;
}

export interface CoursePageResource {
  title: string;
  url: string;
}

export interface SyllabusFileResource {
  path: string;
  fileName: string;
}

export interface CourseResources {
  syllabus: SyllabusFileResource;
  textbook?: TextbookResource;
  coursePage?: CoursePageResource;
}

export interface Course {
  id: string;
  syllabus: SyllabusOutlineData;
  source: SyllabusSource;
  fileName?: string;
  addedAt: number;
  prebuiltTestId?: string;
  catalogId?: string;
  catalogSubject?: string;
  resources?: CourseResources;
  university?: UniversityInfo;
  professor?: ProfessorInfo;
}

export function courseSourceLabel(course: Course): string | undefined {
  if (course.source === "prebuilt") return "Prebuilt test";
  if (course.source === "catalog") {
    return course.catalogSubject
      ? `Syllabus library · ${course.catalogSubject}`
      : "Syllabus library";
  }
  if (course.source === "default") return undefined;
  if (course.source === "example") return "Example test syllabus";
  return course.fileName ? `Uploaded · ${course.fileName}` : "Uploaded syllabus";
}

export function countTopics(syllabus: SyllabusOutlineData): number {
  return syllabus.sections.reduce(
    (total, section) => total + section.subpoints.length,
    0,
  );
}
