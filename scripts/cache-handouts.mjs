/**
 * Downloads Harvard Math 1a handouts and writes parsed content to handoutContentCache.ts.
 * Run: npm run cache:handouts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const EXTERNAL_BASE =
  "https://people.math.harvard.edu/~knill/teaching/math1a2024/handouts";
const FETCH_BASE = "/harvard-handouts";
const Y_TOLERANCE = 4;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "src/data/prebuilt/handoutContentCache.ts");

const FOOTER = /knill@math\.harvard\.edu/i;
const NUMBERED_TOPIC = /^(\d+\.\d+)\.\s*(.+)/;
const PROBLEM_LECTURE = /^Problem\s+(\d+\.\d+[a-z]?):?\s*(.*)/i;
const PROBLEM_WORKSHEET = /^Problem\s+(\d+)\):?\s*(.*)/i;
const FIGURE = /^Figure\s+\d+\./i;
const CHART_JUNK = /^[\d\s.]+$/;

function itemsToLines(pageNum, items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rawLines = [];

  for (const item of sorted) {
    if (!item.text.trim()) continue;
    const existing = rawLines.find((line) => Math.abs(line.y - item.y) <= Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
      existing.y = (existing.y + item.y) / 2;
    } else {
      rawLines.push({ y: item.y, items: [item] });
    }
  }

  rawLines.sort((a, b) => b.y - a.y);

  const lines = rawLines.map((raw) => {
    raw.items.sort((a, b) => a.x - b.x);
    const text = raw.items
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      page: pageNum,
      y: raw.y,
      fontSize: Math.max(...raw.items.map((item) => item.fontSize)),
      text,
      gapAbove: 0,
    };
  });

  for (let i = 1; i < lines.length; i++) {
    lines[i].gapAbove = lines[i - 1].y - lines[i].y;
  }

  return lines;
}

function isHeadingParagraph(text, fontSize, maxFont) {
  return fontSize >= maxFont * 0.95 && text.length < 80 && !NUMBERED_TOPIC.test(text);
}

function mergeLinesToParagraphs(lines) {
  const paragraphs = [];

  for (const line of lines) {
    const text = line.text.trim();
    if (!text || FOOTER.test(text) || CHART_JUNK.test(text)) continue;

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

function parseHandoutLines(lines, kind, sourceUrl) {
  const paragraphs = mergeLinesToParagraphs(lines);
  const maxFont = Math.max(...paragraphs.map((p) => p.fontSize), 12);

  let title = kind === "lecture" ? "Lecture notes" : "Practice worksheet";
  const topics = [];
  const problems = [];
  const bullets = [];
  const figures = [];
  let summary;
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
      if (title === "Lecture notes" || title === "Practice worksheet") {
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
      topics.push({ label: topicMatch[1], text: topicMatch[2].trim() });
      if (!summary) summary = topicMatch[2].trim();
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
      if (problems.length === 0 && !summary) summary = text;
      if (problems.length > 0) {
        problems[problems.length - 1].text += ` ${text}`;
      }
    } else if (!summary && text.length > 40) {
      summary = text;
    }
  }

  return { title, kind, sourceUrl, summary, topics, problems, bullets, figures };
}

async function loadPdfLines(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed ${url}: ${response.status}`);
  }
  const data = new Uint8Array(await response.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => "str" in item)
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        fontSize: Math.hypot(item.transform[0], item.transform[1]),
      }));
    allLines.push(...itemsToLines(pageNum, items));
  }

  return allLines;
}

const cache = {};

for (let number = 0; number <= 35; number++) {
  const padded = String(number).padStart(2, "0");

  for (const kind of ["lecture", "worksheet"]) {
    if (kind === "worksheet" && number === 0) continue;

    const file = `${kind}${padded}.pdf`;
    const fetchPath = `${FETCH_BASE}/${file}`;
    const url = `${EXTERNAL_BASE}/${file}`;

    process.stdout.write(`Parsing ${file}… `);
    try {
      const lines = await loadPdfLines(url);
      cache[fetchPath] = parseHandoutLines(lines, kind, url);
      console.log("ok");
    } catch (error) {
      console.log("failed", error.message);
    }
  }
}

const fileContents = `/** Auto-generated by npm run cache:handouts — do not edit manually. */
import type { UnitHandoutContent } from "../../lib/pdf/parseHandoutContent";

export const handoutContentCache: Record<string, UnitHandoutContent> = ${JSON.stringify(cache, null, 2)};
`;

writeFileSync(outFile, fileContents);
console.log(`Wrote ${Object.keys(cache).length} entries to ${outFile}`);
