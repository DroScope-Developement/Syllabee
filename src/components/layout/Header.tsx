interface HeaderProps {
  title?: string;
  userEmail?: string | null;
  authLoading?: boolean;
  onProfileClick?: () => void;
}

export function Header({
  title = "Syllabee",
  userEmail,
  authLoading,
  onProfileClick,
}: HeaderProps) {
  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-honey-100 text-honey-800"
            aria-hidden
          >
            <svg
              className="h-4.5 w-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div>
            <p className="font-serif text-lg leading-none text-stone-900">
              {title}
            </p>
            <p className="text-[11px] text-stone-400">Learn smarter</p>
          </div>
        </div>

        {authLoading ? (
          <div className="h-9 w-9 animate-pulse rounded-full bg-stone-100" />
        ) : userEmail && initials ? (
          <button
            type="button"
            onClick={onProfileClick}
            aria-label="Open profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-honey-100 text-xs font-bold text-honey-800 transition-colors hover:bg-honey-200"
          >
            {initials}
          </button>
        ) : (
          <button
            type="button"
            onClick={onProfileClick}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-honey-800 transition-colors hover:bg-honey-50"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
