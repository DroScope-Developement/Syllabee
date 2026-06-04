interface PlaceholderViewProps {
  title: string;
  description: string;
  icon: "courses" | "explore" | "saved" | "profile";
}

export function PlaceholderView({
  title,
  description,
  icon,
}: PlaceholderViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-honey-100 text-honey-700">
        <PlaceholderIcon icon={icon} />
      </div>
      <h2 className="font-serif text-2xl text-stone-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
        {description}
      </p>
    </div>
  );
}

function PlaceholderIcon({ icon }: { icon: PlaceholderViewProps["icon"] }) {
  const className = "h-7 w-7";

  switch (icon) {
    case "courses":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "explore":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case "saved":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      );
    case "profile":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
  }
}
