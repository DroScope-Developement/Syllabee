import { useId, useState } from "react";
import type { SyllabusSection as SyllabusSectionData } from "../../types/syllabus";
import { SubpointRow } from "./SubpointRow";

interface SyllabusSectionProps {
  section: SyllabusSectionData;
  index: number;
  defaultExpanded?: boolean;
}

function sectionUnitLabel(section: SyllabusSectionData, index: number): string {
  const match = section.id.match(/unit-(\d+)/i);
  if (match) return String(parseInt(match[1], 10));
  return String(index + 1);
}

export function SyllabusSection({
  section,
  index,
  defaultExpanded = index === 0,
}: SyllabusSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();
  const unitLabel = sectionUnitLabel(section, index);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-honey-50/40"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-honey-100 text-sm font-bold text-honey-800">
          {unitLabel}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg text-stone-900">{section.title}</h3>
          {!expanded && section.description && (
            <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-stone-500">
              {section.description}
            </p>
          )}
        </div>

        <svg
          className={`mt-1.5 h-5 w-5 shrink-0 text-stone-400 transition-transform duration-300 ease-out ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div
        id={contentId}
        className="grid border-t border-stone-100 transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        aria-hidden={!expanded}
      >
        <div className="overflow-hidden">
          {section.description && (
            <div className="border-b border-stone-100 px-5 py-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-500">
                {section.description}
              </p>
            </div>
          )}

          <ul className="space-y-0.5 px-2 py-3">
            {section.subpoints.map((subpoint) => (
              <SubpointRow key={subpoint.id} subpoint={subpoint} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
