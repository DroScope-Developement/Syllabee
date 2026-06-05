import { useCallback, useEffect, useState } from "react";
import { CoursesView } from "./components/courses/CoursesView";
import { AppShell } from "./components/layout/AppShell";
import type { NavTab } from "./components/layout/navItems";
import { ProfileView } from "./components/profile/ProfileView";
import { useAuth } from "./context/AuthContext";
import { fetchUserCourses, saveCourse } from "./services/coursesRepository";
import { normalizeCourseForDisplay } from "./services/normalizeCourse";
import type { Course } from "./types/course";

function TabContent({
  tab,
  courses,
  coursesLoading,
  coursesError,
  selectedCourseId,
  isAuthenticated,
  onSelectCourse,
  onCourseAdded,
  onRequireSignIn,
}: {
  tab: NavTab;
  courses: Course[];
  coursesLoading: boolean;
  coursesError: string | null;
  selectedCourseId: string | null;
  isAuthenticated: boolean;
  onSelectCourse: (courseId: string | null) => void;
  onCourseAdded: (course: Course, options?: { save?: boolean }) => Promise<void>;
  onRequireSignIn: () => void;
}) {
  switch (tab) {
    case "courses":
      return (
        <CoursesView
          courses={courses}
          coursesLoading={coursesLoading}
          coursesError={coursesError}
          selectedCourseId={selectedCourseId}
          isAuthenticated={isAuthenticated}
          onSelectCourse={onSelectCourse}
          onCourseAdded={onCourseAdded}
          onRequireSignIn={onRequireSignIn}
        />
      );
    case "profile":
      return <ProfileView />;
  }
}

export default function App() {
  const { user, isConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAuthenticated = Boolean(user);

  useEffect(() => {
    if (!user || !isConfigured) {
      setCourses([]);
      setSelectedCourseId(null);
      setCoursesError(null);
      return;
    }

    let cancelled = false;
    setCoursesLoading(true);
    setCoursesError(null);

    fetchUserCourses()
      .then((loaded) => {
        if (!cancelled) setCourses(loaded);
      })
      .catch((err) => {
        if (!cancelled) {
          setCoursesError(
            err instanceof Error ? err.message : "Could not load your courses.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, isConfigured]);

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab !== "courses") {
      setSelectedCourseId(null);
    }
  };

  const handleRequireSignIn = useCallback(() => {
    setActiveTab("profile");
  }, []);

  const handleCourseAdded = useCallback(
    async (course: Course, options?: { save?: boolean }) => {
      const shouldSave = options?.save ?? Boolean(user);

      if (shouldSave && !user) {
        handleRequireSignIn();
        return;
      }

      const previousCourses = courses;
      const previousSelection = selectedCourseId;

      setCourses((prev) => {
        const withoutDuplicate = course.prebuiltTestId
          ? prev.filter((c) => c.prebuiltTestId !== course.prebuiltTestId)
          : course.catalogId
            ? prev.filter((c) => c.catalogId !== course.catalogId)
            : prev;
        return [normalizeCourseForDisplay(course), ...withoutDuplicate];
      });
      setSelectedCourseId(course.id);
      setSaveError(null);

      if (!shouldSave) {
        return;
      }

      try {
        await saveCourse(normalizeCourseForDisplay(course));
      } catch (err) {
        setCourses(previousCourses);
        setSelectedCourseId(previousSelection);
        setSaveError(
          err instanceof Error ? err.message : "Could not save this course.",
        );
      }
    },
    [user, handleRequireSignIn, courses, selectedCourseId],
  );

  const displayError = saveError ?? coursesError;

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
      {displayError && (
        <div className="mx-auto mb-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}
      <TabContent
        tab={activeTab}
        courses={courses}
        coursesLoading={coursesLoading}
        coursesError={coursesError}
        selectedCourseId={selectedCourseId}
        isAuthenticated={isAuthenticated}
        onSelectCourse={setSelectedCourseId}
        onCourseAdded={handleCourseAdded}
        onRequireSignIn={handleRequireSignIn}
      />
    </AppShell>
  );
}
