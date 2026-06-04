import type { SourceId, TopicSummary } from "../../types/syllabus";

const SOURCE_STYLES: Record<
  SourceId,
  { badge: string; dot: string }
> = {
  wikipedia: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-500",
  },
  "khan-academy": {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  openstax: {
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
    dot: "bg-amber-500",
  },
  "mit-ocw": {
    badge: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    dot: "bg-indigo-500",
  },
};

interface TopicSummaryPanelProps {
  topic: string;
  summaries: TopicSummary[];
  isLoading: boolean;
  error: string | null;
}

export function TopicSummaryPanel({
  topic,
  summaries,
  isLoading,
  error,
}: TopicSummaryPanelProps) {
  if (isLoading) {
    return (
      <div className="mt-3 rounded-xl border border-honey-200/60 bg-white/80 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-stone-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-honey-400 border-t-transparent" />
          Gathering resources for &ldquo;{topic}&rdquo;&hellip;
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-stone-100 p-4"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <div className="mb-2 h-4 w-24 rounded bg-stone-200" />
              <div className="mb-1.5 h-3 w-full rounded bg-stone-200" />
              <div className="h-3 w-4/5 rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        Could not load summaries: {error}
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
        No open-source resources found for &ldquo;{topic}&rdquo; yet.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-honey-200/60 bg-gradient-to-b from-white to-honey-50/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
        Open-source resources
      </p>
      <ul className="space-y-3">
        {summaries.map((summary) => {
          const styles = SOURCE_STYLES[summary.sourceId];
          return (
            <li
              key={`${summary.sourceId}-${summary.url}`}
              className="group rounded-lg border border-stone-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${styles.dot}`}
                  aria-hidden
                />
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles.badge}`}
                >
                  {summary.sourceName}
                </span>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-stone-600">
                {summary.excerpt}
              </p>
              <a
                href={summary.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-honey-700 transition-colors hover:text-honey-900"
              >
                Read full resource
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
