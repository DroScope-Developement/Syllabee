import type { SyllabusOutlineData } from "../../types/syllabus";
import { SyllabusSection } from "./SyllabusSection";

interface SyllabusOutlineProps {
  data: SyllabusOutlineData;
  /** Shown when syllabus was loaded via upload or example fixture. */
  sourceLabel?: string;
  /** Prebuilt courses show parsed lecture/worksheet content instead of open-source links. */
  showHandoutContent?: boolean;
}

export function SyllabusOutline({
  data,
  sourceLabel,
  showHandoutContent = false,
}: SyllabusOutlineProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium uppercase tracking-widest text-honey-600">
            Course outline
          </p>
          {sourceLabel && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
              {sourceLabel}
            </span>
          )}
        </div>
        <h1 className="font-serif text-3xl text-stone-900 sm:text-4xl">
          {data.courseTitle}
        </h1>
        {(data.courseCode || data.term) && (
          <p className="mt-2 text-base text-stone-500">
            {[data.courseCode, data.term].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-500">
          {showHandoutContent
            ? "Expand a unit to read parsed lecture notes, practice problems, and key topics from each handout."
            : "Expand any section or topic to explore summaries from Wikipedia, Khan Academy, OpenStax, and MIT OpenCourseWare."}
        </p>
      </header>

      <div className="space-y-4">
        {data.sections.map((section, index) => (
          <SyllabusSection
            key={section.id}
            section={section}
            index={index}
            defaultExpanded={false}
          />
        ))}
      </div>
    </div>
  );
}

export { SyllabusSection } from "./SyllabusSection";
export { SubpointRow } from "./SubpointRow";
export { TopicSummaryPanel } from "./TopicSummaryPanel";
