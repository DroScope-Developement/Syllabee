import { useMemo, useState } from "react";
import { SyllabusParseError } from "../../lib/syllabusErrors";
import { loadPrebuiltTest, prebuiltLoadMessage } from "../../services/loadPrebuiltTest";
import {
  buildCourseListEntries,
  filterCourseListEntries,
  type CourseListEntry,
} from "../../services/groupCoursesBySubject";
import type { Course } from "../../types/course";
import { countTopics } from "../../types/course";
import type { PrebuiltTestDefinition } from "../../types/prebuiltTest";
import { CourseRow } from "./CourseList.shared";

interface CourseListProps {
  courses: Course[];
  isAuthenticated: boolean;
  onSelectCourse: (courseId: string) => void;
  onPrebuiltLoaded?: (course: Course) => void;
  onSelectCatalogCourse: (course: Course) => void;
  onRequireSignIn?: () => void;
}

function PrebuiltCourseRow({
  test,
  subject,
  canLoad,
  onLoaded,
  onRequireSignIn,
}: {
  test: PrebuiltTestDefinition;
  subject: string;
  canLoad: boolean;
  onLoaded: (course: Course) => void;
  onRequireSignIn?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    if (!canLoad) {
      onRequireSignIn?.();
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingMessage("Loading…");

    try {
      setLoadingMessage(prebuiltLoadMessage("syllabus"));
      const course = await loadPrebuiltTest(test);
      onLoaded(course);
    } catch (err) {
      setError(
        err instanceof SyllabusParseError
          ? err.message
          : "Could not load this course.",
      );
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const meta = `Sample · ${test.syllabusFileName}, ${test.textbook.fileName}, course page`;

  return (
    <li className="space-y-2">
      <CourseRow
        title={test.title}
        subtitle={test.description}
        subjectTag={subject}
        meta={meta}
        university={test.university}
        professor={test.professor}
        onClick={() => void handleLoad()}
        disabled={isLoading}
        loadingLabel={isLoading ? loadingMessage || "Loading…" : undefined}
      />
      {error && (
        <p role="alert" className="px-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

function CourseListRow({
  entry,
  savedCourseIds,
  onSelectCourse,
  onSelectCatalogCourse,
}: {
  entry: Extract<CourseListEntry, { type: "course" }>;
  savedCourseIds: Set<string>;
  onSelectCourse: (courseId: string) => void;
  onSelectCatalogCourse: (course: Course) => void;
}) {
  const { course, subject } = entry;
  const { syllabus } = course;
  const sectionCount = syllabus.sections.length;
  const topicCount = countTopics(syllabus);
  const subtitle = [syllabus.courseCode, syllabus.term]
    .filter(Boolean)
    .join(" · ");
  const university = course.university ?? syllabus.university;
  const professor = course.professor ?? syllabus.professor;

  const handleClick = () => {
    if (savedCourseIds.has(course.id)) {
      onSelectCourse(course.id);
      return;
    }
    onSelectCatalogCourse(course);
  };

  return (
    <li>
      <CourseRow
        title={syllabus.courseTitle}
        subtitle={subtitle || undefined}
        subjectTag={subject}
        meta={`${sectionCount} sections · ${topicCount} topics`}
        university={university}
        professor={professor}
        onClick={handleClick}
      />
    </li>
  );
}

export function CourseList({
  courses,
  isAuthenticated,
  onSelectCourse,
  onPrebuiltLoaded,
  onSelectCatalogCourse,
  onRequireSignIn,
}: CourseListProps) {
  const [query, setQuery] = useState("");

  const allEntries = useMemo(() => buildCourseListEntries(courses), [courses]);
  const savedCourseIds = useMemo(
    () => new Set(courses.map((course) => course.id)),
    [courses],
  );
  const filteredEntries = useMemo(
    () => filterCourseListEntries(allEntries, query),
    [allEntries, query],
  );

  if (allEntries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-5 py-10 text-center">
        <p className="text-sm text-stone-500">
          No courses yet. Upload a syllabus to get started.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <label className="block">
        <span className="sr-only">Search courses</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by subject or course…"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none ring-honey-300 transition-shadow placeholder:text-stone-400 focus:ring-2"
        />
      </label>

      {filteredEntries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          No courses match your search.
        </p>
      ) : (
        <ul className="space-y-3">
          {filteredEntries.map((entry) =>
            entry.type === "prebuilt" ? (
              <PrebuiltCourseRow
                key={entry.test.id}
                test={entry.test}
                subject={entry.subject}
                canLoad={isAuthenticated && Boolean(onPrebuiltLoaded)}
                onLoaded={onPrebuiltLoaded ?? (() => {})}
                onRequireSignIn={onRequireSignIn}
              />
            ) : (
              <CourseListRow
                key={entry.course.id}
                entry={entry}
                savedCourseIds={savedCourseIds}
                onSelectCourse={onSelectCourse}
                onSelectCatalogCourse={onSelectCatalogCourse}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
