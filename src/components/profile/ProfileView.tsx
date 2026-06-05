import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { AuthForm } from "../auth/AuthForm";

export function ProfileView() {
  const { user, isConfigured, loading, signIn, signUp, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-stone-500">Loading your account…</p>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 sm:px-6">
        <ProfileHeader />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-medium">Supabase not configured</p>
          <p className="mt-1 text-amber-800/90">
            Add <code className="rounded bg-white/60 px-1">VITE_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-white/60 px-1">VITE_SUPABASE_ANON_KEY</code> to a{" "}
            <code className="rounded bg-white/60 px-1">.env</code> file, then run the migration in{" "}
            <code className="rounded bg-white/60 px-1">supabase/migrations/</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 px-4 sm:px-6">
        <ProfileHeader
          subtitle="Create an account or sign in to save courses across devices."
        />
        <AuthForm onSignIn={signIn} onSignUp={signUp} />
      </div>
    );
  }

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6">
      <ProfileHeader subtitle="Your account is connected. Courses you add are saved automatically." />

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-honey-100 text-sm font-bold text-honey-800">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-stone-900">{user.email}</p>
            <p className="mt-0.5 text-sm text-stone-500">Signed in</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={isSigningOut}
          className="mt-5 w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50 disabled:opacity-60"
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>

        {signOutError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {signOutError}
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <p className="text-sm font-medium uppercase tracking-widest text-honey-600">
        Account
      </p>
      <h2 className="mt-1 font-serif text-2xl text-stone-900">Profile</h2>
      {subtitle && (
        <p className="mt-2 text-sm text-stone-500">{subtitle}</p>
      )}
    </div>
  );
}
