import { useMemo } from "react";
import { getCatalogCourseById } from "../../services/buildCatalogCourses";
import type { Course } from "../../types/course";
import { CourseDetail } from "./CourseDetail";
import { CourseList } from "./CourseList";
import { SignInPrompt } from "./SignInPrompt";

interface CoursesViewProps {
  courses: Course[];
  coursesLoading?: boolean;
  coursesError?: string | null;
  selectedCourseId: string | null;
  isAuthenticated: boolean;
  onSelectCourse: (courseId: string | null) => void;
  onCourseAdded: (course: Course, options?: { save?: boolean }) => Promise<void>;
  onRequireSignIn: () => void;
}

export function CoursesView({
  courses,
  coursesLoading,
  selectedCourseId,
  isAuthenticated,
  onSelectCourse,
  onCourseAdded,
  onRequireSignIn,
}: CoursesViewProps) {
  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return undefined;
    return (
      courses.find((c) => c.id === selectedCourseId) ??
      getCatalogCourseById(selectedCourseId)
    );
  }, [courses, selectedCourseId]);

  const handlePrebuiltLoaded = (course: Course) => {
    void onCourseAdded(course);
  };

  const handleSelectCatalogCourse = (course: Course) => {
    void onCourseAdded(course, { save: isAuthenticated });
  };

  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        onBack={() => onSelectCourse(null)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-stone-900">Courses</h2>
        <p className="mt-2 text-sm text-stone-500">
          {isAuthenticated
            ? "Browse courses by subject. Your saved courses appear alongside the syllabus library."
            : "Browse courses by subject. Sign in to save courses to your account."}
        </p>
      </div>

      {!isAuthenticated && <SignInPrompt onSignIn={onRequireSignIn} />}

      {coursesLoading ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center">
          <p className="text-sm text-stone-500">Loading your courses…</p>
        </div>
      ) : (
        <CourseList
          courses={courses}
          isAuthenticated={isAuthenticated}
          onSelectCourse={onSelectCourse}
          onPrebuiltLoaded={isAuthenticated ? handlePrebuiltLoaded : undefined}
          onSelectCatalogCourse={handleSelectCatalogCourse}
          onRequireSignIn={onRequireSignIn}
        />
      )}
    </div>
  );
}
