interface SignInPromptProps {
  onSignIn: () => void;
}

export function SignInPrompt({ onSignIn }: SignInPromptProps) {
  return (
    <div className="rounded-2xl border border-honey-200 bg-honey-50/80 px-5 py-4">
      <p className="text-sm font-medium text-stone-900">Sign in to save courses</p>
      <p className="mt-1 text-sm text-stone-600">
        Create a free account to keep your syllabi synced to your profile.
      </p>
      <button
        type="button"
        onClick={onSignIn}
        className="mt-3 rounded-lg bg-honey-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-honey-800"
      >
        Sign in or create account
      </button>
    </div>
  );
}
