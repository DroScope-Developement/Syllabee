/** A leaf topic or nested subtopic within a syllabus section. */
export interface SyllabusSubpoint {
  id: string;
  title: string;
  /** Optional nested subtopics for deeper outlines. */
  children?: SyllabusSubpoint[];
}

/** A top-level syllabus section (e.g. "Unit 1: Limits"). */
export interface SyllabusSection {
  id: string;
  title: string;
  description?: string;
  subpoints: SyllabusSubpoint[];
}

/** Root shape for parsed syllabus JSON input. */
export interface SyllabusOutlineData {
  courseTitle: string;
  courseCode?: string;
  term?: string;
  sections: SyllabusSection[];
}

/** Known open-source educational source identifiers. */
export type SourceId =
  | "wikipedia"
  | "khan-academy"
  | "openstax"
  | "mit-ocw";

/** A summary card pulled from a single open-source resource. */
export interface TopicSummary {
  sourceId: SourceId;
  sourceName: string;
  excerpt: string;
  url: string;
}

/** Response shape from the topic summaries fetch layer. */
export interface TopicSummariesResult {
  topic: string;
  summaries: TopicSummary[];
}
