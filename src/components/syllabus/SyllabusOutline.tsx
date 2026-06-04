import type { SyllabusOutlineData } from "../../types/syllabus";
import { SyllabusSection } from "./SyllabusSection";

interface SyllabusOutlineProps {
  data: SyllabusOutlineData;
}

export function SyllabusOutline({ data }: SyllabusOutlineProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8">
        <p className="mb-1 text-sm font-medium uppercase tracking-widest text-honey-600">
          Course outline
        </p>
        <h1 className="font-serif text-3xl text-stone-900 sm:text-4xl">
          {data.courseTitle}
        </h1>
        {(data.courseCode || data.term) && (
          <p className="mt-2 text-base text-stone-500">
            {[data.courseCode, data.term].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-500">
          Expand any section or topic to explore summaries from Wikipedia, Khan
          Academy, OpenStax, and MIT OpenCourseWare.
        </p>
      </header>

      <div className="space-y-4">
        {data.sections.map((section, index) => (
          <SyllabusSection
            key={section.id}
            section={section}
            index={index}
            defaultExpanded={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

export { SyllabusSection } from "./SyllabusSection";
export { SubpointRow } from "./SubpointRow";
export { TopicSummaryPanel } from "./TopicSummaryPanel";
