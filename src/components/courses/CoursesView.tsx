import { useState } from "react";
import type { Course } from "../../types/course";
import type { SyllabusLoadResult } from "../upload/SyllabusUpload";
import { SyllabusUpload } from "../upload/SyllabusUpload";
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
  onCourseAdded: (course: Course) => Promise<void>;
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
  const [showUpload, setShowUpload] = useState(false);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const handleAddCourseClick = () => {
    if (!isAuthenticated) {
      onRequireSignIn();
      return;
    }
    setShowUpload(true);
  };

  const handleSyllabusLoaded = (result: SyllabusLoadResult) => {
    if (!isAuthenticated) {
      onRequireSignIn();
      return;
    }

    const course: Course = {
      id: crypto.randomUUID(),
      syllabus: result.data,
      source: result.source,
      fileName: result.fileName,
      addedAt: Date.now(),
      university: result.data.university,
      professor: result.data.professor,
    };
    void onCourseAdded(course);
    setShowUpload(false);
  };

  const handlePrebuiltLoaded = (course: Course) => {
    void onCourseAdded(course);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-honey-600">
            Your courses
          </p>
          <h2 className="mt-1 font-serif text-2xl text-stone-900">Courses</h2>
          <p className="mt-2 text-sm text-stone-500">
            {isAuthenticated
              ? "Your syllabi are saved to your account."
              : "Sign in to save courses, or browse the sample below."}
          </p>
        </div>
        {!showUpload && (
          <button
            type="button"
            onClick={handleAddCourseClick}
            className="shrink-0 rounded-lg bg-honey-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-honey-800"
          >
            Add course
          </button>
        )}
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
          onRequireSignIn={onRequireSignIn}
        />
      )}

      {showUpload && isAuthenticated && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">
              Add a syllabus
            </h3>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
          <SyllabusUpload onSyllabusLoaded={handleSyllabusLoaded} compact />
        </div>
      )}
    </div>
  );
}
