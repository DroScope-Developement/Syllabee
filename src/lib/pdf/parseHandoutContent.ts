import type { PdfLine } from "./types";
import {
  formatHandoutText,
  isBoilerplateHandoutText,
} from "./formatHandoutText";

export type HandoutKind = "lecture" | "worksheet";

export interface HandoutTopic {
  /** e.g. "1.1" */
  label: string;
  text: string;
}

export interface HandoutProblem {
  label: string;
  text: string;
}

export interface UnitHandoutContent {
  title: string;
  kind: HandoutKind;
  sourceUrl: string;
  /** Short preview — first substantive paragraph. */
  summary?: string;
  topics: HandoutTopic[];
  problems: HandoutProblem[];
  bullets: string[];
  figures: string[];
}

const FOOTER = /knill@math\.harvard\.edu/i;
const COURSE_HEADER = /^(MATH 1A|INTRODUCTION TO CALCULUS|SINGLE VARIABLE CALCULUS)$/i;
const NUMBERED_TOPIC = /^(\d+\.\d+)\.\s*(.+)/;
const PROBLEM_LECTURE = /^Problem\s+(\d+\.\d+[a-z]?):?\s*(.*)/i;
const PROBLEM_WORKSHEET = /^Problem\s+(\d+)\):?\s*(.*)/i;
const FIGURE = /^Figure\s+\d+\./i;
const CHART_JUNK = /^[\d\s.]+$/;

function isHeadingParagraph(text: string, fontSize: number, maxFont: number): boolean {
  return fontSize >= maxFont * 0.95 && text.length < 80 && !NUMBERED_TOPIC.test(text);
}

function mergeLinesToParagraphs(lines: PdfLine[]): Array<{ text: string; fontSize: number }> {
  const paragraphs: Array<{ text: string; fontSize: number }> = [];

  for (const line of lines) {
    const text = line.text.trim();
    if (!text || FOOTER.test(text) || CHART_JUNK.test(text)) continue;
    if (COURSE_HEADER.test(text)) continue;

    const prev = paragraphs.at(-1);
    const newBlock =
      !prev ||
      line.gapAbove > 18 ||
      NUMBERED_TOPIC.test(text) ||
      PROBLEM_LECTURE.test(text) ||
      PROBLEM_WORKSHEET.test(text) ||
      /^Homework$/i.test(text) ||
      FIGURE.test(text) ||
      text.startsWith("•");

    if (newBlock) {
      paragraphs.push({ text, fontSize: line.fontSize });
    } else {
      prev.text = `${prev.text} ${text}`;
    }
  }

  return paragraphs;
}

export function parseHandoutLines(
  lines: PdfLine[],
  kind: HandoutKind,
  sourceUrl: string,
): UnitHandoutContent {
  const paragraphs = mergeLinesToParagraphs(lines);
  const maxFont = Math.max(...paragraphs.map((p) => p.fontSize), 12);

  let title = kind === "lecture" ? "Lecture notes" : "Practice worksheet";
  const topics: HandoutTopic[] = [];
  const problems: HandoutProblem[] = [];
  const bullets: string[] = [];
  const figures: string[] = [];
  let summary: string | undefined;
  let inHomework = false;

  for (const { text, fontSize } of paragraphs) {
    if (/^Homework$/i.test(text)) {
      inHomework = true;
      continue;
    }

    if (isHeadingParagraph(text, fontSize, maxFont) && /unit\s+\d+/i.test(text)) {
      title = text;
      continue;
    }

    if (isHeadingParagraph(text, fontSize, maxFont) && text.length > 8) {
      if (
        (title === "Lecture notes" || title === "Practice worksheet") &&
        !COURSE_HEADER.test(text)
      ) {
        title = text;
      }
      continue;
    }

    if (FIGURE.test(text)) {
      figures.push(text);
      continue;
    }

    if (text.startsWith("•")) {
      bullets.push(text.replace(/^•\s*/, ""));
      continue;
    }

    const topicMatch = text.match(NUMBERED_TOPIC);
    if (topicMatch && kind === "lecture") {
      const topicText = formatHandoutText(topicMatch[2]);
      topics.push({ label: topicMatch[1], text: topicText });
      if (!summary && topicText.length > 40) summary = topicText;
      continue;
    }

    const lectureProblem = text.match(PROBLEM_LECTURE);
    if (lectureProblem) {
      problems.push({
        label: `Problem ${lectureProblem[1]}`,
        text: lectureProblem[2].trim() || text,
      });
      continue;
    }

    const worksheetProblem = text.match(PROBLEM_WORKSHEET);
    if (worksheetProblem) {
      problems.push({
        label: `Problem ${worksheetProblem[1]}`,
        text: worksheetProblem[2].trim() || text,
      });
      continue;
    }

    if (inHomework || kind === "worksheet") {
      if (
        problems.length === 0 &&
        !summary &&
        text.length > 40 &&
        !isBoilerplateHandoutText(text)
      ) {
        summary = text;
      }
      if (problems.length > 0) {
        problems[problems.length - 1].text += ` ${text}`;
      }
    } else if (!summary && text.length > 40 && !isBoilerplateHandoutText(text)) {
      summary = text;
    }
  }

  return {
    title: formatHandoutText(title),
    kind,
    sourceUrl,
    summary: summary && !isBoilerplateHandoutText(summary)
      ? formatHandoutText(summary)
      : undefined,
    topics,
    problems: problems.map((problem) => ({
      ...problem,
      text: formatHandoutText(problem.text),
    })),
    bullets: bullets.map(formatHandoutText),
    figures: figures.map(formatHandoutText),
  };
}
