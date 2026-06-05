import { getSupabaseClient } from "../lib/supabaseClient";
import { normalizeCoursesForDisplay } from "./normalizeCourse";
import { formatSupabaseError } from "../lib/supabaseErrors";
import type { Course } from "../types/course";

export async function fetchUserCourses(): Promise<Course[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("courses")
    .select("data, added_at")
    .order("added_at", { ascending: false });

  if (error) throw new Error(formatSupabaseError(error));

  return normalizeCoursesForDisplay(
    (data ?? []).map((row) => row.data as Course),
  );
}

export async function saveCourse(course: Course): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(formatSupabaseError(userError));
  if (!user) throw new Error("You must be signed in to save courses.");

  if (course.prebuiltTestId) {
    const { error: deleteError } = await supabase
      .from("courses")
      .delete()
      .eq("prebuilt_test_id", course.prebuiltTestId);

    if (deleteError) throw new Error(formatSupabaseError(deleteError));
  }

  const { error } = await supabase.from("courses").upsert(
    {
      id: course.id,
      user_id: user.id,
      data: course,
      prebuilt_test_id: course.prebuiltTestId ?? null,
      added_at: course.addedAt,
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteCourse(courseId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error(formatSupabaseError(error));
}
