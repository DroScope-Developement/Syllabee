import { useState } from "react";
import { prebuiltTests } from "../../data/prebuilt/prebuiltTests";
import { SyllabusParseError } from "../../lib/syllabusErrors";
import { loadPrebuiltTest, prebuiltLoadMessage } from "../../services/loadPrebuiltTest";
import type { Course, ProfessorInfo, UniversityInfo } from "../../types/course";
import { countTopics } from "../../types/course";
import type { PrebuiltTestDefinition } from "../../types/prebuiltTest";
import {
  CourseInstitutionMeta,
  ProfessorAvatar,
} from "./CourseInstitutionMeta";

interface CourseListProps {
  courses: Course[];
  isAuthenticated: boolean;
  onSelectCourse: (courseId: string) => void;
  onPrebuiltLoaded?: (course: Course) => void;
  onRequireSignIn?: () => void;
}

interface CourseRowProps {
  title: string;
  subtitle?: string;
  meta: string;
  university?: UniversityInfo;
  professor?: ProfessorInfo;
  onClick: () => void;
  disabled?: boolean;
  loadingLabel?: string;
}

function CourseRow({
  title,
  subtitle,
  meta,
  university,
  professor,
  onClick,
  disabled,
  loadingLabel,
}: CourseRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition-all hover:border-honey-300 hover:shadow-sm disabled:cursor-wait disabled:opacity-70"
    >
      <ProfessorAvatar professor={professor} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-900 group-hover:text-honey-900">
          {loadingLabel ?? title}
        </p>
        {!loadingLabel && subtitle && (
          <p className="mt-0.5 truncate text-sm text-stone-500">{subtitle}</p>
        )}
        {!loadingLabel && (
          <CourseInstitutionMeta university={university} professor={professor} />
        )}
        <p className="mt-2 text-xs text-stone-400">{meta}</p>
      </div>

      <svg
        className="mt-1 h-5 w-5 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-honey-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function PrebuiltCourseRow({
  test,
  canLoad,
  onLoaded,
  onRequireSignIn,
}: {
  test: PrebuiltTestDefinition;
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

export function CourseList({
  courses,
  isAuthenticated,
  onSelectCourse,
  onPrebuiltLoaded,
  onRequireSignIn,
}: CourseListProps) {
  const loadedPrebuiltIds = new Set(
    courses.map((c) => c.prebuiltTestId).filter(Boolean),
  );
  const availablePrebuilt = prebuiltTests.filter(
    (test) => !loadedPrebuiltIds.has(test.id),
  );
  const isEmpty = courses.length === 0 && availablePrebuilt.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-5 py-10 text-center">
        <p className="text-sm text-stone-500">
          No courses yet. Upload a syllabus to get started.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {availablePrebuilt.map((test) => (
        <PrebuiltCourseRow
          key={test.id}
          test={test}
          canLoad={isAuthenticated && Boolean(onPrebuiltLoaded)}
          onLoaded={onPrebuiltLoaded ?? (() => {})}
          onRequireSignIn={onRequireSignIn}
        />
      ))}

      {courses.map((course) => {
        const { syllabus } = course;
        const sectionCount = syllabus.sections.length;
        const topicCount = countTopics(syllabus);
        const subtitle = [syllabus.courseCode, syllabus.term]
          .filter(Boolean)
          .join(" · ");
        const university = course.university ?? syllabus.university;
        const professor = course.professor ?? syllabus.professor;

        return (
          <li key={course.id}>
            <CourseRow
              title={syllabus.courseTitle}
              subtitle={subtitle || undefined}
              meta={`${sectionCount} sections · ${topicCount} topics`}
              university={university}
              professor={professor}
              onClick={() => onSelectCourse(course.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
