import { useCallback, useEffect, useState } from "react";
import { CoursesView } from "./components/courses/CoursesView";
import { AppShell } from "./components/layout/AppShell";
import type { NavTab } from "./components/layout/navItems";
import { PlaceholderView } from "./components/layout/PlaceholderView";
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
  onCourseAdded: (course: Course) => Promise<void>;
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
    case "explore":
      return (
        <PlaceholderView
          icon="explore"
          title="Explore topics"
          description="Search open-source resources across Wikipedia, Khan Academy, OpenStax, and more."
        />
      );
    case "saved":
      return (
        <PlaceholderView
          icon="saved"
          title="Saved resources"
          description="Bookmark summaries and articles to revisit while you study."
        />
      );
    case "profile":
      return <ProfileView />;
  }
}

export default function App() {
  const { user, loading: authLoading, isConfigured } = useAuth();
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
    async (course: Course) => {
      if (!user) {
        handleRequireSignIn();
        return;
      }

      const previousCourses = courses;
      const previousSelection = selectedCourseId;

      setCourses((prev) => {
        const withoutDuplicate = course.prebuiltTestId
          ? prev.filter((c) => c.prebuiltTestId !== course.prebuiltTestId)
          : prev;
        return [normalizeCourseForDisplay(course), ...withoutDuplicate];
      });
      setSelectedCourseId(course.id);
      setSaveError(null);

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
    <AppShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      userEmail={user?.email ?? null}
      authLoading={authLoading}
      onProfileClick={() => handleTabChange("profile")}
    >
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
