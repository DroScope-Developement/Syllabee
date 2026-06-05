import type { UnitHandoutContent } from "./parseHandoutContent";

const BOILERPLATE =
  /^(MATH 1A|INTRODUCTION TO CALCULUS|SINGLE VARIABLE CALCULUS)$/i;

/** Cleans PDF line-break artifacts and stray spacing. */
export function formatHandoutText(text: string): string {
  return text
    .replace(/(\w)-\s+(\w)/g, "$1$2")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isBoilerplateHandoutText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length === 0 || BOILERPLATE.test(trimmed);
}

export function truncateHandoutText(text: string, maxLength = 180): string {
  const cleaned = formatHandoutText(text);
  if (cleaned.length <= maxLength) return cleaned;
  const slice = cleaned.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function appendUniquePart(parts: string[], text: string): void {
  const cleaned = formatHandoutText(text);
  if (cleaned.length < 30 || isBoilerplateHandoutText(cleaned)) return;
  if (parts.some((part) => part === cleaned || part.endsWith(cleaned))) return;
  parts.push(cleaned);
}

/** Full handout text for section headers — never truncated. */
export function buildHandoutSectionDescription(
  content: UnitHandoutContent,
): string | undefined {
  const parts: string[] = [];

  if (content.summary) {
    appendUniquePart(parts, content.summary);
  }

  for (const topic of content.topics) {
    appendUniquePart(parts, topic.text);
  }

  for (const problem of content.problems) {
    appendUniquePart(parts, problem.text);
  }

  if (parts.length === 0) {
    for (const bullet of content.bullets) {
      appendUniquePart(parts, bullet);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function pickHandoutPreview(content: UnitHandoutContent): string | undefined {
  return buildHandoutSectionDescription(content);
}

export function sanitizeHandoutContent(
  content: UnitHandoutContent,
): UnitHandoutContent {
  const summary = content.summary && !isBoilerplateHandoutText(content.summary)
    ? formatHandoutText(content.summary)
    : undefined;

  const topics = content.topics.map((topic) => ({
    ...topic,
    text: formatHandoutText(topic.text),
  }));

  const problems = content.problems.map((problem) => ({
    ...problem,
    text: formatHandoutText(problem.text),
  }));

  const bullets = content.bullets.map(formatHandoutText);
  const figures = content.figures.map(formatHandoutText);

  const sanitized: UnitHandoutContent = {
    ...content,
    title: formatHandoutText(content.title),
    summary,
    topics,
    problems,
    bullets,
    figures,
  };

  if (
    sanitized.summary &&
    topics[0] &&
    formatHandoutText(sanitized.summary) === topics[0].text
  ) {
    sanitized.summary = undefined;
  }

  return sanitized;
}
