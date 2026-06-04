import { useCallback, useEffect, useId, useState } from "react";
import type { SyllabusSubpoint, TopicSummary } from "../../types/syllabus";
import { fetchTopicSummaries } from "../../services/topicSummaries";
import { TopicSummaryPanel } from "./TopicSummaryPanel";

interface SubpointRowProps {
  subpoint: SyllabusSubpoint;
  depth?: number;
  defaultExpanded?: boolean;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-300 ease-out ${
        expanded ? "rotate-90" : "rotate-0"
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function SubpointRow({
  subpoint,
  depth = 0,
  defaultExpanded = false,
}: SubpointRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [summaries, setSummaries] = useState<TopicSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const panelId = useId();
  const hasChildren = (subpoint.children?.length ?? 0) > 0;

  const loadSummaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchTopicSummaries(subpoint.title);
      setSummaries(result.summaries);
      setHasFetched(true);
    } catch {
      setError("Something went wrong while fetching resources.");
    } finally {
      setIsLoading(false);
    }
  }, [subpoint.title]);

  useEffect(() => {
    if (expanded && !hasFetched && !hasChildren) {
      void loadSummaries();
    }
  }, [expanded, hasFetched, hasChildren, loadSummaries]);

  const toggle = () => setExpanded((prev) => !prev);

  const paddingLeft = depth === 0 ? "pl-4" : depth === 1 ? "pl-8" : "pl-12";

  return (
    <li className="list-none">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`group flex w-full items-start gap-2 rounded-lg py-2.5 pr-3 text-left transition-colors hover:bg-honey-50/60 ${paddingLeft}`}
      >
        <ChevronIcon expanded={expanded} />
        <span
          className={`text-sm leading-snug transition-colors ${
            depth === 0
              ? "font-medium text-stone-800 group-hover:text-stone-900"
              : "text-stone-600 group-hover:text-stone-800"
          }`}
        >
          {subpoint.title}
        </span>
      </button>

      <div
        id={panelId}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {!hasChildren && (
            <div className={`pb-2 ${paddingLeft} pr-3`}>
              <TopicSummaryPanel
                topic={subpoint.title}
                summaries={summaries}
                isLoading={isLoading}
                error={error}
              />
            </div>
          )}

          {hasChildren && (
            <ul className={`space-y-0.5 pb-2 ${paddingLeft}`}>
              {subpoint.children!.map((child) => (
                <SubpointRow
                  key={child.id}
                  subpoint={child}
                  depth={depth + 1}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
