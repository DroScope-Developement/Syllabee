import type { HandoutKind, UnitHandoutContent } from "../../lib/pdf/parseHandoutContent";

interface UnitHandoutPanelProps {
  content: UnitHandoutContent | null;
  kind: HandoutKind;
  isLoading: boolean;
  error: string | null;
}

export function UnitHandoutPanel({
  content,
  kind,
  isLoading,
  error,
}: UnitHandoutPanelProps) {
  if (isLoading) {
    return (
      <div className="mt-3 rounded-xl border border-honey-200/60 bg-white/80 p-4">
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-honey-400 border-t-transparent" />
          Reading {kind === "lecture" ? "lecture notes" : "worksheet"}…
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
        {error}
      </div>
    );
  }

  if (!content) {
    return null;
  }

  const hasTopics = content.topics.length > 0;
  const hasProblems = content.problems.length > 0;
  const hasBullets = content.bullets.length > 0;

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-honey-200/60 bg-gradient-to-b from-white to-honey-50/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
            {content.kind === "lecture" ? "Lecture notes" : "Practice worksheet"}
          </p>
          <p className="mt-1 font-medium text-stone-900">{content.title}</p>
        </div>
        <a
          href={content.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-honey-800 transition-colors hover:border-honey-300 hover:bg-honey-50"
        >
          Open PDF
        </a>
      </div>

      {content.summary &&
        !(hasTopics && content.topics[0]?.text === content.summary) && (
        <p className="text-sm leading-relaxed text-stone-600">{content.summary}</p>
      )}

      {hasTopics && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Topics covered
          </h4>
          <ul className="space-y-2">
            {content.topics.map((topic) => (
              <li
                key={topic.label}
                className="rounded-lg border border-stone-100 bg-white px-3 py-2.5"
              >
                <span className="text-xs font-semibold text-honey-700">
                  {topic.label}
                </span>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  {topic.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasBullets && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Key points
          </h4>
          <ul className="space-y-1.5">
            {content.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex gap-2 text-sm leading-relaxed text-stone-600"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-honey-500" />
                {bullet}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasProblems && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            {content.kind === "lecture" ? "Homework problems" : "Practice problems"}
          </h4>
          <ul className="space-y-2">
            {content.problems.map((problem, problemIndex) => (
              <li
                key={`${problem.label}-${problemIndex}`}
                className="rounded-lg border border-stone-100 bg-white px-3 py-2.5"
              >
                <span className="text-xs font-semibold text-stone-700">
                  {problem.label}
                </span>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  {problem.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasTopics && !hasProblems && !hasBullets && !content.summary && (
        <p className="text-sm text-stone-500">
          No structured content could be extracted. Open the PDF for the full handout.
        </p>
      )}
    </div>
  );
}
