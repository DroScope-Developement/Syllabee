import type { Course } from "../../types/course";
import { courseSourceLabel } from "../../types/course";
import { SyllabusOutline } from "../syllabus/SyllabusOutline";
import { CourseInstitutionMeta, ProfessorAvatar } from "./CourseInstitutionMeta";
import { CourseResourcesPanel } from "./CourseResourcesPanel";

interface CourseDetailProps {
  course: Course;
  onBack: () => void;
}

export function CourseDetail({ course, onBack }: CourseDetailProps) {
  const university = course.university ?? course.syllabus.university;
  const professor = course.professor ?? course.syllabus.professor;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-honey-800"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        All courses
      </button>

      <div className="mb-6 flex items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4">
        <ProfessorAvatar professor={professor} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl text-stone-900">
            {course.syllabus.courseTitle}
          </h1>
          {[course.syllabus.courseCode, course.syllabus.term]
            .filter(Boolean)
            .length > 0 && (
            <p className="mt-1 text-sm text-stone-500">
              {[course.syllabus.courseCode, course.syllabus.term]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <CourseInstitutionMeta university={university} professor={professor} />
        </div>
      </div>

      {course.resources && (
        <CourseResourcesPanel resources={course.resources} />
      )}

      <SyllabusOutline
        data={course.syllabus}
        sourceLabel={courseSourceLabel(course)}
        showHandoutContent={course.source === "prebuilt"}
      />
    </div>
  );
}
