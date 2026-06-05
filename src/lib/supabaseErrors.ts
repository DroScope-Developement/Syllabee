import type { PostgrestError } from "@supabase/supabase-js";

export function formatSupabaseError(error: PostgrestError | Error): string {
  if ("code" in error) {
    if (error.code === "PGRST205") {
      return "Database not set up yet. Run the migration in supabase/migrations/ on your Supabase project.";
    }
    if (error.code === "42501") {
      return "You don't have permission to save courses. Try signing out and back in.";
    }
    if (error.message) return error.message;
  }

  return error.message || "Something went wrong. Please try again.";
}
