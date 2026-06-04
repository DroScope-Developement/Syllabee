import type { TopicSummariesResult } from "../types/syllabus";
import {
  getGenericSummaries,
  mockTopicSummaries,
} from "../data/mockTopicSummaries";

/**
 * Fetches aggregated topic summaries from open-source educational sources.
 *
 * **Plug in real APIs here:** Replace the mock lookup below with parallel
 * requests to Wikipedia REST API, Khan Academy content API, OpenStax catalog,
 * MIT OCW search, etc. Keep this function signature stable so UI components
 * don't need to change when data sources go live.
 *
 * @example
 * ```ts
 * const [wiki, khan, openstax] = await Promise.all([
 *   fetchWikipediaSummary(topic),
 *   fetchKhanAcademyResources(topic),
 *   fetchOpenStaxSections(topic),
 * ]);
 * return { topic, summaries: [...wiki, ...khan, ...openstax] };
 * ```
 */
export async function fetchTopicSummaries(
  topic: string,
): Promise<TopicSummariesResult> {
  // Simulate network latency so loading states are visible during development.
  await new Promise((resolve) => setTimeout(resolve, 350));

  const key = topic.trim().toLowerCase();
  const summaries = mockTopicSummaries[key] ?? getGenericSummaries(topic);

  return { topic, summaries };
}
