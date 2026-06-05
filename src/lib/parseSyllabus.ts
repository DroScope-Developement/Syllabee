import type {
  SyllabusOutlineData,
  SyllabusSection,
  SyllabusSubpoint,
} from "../types/syllabus";
import { parseSyllabusText } from "./pdf/parsePdfDocument";
import { SyllabusParseError } from "./syllabusErrors";

export { SyllabusParseError } from "./syllabusErrors";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSubpoint(value: unknown, path: string): SyllabusSubpoint {
  if (!isRecord(value)) {
    throw new SyllabusParseError(`${path} must be an object.`);
  }

  if (typeof value.id !== "string" || !value.id.trim()) {
    throw new SyllabusParseError(`${path}.id must be a non-empty string.`);
  }

  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new SyllabusParseError(`${path}.title must be a non-empty string.`);
  }

  const subpoint: SyllabusSubpoint = {
    id: value.id.trim(),
    title: value.title.trim(),
  };

  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) {
      throw new SyllabusParseError(`${path}.children must be an array.`);
    }
    subpoint.children = value.children.map((child, index) =>
      parseSubpoint(child, `${path}.children[${index}]`),
    );
  }

  return subpoint;
}

function parseSection(value: unknown, index: number): SyllabusSection {
  const path = `sections[${index}]`;

  if (!isRecord(value)) {
    throw new SyllabusParseError(`${path} must be an object.`);
  }

  if (typeof value.id !== "string" || !value.id.trim()) {
    throw new SyllabusParseError(`${path}.id must be a non-empty string.`);
  }

  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new SyllabusParseError(`${path}.title must be a non-empty string.`);
  }

  if (!Array.isArray(value.subpoints)) {
    throw new SyllabusParseError(`${path}.subpoints must be an array.`);
  }

  if (value.subpoints.length === 0) {
    throw new SyllabusParseError(`${path}.subpoints must contain at least one topic.`);
  }

  const section: SyllabusSection = {
    id: value.id.trim(),
    title: value.title.trim(),
    subpoints: value.subpoints.map((subpoint, subIndex) =>
      parseSubpoint(subpoint, `${path}.subpoints[${subIndex}]`),
    ),
  };

  if (value.description !== undefined) {
    if (typeof value.description !== "string") {
      throw new SyllabusParseError(`${path}.description must be a string.`);
    }
    section.description = value.description.trim();
  }

  return section;
}

/** Validates and parses raw JSON into a SyllabusOutlineData object. */
export function parseSyllabusJson(raw: unknown): SyllabusOutlineData {
  if (!isRecord(raw)) {
    throw new SyllabusParseError("Syllabus JSON must be an object.");
  }

  if (typeof raw.courseTitle !== "string" || !raw.courseTitle.trim()) {
    throw new SyllabusParseError("courseTitle must be a non-empty string.");
  }

  if (!Array.isArray(raw.sections)) {
    throw new SyllabusParseError("sections must be an array.");
  }

  if (raw.sections.length === 0) {
    throw new SyllabusParseError("sections must contain at least one unit.");
  }

  const data: SyllabusOutlineData = {
    courseTitle: raw.courseTitle.trim(),
    sections: raw.sections.map(parseSection),
  };

  if (raw.courseCode !== undefined) {
    if (typeof raw.courseCode !== "string") {
      throw new SyllabusParseError("courseCode must be a string.");
    }
    data.courseCode = raw.courseCode.trim();
  }

  if (raw.term !== undefined) {
    if (typeof raw.term !== "string") {
      throw new SyllabusParseError("term must be a string.");
    }
    data.term = raw.term.trim();
  }

  return data;
}

/**
 * Parses an uploaded PDF using layout-aware text extraction.
 * **Plug in a backend / LLM here** to replace or augment parsePdfLines().
 */
export async function parseSyllabusPdf(file: File): Promise<SyllabusOutlineData> {
  const { extractPdfLines } = await import("./pdf/extractPdfLines");
  const { parsePdfLines } = await import("./pdf/parsePdfDocument");

  const lines = await extractPdfLines(file);
  return parsePdfLines(lines, { fileName: file.name });
}

/** Reads an uploaded syllabus file (.pdf or .json) and returns parsed data. */
export async function parseSyllabusFile(file: File): Promise<SyllabusOutlineData> {
  const lowerName = file.name.toLowerCase();
  const isPdf =
    lowerName.endsWith(".pdf") || file.type === "application/pdf";
  const isJson =
    lowerName.endsWith(".json") || file.type === "application/json";

  if (isPdf) {
    return parseSyllabusPdf(file);
  }

  if (isJson) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      throw new SyllabusParseError("Could not read the uploaded file.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SyllabusParseError("File is not valid JSON.");
    }

    return parseSyllabusJson(parsed);
  }

  throw new SyllabusParseError(
    "Unsupported file type. Upload a .pdf or .json syllabus.",
  );
}

function isPdfFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
  );
}

/** User-facing status message while a syllabus file is being processed. */
export function syllabusUploadStatus(file: File): string {
  if (isPdfFile(file)) {
    return "Reading PDF layout and building outline…";
  }
  return "Parsing syllabus…";
}

/** Plain-text path (no layout metadata) — delegates to the same document parser. */
export { parseSyllabusText };
