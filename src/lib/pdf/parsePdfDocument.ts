import { extractSyllabusMetadata } from "./extractSyllabusMetadata";
import { SyllabusParseError } from "../syllabusErrors";
import type { SyllabusOutlineData, SyllabusSection } from "../../types/syllabus";
import { LINE_GAP_LARGE } from "./types";
import type { ClassifiedLine, LineTier, PdfLine } from "./types";

const COURSE_CODE = /\b([A-Z]{2,5}\s*\d{1,4}[A-Z]?)\b/;
const TERM = /\b((?:fall|spring|summer|winter)\s+\d{4})\b/i;
const EMAIL = /@/;
const FOOTER_HINT = /\b(knill@|harvard\.edu)\b/i;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * sorted.length)),
  );
  return sorted[index];
}

function samePageGaps(lines: ClassifiedLine[]): number[] {
  return lines
    .slice(1)
    .filter((line, index) => line.page === lines[index].page && line.gapAbove > 0)
    .map((line) => line.gapAbove);
}

function effectiveGap(line: ClassifiedLine, medianGap: number): number {
  if (line.gapAbove <= 0) return 0;
  if (line.gapAbove > medianGap * 4) return medianGap;
  return line.gapAbove;
}

function trimRunPreamble(run: ClassifiedLine[]): ClassifiedLine[] {
  const med = median(samePageGaps(run)) || 14;
  const threshold = med * LINE_GAP_LARGE;

  for (let i = 0; i < run.length - 1; i++) {
    const next = run[i + 1];
    const nextGap =
      next.page !== run[i].page ? med : effectiveGap(next, med);
    if (nextGap >= threshold) {
      return run.slice(i + 1);
    }
  }

  return run;
}

function slugify(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base ? `${base}-${index}` : `item-${index}`;
}

function isProseLine(line: PdfLine): boolean {
  if (line.wordCount > 22) return true;
  if (line.wordCount > 14 && /[.!?,;]$/.test(line.text)) return true;
  if (EMAIL.test(line.text)) return true;
  if (FOOTER_HINT.test(line.text)) return true;
  return false;
}

function classifyLines(lines: PdfLine[]): ClassifiedLine[] {
  const fontSizes = lines.map((line) => line.fontSize);
  const p50 = percentile(fontSizes, 0.5);
  const p75 = percentile(fontSizes, 0.75);
  const p90 = percentile(fontSizes, 0.9);

  return lines.map((line) => {
    let tier: LineTier = "body";
    if (line.fontSize >= p90) tier = "title";
    else if (line.fontSize >= p75) tier = "heading";
    else if (line.fontSize < p50 * 0.85) tier = "minor";

    return {
      ...line,
      tier,
      isProse: isProseLine(line),
    };
  });
}

function lineSignature(line: PdfLine): string {
  const xBucket = Math.round(line.x / 20) * 20;
  const fsBucket = Math.round(line.fontSize);
  return `${fsBucket}|${xBucket}|${line.wordCount > 12 ? "long" : "short"}`;
}

function scoreOutlineRun(run: ClassifiedLine[]): number {
  if (run.length === 0) return 0;
  const proseRatio = run.filter((line) => line.isProse).length / run.length;
  const colonRatio =
    run.filter((line) => line.text.includes(":")).length / run.length;
  return run.length * (1 - proseRatio * 2) * (1 + colonRatio * 2);
}

/** Finds typographically similar runs; prefers curriculum-like sequences over admin prose. */
function findOutlineRuns(lines: ClassifiedLine[]): ClassifiedLine[][] {
  if (lines.length < 3) return [];

  const candidates: ClassifiedLine[][] = [];
  let run: ClassifiedLine[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    const sameSignature = lineSignature(prev) === lineSignature(curr);
    const pageBreak = curr.page !== prev.page;

    if (sameSignature || pageBreak) {
      run.push(curr);
    } else {
      if (run.length >= 3) candidates.push(run);
      run = [curr];
    }
  }
  if (run.length >= 3) candidates.push(run);

  return candidates.sort((a, b) => scoreOutlineRun(b) - scoreOutlineRun(a));
}

function buildFromVisualHierarchy(run: ClassifiedLine[]): SyllabusSection[] {
  const med = median(samePageGaps(run)) || 14;
  const threshold = med * LINE_GAP_LARGE;
  const sections: SyllabusSection[] = [];
  let current: SyllabusSection | null = null;

  for (const line of run) {
    if (line.isProse || line.text.length < 2) continue;

    const isSectionStart = !current || line.gapAbove >= threshold;

    if (isSectionStart) {
      const sectionId = slugify(line.text, sections.length + 1);
      current = {
        id: sectionId,
        title: stripListMarker(line.text),
        subpoints: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) continue;

    current.subpoints.push({
      id: `${current.id}-topic-${current.subpoints.length + 1}`,
      title: stripListMarker(extractTopicLabel(line.text)),
    });
  }

  return sections.filter((section) => section.subpoints.length > 0);
}

function buildOutlineFromRun(run: ClassifiedLine[]): SyllabusSection[] {
  const med = median(samePageGaps(run)) || 14;
  const threshold = med * LINE_GAP_LARGE;
  const colonRatio =
    run.filter((line) => line.text.includes(":")).length / run.length;
  const hasSectionGaps = run.slice(1).some((line) => line.gapAbove >= threshold);
  const flatColonSchedule =
    colonRatio >= 0.75 || (colonRatio >= 0.45 && !hasSectionGaps);

  if (flatColonSchedule) {
    return buildFromFlatSchedule(run);
  }

  return buildFromVisualHierarchy(run);
}

/**
 * Pulls a human topic label from a line by splitting on colons and taking the
 * most informative trailing segment (works for schedules, outlines, etc.).
 */
export function extractTopicLabel(text: string): string {
  const segments = text
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length === 0) return text.trim();
  if (segments.length === 1) return segments[0];

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (segment.length >= 3 && segment.split(/\s+/).length <= 12) {
      return segment;
    }
  }

  return segments[segments.length - 1];
}

function stripListMarker(text: string): string {
  return text.replace(/^[\s•\-*◦▪–—]+/, "").replace(/^\d+[.)]\s*/, "").trim();
}

function inferMetadata(lines: ClassifiedLine[]): {
  courseCode?: string;
  term?: string;
} {
  const early = lines.slice(0, 20).map((line) => line.text);
  let courseCode: string | undefined;
  let term: string | undefined;

  for (const text of early) {
    if (!courseCode) {
      const match = text.match(COURSE_CODE);
      if (match) courseCode = match[1].replace(/\s+/g, " ").trim();
    }
    if (!term) {
      const match = text.match(TERM);
      if (match) term = match[1];
    }
  }

  return { courseCode, term };
}

function buildFromFlatSchedule(run: ClassifiedLine[]): SyllabusSection[] {
  return run
    .filter((line) => !line.isProse && line.text.length >= 3)
    .map((line, index) => {
      const topic = extractTopicLabel(line.text);
      return {
        id: slugify(topic, index + 1),
        title: topic,
        subpoints: [
          {
            id: slugify(topic, index + 1) + "-detail",
            title: stripListMarker(line.text),
          },
        ],
      };
    });
}

function buildFromProminence(lines: ClassifiedLine[]): SyllabusSection[] {
  const content = lines.filter((line) => !line.isProse && line.wordCount >= 2);
  const sections: SyllabusSection[] = [];
  let current: SyllabusSection | null = null;
  let sectionIndex = 0;

  for (const line of content) {
    const isHeading =
      line.tier === "heading" ||
      line.tier === "title" ||
      (line.gapAbove > median(content.map((l) => l.gapAbove).filter((g) => g > 0)) * LINE_GAP_LARGE &&
        line.wordCount <= 12);

    if (isHeading || !current) {
      sectionIndex += 1;
      current = {
        id: `section-${sectionIndex}`,
        title: stripListMarker(line.text),
        subpoints: [],
      };
      sections.push(current);
      continue;
    }

    current.subpoints.push({
      id: `${current.id}-topic-${current.subpoints.length + 1}`,
      title: stripListMarker(extractTopicLabel(line.text)),
    });
  }

  return sections.filter((s) => s.subpoints.length > 0 || s.title.length >= 3);
}

function selectOutlineBlock(lines: ClassifiedLine[]): ClassifiedLine[] | null {
  const runs = findOutlineRuns(lines.filter((line) => !line.isProse));
  if (runs.length === 0) return null;

  const trimmed = trimRunPreamble(runs[0]);
  return trimmed.length >= 3 ? trimmed : null;
}

/**
 * Parses reconstructed PDF lines into syllabus outline data using layout and
 * typography — not format-specific markers like "Week 1" or bullet styles.
 */
export function parsePdfLines(
  lines: PdfLine[],
  options?: { fileName?: string; catalogSubject?: string; catalogTitle?: string },
): SyllabusOutlineData {
  if (lines.length === 0) {
    throw new SyllabusParseError(
      "No readable text found in this PDF.",
    );
  }

  const classified = classifyLines(lines);
  const { courseCode, term } = inferMetadata(classified);
  const { courseTitle, university, professor } = extractSyllabusMetadata(
    lines,
    options,
  );

  const outlineRun = selectOutlineBlock(classified);
  let sections: SyllabusSection[] = [];

  if (outlineRun) {
    sections = buildOutlineFromRun(outlineRun);
  }

  if (sections.length === 0) {
    sections = buildFromProminence(classified);
  }

  const validSections = sections.filter(
    (section) => section.title.length >= 2 && section.subpoints.length > 0,
  );

  if (validSections.length === 0) {
    throw new SyllabusParseError(
      "Could not infer a course outline from this PDF's text and layout.",
    );
  }

  return {
    courseTitle,
    courseCode,
    term,
    university,
    professor,
    sections: validSections,
  };
}

/** Converts plain text (no layout) into synthetic lines for the same pipeline. */
export function plainTextToLines(text: string): PdfLine[] {
  const paragraphs = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  const lines: PdfLine[] = [];
  let y = 1000;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphLines = paragraph
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    paragraphLines.forEach((trimmed, lineIndex) => {
      const gapAbove =
        lines.length === 0
          ? 0
          : lineIndex === 0
            ? 32
            : 14;

      y -= gapAbove;
      lines.push({
        page: 1,
        y,
        x: 72,
        fontSize: 12,
        text: trimmed,
        items: [],
        gapAbove,
        wordCount: trimmed.split(/\s+/).filter(Boolean).length,
      });
    });

    if (paragraphLines.length === 0 && paragraphIndex > 0) {
      y -= 32;
    }
  });

  return lines;
}

export function parseSyllabusText(
  text: string,
  options?: { fileName?: string; catalogSubject?: string; catalogTitle?: string },
): SyllabusOutlineData {
  return parsePdfLines(plainTextToLines(text), options);
}
