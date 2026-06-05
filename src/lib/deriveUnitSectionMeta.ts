import type { UnitHandoutContent } from "./pdf/parseHandoutContent";
import {
  buildHandoutSectionDescription,
  formatHandoutText,
  isBoilerplateHandoutText,
  sanitizeHandoutContent,
} from "./pdf/formatHandoutText";

const GENERIC_TITLE_PATTERNS = [
  /^Lecture notes$/i,
  /^Practice worksheet$/i,
  /^INTRODUCTION TO CALCULUS$/i,
  /^MATH 1A$/i,
  /^SINGLE VARIABLE CALCULUS$/i,
  /^Unit \d+: Worksheet$/i,
  /^Homework\b/i,
  /^[\d\s−+\-x.]+$/i,
];

const DESCRIPTOR_PATTERNS: Array<{ pattern: RegExp; descriptor: string }> = [
  { pattern: /Hospital'?s rule/i, descriptor: "Hospital's Rule" },
  { pattern: /linear\s*approximation|linearization/i, descriptor: "Linear Approximation" },
  { pattern: /critical\s+points?/i, descriptor: "Critical Points" },
  { pattern: /related\s+rates/i, descriptor: "Related Rates" },
  { pattern: /about\s+infinity|lecture is about infinity/i, descriptor: "Infinity" },
  { pattern: /extremiz/i, descriptor: "Extremization" },
  { pattern: /intermediate\s+value\s+theorem/i, descriptor: "Intermediate Value Theorem" },
  { pattern: /Riemann\s+(?:integrals?|sums?)/i, descriptor: "Riemann Integrals" },
  { pattern: /fundamental\s+theorem/i, descriptor: "Fundamental Theorem" },
  { pattern: /anti[\s-]?derivatives?/i, descriptor: "Anti Derivatives" },
  { pattern: /partial\s+fractions?/i, descriptor: "Partial Fractions" },
  { pattern: /integration\s+by\s+parts/i, descriptor: "Integration by Parts" },
  { pattern: /chain\s+rule/i, descriptor: "Chain Rule" },
  { pattern: /squeeze\s+theorem/i, descriptor: "Squeeze Theorem" },
  { pattern: /continuity/i, descriptor: "Continuity" },
  { pattern: /derivative\s+rules?/i, descriptor: "Derivative Rules" },
];

export function isGenericHandoutTitle(title: string): boolean {
  const cleaned = formatHandoutText(title);
  if (!cleaned || cleaned.length < 3) return true;
  return GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function parseSectionUnitNumber(sectionId: string): number | undefined {
  const match = sectionId.match(/unit-(\d+)/i);
  if (!match) return undefined;
  return parseInt(match[1], 10);
}

function formatUnitTitle(unitNumber: number, descriptor: string): string {
  return `Unit ${unitNumber}: ${descriptor}`;
}

function parseFullUnitTitle(title: string): string | undefined {
  const match = formatHandoutText(title).match(/^Unit\s+(\d+)\s*:\s*(.+)$/i);
  if (!match) return undefined;

  const descriptor = match[2].trim();
  if (isGenericHandoutTitle(descriptor) || /^Worksheet$/i.test(descriptor)) {
    return undefined;
  }

  return formatUnitTitle(parseInt(match[1], 10), descriptor);
}

function normalizeCorpus(text: string): string {
  return text.replace(/[\u2018\u2019`´]/g, "'");
}

function collectHandoutText(content: UnitHandoutContent): string {
  return normalizeCorpus(
    [
      content.title,
      content.summary,
      ...content.topics.map((topic) => topic.text),
      ...content.problems.map((problem) => problem.text),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function inferDescriptorFromContent(content: UnitHandoutContent): string | undefined {
  const corpus = collectHandoutText(content);

  const source = content.summary ?? content.topics[0]?.text;
  if (source && !isBoilerplateHandoutText(source)) {
    const cleaned = normalizeCorpus(formatHandoutText(source));
    const aboutMatch = cleaned.match(/\b(?:about|on)\s+(.{4,40}?)[.,!]/i);
    if (aboutMatch?.[1]) {
      const phrase = aboutMatch[1].trim();
      return phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
  }

  for (const { pattern, descriptor } of DESCRIPTOR_PATTERNS) {
    if (pattern.test(corpus)) return descriptor;
  }

  const calledMatch = corpus.match(
    /\bcalled\s+(?:a|an|the)?\s*([a-z][a-z \-']{3,40})/i,
  );
  if (calledMatch?.[1]) {
    const phrase = formatHandoutText(calledMatch[1]);
    if (phrase.length >= 4 && !isBoilerplateHandoutText(phrase)) {
      return phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
  }

  if (!source || isBoilerplateHandoutText(source)) return undefined;

  const cleaned = normalizeCorpus(formatHandoutText(source));
  const phraseMatch = cleaned.match(
    /^([A-Za-z''\- ]{4,45}?)\s+(?:is|are|was|were|problems|problem|allows|lets)\b/i,
  );
  if (phraseMatch?.[1]) {
    const phrase = phraseMatch[1].trim();
    if (!isBoilerplateHandoutText(phrase)) {
      return phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
  }

  return undefined;
}

export function deriveUnitSectionTitle(
  unitNumber: number,
  fallbackTitle: string,
  lecture?: UnitHandoutContent,
  worksheet?: UnitHandoutContent,
): string {
  const titledCandidates: string[] = [];

  for (const content of [lecture, worksheet]) {
    if (!content?.title) continue;

    const fullTitle = parseFullUnitTitle(content.title);
    if (fullTitle) {
      titledCandidates.push(fullTitle);
      continue;
    }

    const cleanedTitle = formatHandoutText(content.title);
    if (!isGenericHandoutTitle(cleanedTitle)) {
      titledCandidates.push(formatUnitTitle(unitNumber, cleanedTitle));
    }
  }

  const bestFullTitle = titledCandidates.find(
    (title) => !/^Unit \d+: Worksheet$/i.test(title),
  );
  if (bestFullTitle) return bestFullTitle;

  for (const content of [lecture, worksheet]) {
    if (!content) continue;
    const inferred = inferDescriptorFromContent(content);
    if (inferred) return formatUnitTitle(unitNumber, inferred);
  }

  const fallbackFullTitle = parseFullUnitTitle(fallbackTitle);
  if (fallbackFullTitle) return fallbackFullTitle;

  return `Unit ${unitNumber}`;
}

function mergeDescriptions(...descriptions: Array<string | undefined>): string | undefined {
  const parts: string[] = [];

  for (const description of descriptions) {
    if (!description) continue;
    if (parts.includes(description)) continue;
    parts.push(description);
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function buildSectionMetaFromHandouts(
  unitNumber: number,
  fallbackTitle: string,
  lectureRaw?: UnitHandoutContent,
  worksheetRaw?: UnitHandoutContent,
): { title: string; description?: string } {
  const lecture = lectureRaw ? sanitizeHandoutContent(lectureRaw) : undefined;
  const worksheet = worksheetRaw ? sanitizeHandoutContent(worksheetRaw) : undefined;

  return {
    title: deriveUnitSectionTitle(unitNumber, fallbackTitle, lecture, worksheet),
    description: mergeDescriptions(
      lecture ? buildHandoutSectionDescription(lecture) : undefined,
      worksheet ? buildHandoutSectionDescription(worksheet) : undefined,
    ),
  };
}
