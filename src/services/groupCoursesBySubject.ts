import { prebuiltTests } from "../data/prebuilt/prebuiltTests";
import { sylabiCatalogSubjects } from "../data/sylabiCatalog";
import type { Course } from "../types/course";
import type { PrebuiltTestDefinition } from "../types/prebuiltTest";
import { buildCatalogCourses } from "./buildCatalogCourses";

export function displaySubject(raw: string): string {
  return raw === "_unclassified" ? "General" : raw;
}

export function courseSubject(course: Course): string {
  if (course.catalogSubject) return displaySubject(course.catalogSubject);
  if (course.prebuiltTestId) {
    const test = prebuiltTests.find((entry) => entry.id === course.prebuiltTestId);
    if (test) return displaySubject(test.subject);
  }
  return "Uploaded";
}

export type SubjectGroupEntry =
  | { type: "course"; course: Course }
  | { type: "prebuilt"; test: PrebuiltTestDefinition };

function entryTitle(entry: SubjectGroupEntry): string {
  if (entry.type === "course") {
    return entry.course.syllabus.courseTitle;
  }
  return entry.test.title;
}

function entrySearchText(entry: SubjectGroupEntry, subject: string): string {
  if (entry.type === "course") {
    const { course } = entry;
    const { syllabus } = course;
    return [
      subject,
      syllabus.courseTitle,
      syllabus.courseCode,
      course.fileName,
      course.catalogSubject,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  return [subject, entry.test.title, entry.test.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const SUBJECT_TAIL = ["Calculus", "Uploaded"];

function compareSubjects(a: string, b: string): number {
  const order = sylabiCatalogSubjects.map(displaySubject);
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;

  const at = SUBJECT_TAIL.indexOf(a);
  const bt = SUBJECT_TAIL.indexOf(b);
  if (at !== -1 && bt !== -1) return at - bt;
  if (at !== -1) return 1;
  if (bt !== -1) return -1;

  return a.localeCompare(b);
}

export function buildSubjectGroups(
  savedCourses: Course[],
): Map<string, SubjectGroupEntry[]> {
  const savedCatalogIds = new Set(
    savedCourses.flatMap((course) =>
      course.catalogId ? [course.catalogId] : [],
    ),
  );
  const savedPrebuiltIds = new Set(
    savedCourses.flatMap((course) =>
      course.prebuiltTestId ? [course.prebuiltTestId] : [],
    ),
  );

  const entries: SubjectGroupEntry[] = [
    ...savedCourses.map((course) => ({ type: "course" as const, course })),
    ...buildCatalogCourses()
      .filter(
        (course) => course.catalogId && !savedCatalogIds.has(course.catalogId),
      )
      .map((course) => ({ type: "course" as const, course })),
    ...prebuiltTests
      .filter((test) => !savedPrebuiltIds.has(test.id))
      .map((test) => ({ type: "prebuilt" as const, test })),
  ];

  const grouped = new Map<string, SubjectGroupEntry[]>();

  for (const entry of entries) {
    const subject =
      entry.type === "course"
        ? courseSubject(entry.course)
        : displaySubject(entry.test.subject);
    const bucket = grouped.get(subject) ?? [];
    bucket.push(entry);
    grouped.set(subject, bucket);
  }

  for (const [subject, list] of grouped) {
    list.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b)));
    grouped.set(subject, list);
  }

  return new Map(
    [...grouped.entries()].sort(([a], [b]) => compareSubjects(a, b)),
  );
}

export function filterSubjectGroups(
  groups: Map<string, SubjectGroupEntry[]>,
  query: string,
): Map<string, SubjectGroupEntry[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return groups;

  const filtered = new Map<string, SubjectGroupEntry[]>();

  for (const [subject, entries] of groups) {
    const matches = entries.filter((entry) =>
      entrySearchText(entry, subject).includes(normalized),
    );
    if (matches.length > 0) {
      filtered.set(subject, matches);
    }
  }

  return filtered;
}

export function countSubjectGroupEntries(
  groups: Map<string, SubjectGroupEntry[]>,
): number {
  let total = 0;
  for (const entries of groups.values()) {
    total += entries.length;
  }
  return total;
}

export type CourseListEntry = SubjectGroupEntry & { subject: string };

function entrySubject(entry: SubjectGroupEntry): string {
  if (entry.type === "course") {
    return courseSubject(entry.course);
  }
  return displaySubject(entry.test.subject);
}

export function buildCourseListEntries(savedCourses: Course[]): CourseListEntry[] {
  const groups = buildSubjectGroups(savedCourses);
  const entries: CourseListEntry[] = [];

  for (const groupEntries of groups.values()) {
    for (const entry of groupEntries) {
      entries.push({ ...entry, subject: entrySubject(entry) });
    }
  }

  return entries.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b)));
}

export function filterCourseListEntries(
  entries: CourseListEntry[],
  query: string,
): CourseListEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return entries;

  return entries.filter((entry) =>
    entrySearchText(entry, entry.subject).includes(normalized),
  );
}
