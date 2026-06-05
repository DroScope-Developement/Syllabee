import nlp from "compromise";
import { sylabiCatalogSubjects } from "../../data/sylabiCatalog";
import type { ProfessorInfo, UniversityInfo } from "../../types/course";
import type { PdfLine } from "./types";

export interface SyllabusMetadataOptions {
  fileName?: string;
  /** Folder subject from syllabus library (preferred display name when set). */
  catalogSubject?: string;
  /** Human-readable title from syllabus catalog manifest. */
  catalogTitle?: string;
}

const GENERIC_TITLE =
  /^(?:syllabus(?:\s+for)?|course\s+information|course\s+description|course\s+implementation|course\s+outline|official\s+undergraduate|instructor\s+contact|sample\s+syllabus|subject\s*\(|class\s*[–-]|cbse|paper\s*-|block\s*-|academic\s+year|isbn|textbook|grading|attendance|office\s+hours|university\s+policies|tips\s+for|some\s+best\s+practices|service-learning|healthcare\s+foundations|uhmc|loyola|bloomsburg|st\.\s*petersburg|texas\s+a&m)/i;

const SKIP_TITLE =
  /^(?:syllabus|material|instructors|class meetings|exams|homework|grading|course information|course description|table of contents)$/i;

const COURSE_CODE = /\b([A-Z]{2,5}\s*\d{1,4}[A-Z]?)\b/;

const INSTRUCTOR_LABEL =
  /(?:instructor|professor|faculty|lecturer|teacher|prepared by|taught by)s?\s*[:\-–—]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){0,3})/i;

const UNIVERSITY_ORG =
  /\b(?:[A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,6}\s+(?:University|College|Institute|Polytechnic|Academy))\b(?:\s+of\s+[A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,4})?/;

const PERSON_BLOCKLIST =
  /^(?:fall|spring|summer|winter|monday|tuesday|wednesday|thursday|friday|saturday|sunday|office|hours|course|syllabus|department|university|college|class|section|chapter|unit|week|final|midterm|january|february|march|april|may|june|july|august|september|october|november|december)$/i;

const KNOWN_UNIVERSITY_LOGOS: Record<string, string> = {
  "harvard university": "/universities/harvard.svg",
};

function displayCatalogSubject(raw: string): string {
  return raw === "_unclassified" ? "General" : raw;
}

function humanizeCatalogTitle(title: string): string {
  return normalizeWhitespace(title.replace(/_/g, " "));
}

function manifestCatalogTitle(options?: SyllabusMetadataOptions): string | undefined {
  if (!options?.catalogTitle) return undefined;
  const humanized = humanizeCatalogTitle(options.catalogTitle);
  return humanized && !isGenericTitle(humanized) ? humanized : undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isGenericTitle(title: string): boolean {
  const normalized = normalizeWhitespace(title);
  if (normalized.length < 3) return true;
  if (GENERIC_TITLE.test(normalized)) return true;
  if (/^[\d\s.:;,\-–—/|]+$/.test(normalized)) return true;
  if (/^[\u0080-\uFFFF\s]+$/.test(normalized) && normalized.length < 20) return true;
  return false;
}

function simplifySubjectTitle(title: string): string {
  let value = normalizeWhitespace(title);

  const introMatch = value.match(
    /^(?:introduction to|principles of|fundamentals of|survey of|overview of)\s+(.+)$/i,
  );
  if (introMatch) value = introMatch[1];

  value = value
    .replace(/\bsyllabus\b/gi, "")
    .replace(/\bcommon course syllabus for\b/gi, "")
    .replace(/\bsample syllabus\b/gi, "")
    .replace(/\bsubject to change\b/gi, "")
    .replace(/\b(?:fall|spring|summer|winter)\s+\d{4}\b/gi, "")
    .replace(/\b[A-Z]{2,5}\s*\d{1,4}[A-Z]?\b/g, "")
    .replace(/^[|/\-–—,:;\s]+|[|/\-–—,:;\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return value;
}

function titleScore(title: string): number {
  const words = title.split(/\s+/).filter(Boolean);
  let score = 0;

  if (words.length >= 1 && words.length <= 5) score += 8;
  else if (words.length <= 8) score += 4;
  else score -= words.length;

  if (isGenericTitle(title)) score -= 50;
  if (/[|]/.test(title)) score -= 4;
  if (/\d{4}/.test(title)) score -= 3;
  if (COURSE_CODE.test(title)) score -= 2;

  for (const subject of sylabiCatalogSubjects) {
    if (subject === "_unclassified") continue;
    if (new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(title)) {
      score += 12;
    }
  }

  return score;
}

function matchKnownSubject(text: string): string | undefined {
  const haystack = text.toLowerCase();
  let best: { subject: string; score: number } | undefined;

  for (const subject of sylabiCatalogSubjects) {
    if (subject === "_unclassified") continue;
    const needle = subject.toLowerCase();
    const index = haystack.indexOf(needle);
    if (index === -1) continue;

    const score = subject.length + (index < 500 ? 20 : 0);
    if (!best || score > best.score) {
      best = { subject, score };
    }
  }

  return best?.subject;
}

function extractSubjectFromPatterns(text: string): string | undefined {
  const patterns = [
    /\b(?:course|subject|class)\s*(?:name|title)?\s*[:\-–—]\s*([^\n|]{3,80})/i,
    /\b(?:syllabus for)\s+([^\n|]{3,80})/i,
    /\b(?:common course syllabus for)\s+([^,\n|]{3,80})/i,
    /\|\s*([A-Za-z][A-Za-z0-9 &/.'-]{2,60})\s*(?:\||$)/,
    /\b([A-Za-z][A-Za-z0-9 &/.'-]{2,60})\s+syllabus\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const candidate = simplifySubjectTitle(match[1]);
    if (!isGenericTitle(candidate) && candidate.length >= 3) {
      return candidate;
    }
  }

  return undefined;
}

function headerLines(lines: PdfLine[], max = 30): string[] {
  return lines
    .slice(0, max)
    .map((line) => normalizeWhitespace(line.text))
    .filter(Boolean);
}

function inferTitleFromLayout(lines: PdfLine[]): string | undefined {
  for (const text of headerLines(lines)) {
    if (SKIP_TITLE.test(text) || isGenericTitle(text)) continue;
    if (text.length >= 3 && text.length <= 64 && !text.includes("@")) {
      return text;
    }
  }
  return undefined;
}

export function inferCourseDisplayTitle(
  lines: PdfLine[],
  options?: SyllabusMetadataOptions,
): string {
  const manifestTitle = manifestCatalogTitle(options);

  if (options?.catalogSubject && options.catalogSubject !== "_unclassified") {
    return displayCatalogSubject(options.catalogSubject);
  }

  if (manifestTitle && options?.catalogSubject === "_unclassified") {
    return manifestTitle;
  }

  const headerText = headerLines(lines).join("\n");

  const patternSubject = extractSubjectFromPatterns(headerText);
  if (patternSubject) return simplifySubjectTitle(patternSubject);

  const layoutTitle = inferTitleFromLayout(lines);
  if (layoutTitle && !isGenericTitle(layoutTitle)) {
    return simplifySubjectTitle(layoutTitle);
  }

  const knownSubject = matchKnownSubject(headerText);
  if (knownSubject) return knownSubject;

  const text = lines.map((line) => line.text).join("\n");
  const candidates = new Map<string, number>();

  const addCandidate = (raw: string) => {
    const simplified = simplifySubjectTitle(raw);
    if (!simplified || isGenericTitle(simplified)) return;
    const score = titleScore(simplified);
    candidates.set(simplified, Math.max(candidates.get(simplified) ?? -Infinity, score));
  };

  for (const line of headerLines(lines, 40)) addCandidate(line);

  const doc = nlp(headerText);
  for (const topic of doc.topics().out("array") as string[]) addCandidate(topic);

  const codeLine = headerLines(lines).find((line) => COURSE_CODE.test(line));
  if (codeLine) {
    const afterCode = codeLine.replace(COURSE_CODE, "").replace(/^[|/\-–—:\s]+/, "");
    if (afterCode) addCandidate(afterCode);
  }

  let bestTitle = "";
  let bestScore = -Infinity;
  for (const [title, score] of candidates) {
    if (score > bestScore) {
      bestScore = score;
      bestTitle = title;
    }
  }

  if (bestTitle) return bestTitle;

  const bodySubject = matchKnownSubject(text.slice(0, 4000));
  if (bodySubject) return bodySubject;

  if (manifestTitle) return manifestTitle;

  if (options?.fileName) {
    const fromFile = options.fileName
      .replace(/\.pdf$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\bsyllabus\b/gi, "")
      .trim();
    if (fromFile && !isGenericTitle(fromFile)) {
      return simplifySubjectTitle(fromFile);
    }
  }

  return "General";
}

function normalizeUniversityName(name: string): string {
  return normalizeWhitespace(name.replace(/\s*,\s*(?:Inc\.?|LLC)$/i, ""));
}

function scoreUniversity(name: string, index: number): number {
  let score = 0;
  if (/university|college|institute|polytechnic|academy/i.test(name)) score += 20;
  if (index < 15) score += 8;
  if (name.length >= 8 && name.length <= 60) score += 4;
  if (/department|school of|division of/i.test(name)) score -= 6;
  return score;
}

function universityFromEmail(text: string): UniversityInfo | undefined {
  const match = text.match(/@([a-z0-9-]+)\.(edu|ac\.[a-z]{2})/i);
  if (!match) return undefined;

  const domain = match[1].replace(/-/g, " ");
  const words = domain.split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;

  const name = `${words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} University`;
  const key = name.toLowerCase();
  return {
    name,
    logoUrl: KNOWN_UNIVERSITY_LOGOS[key],
  };
}

function extractUniversities(text: string): UniversityInfo[] {
  const results: UniversityInfo[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const name = normalizeUniversityName(raw);
    const key = name.toLowerCase();
    if (seen.has(key) || name.length < 6) return;
    seen.add(key);
    results.push({
      name,
      logoUrl: KNOWN_UNIVERSITY_LOGOS[key],
    });
  };

  const regexMatches = [...text.matchAll(new RegExp(UNIVERSITY_ORG.source, "g"))];
  regexMatches.forEach((match) => add(match[0]));

  const doc = nlp(text.slice(0, 10000));
  for (const org of doc.organizations().out("array") as string[]) {
    if (/university|college|institute|polytechnic|academy|school/i.test(org)) {
      add(org);
    }
  }

  const fromEmail = universityFromEmail(text);
  if (fromEmail && !seen.has(fromEmail.name.toLowerCase())) {
    results.push(fromEmail);
  }

  return results.sort(
    (a, b) =>
      scoreUniversity(b.name, 0) - scoreUniversity(a.name, 0) ||
      a.name.length - b.name.length,
  );
}

function isPlausiblePerson(name: string): boolean {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  if (parts.some((part) => PERSON_BLOCKLIST.test(part))) return false;
  if (!/^[A-Z]/.test(parts[0])) return false;
  return parts.every((part) => /^[A-Z][a-z'.-]+$/.test(part) || /^[A-Z]\.$/.test(part));
}

function extractProfessor(text: string): ProfessorInfo | undefined {
  const header = text.slice(0, 6000);

  const labelMatch = header.match(INSTRUCTOR_LABEL);
  if (labelMatch?.[1] && isPlausiblePerson(labelMatch[1])) {
    return { name: normalizeWhitespace(labelMatch[1]) };
  }

  const labeledLines = header
    .split("\n")
    .filter((line) => /instructor|professor|faculty|lecturer|prepared by/i.test(line));

  for (const line of labeledLines) {
    const doc = nlp(line);
    for (const person of doc.people().out("array") as string[]) {
      if (isPlausiblePerson(person)) {
        return { name: normalizeWhitespace(person) };
      }
    }
  }

  const doc = nlp(header);
  for (const person of doc.people().out("array") as string[]) {
    if (isPlausiblePerson(person)) {
      return { name: normalizeWhitespace(person) };
    }
  }

  const emailMatch = header.match(
    /([a-z]+)\.([a-z]+)@[a-z0-9.-]+\.(edu|ac\.[a-z]{2})/i,
  );
  if (emailMatch) {
    const name = `${emailMatch[1].charAt(0).toUpperCase()}${emailMatch[1].slice(1)} ${emailMatch[2].charAt(0).toUpperCase()}${emailMatch[2].slice(1)}`;
    if (isPlausiblePerson(name)) return { name };
  }

  return undefined;
}

export function extractSyllabusMetadata(
  lines: PdfLine[],
  options?: SyllabusMetadataOptions,
): {
  courseTitle: string;
  university?: UniversityInfo;
  professor?: ProfessorInfo;
} {
  const text = lines.map((line) => line.text).join("\n");
  const header = lines
    .filter((line) => line.page <= 2)
    .map((line) => line.text)
    .join("\n");

  const universities = extractUniversities(`${header}\n${text.slice(0, 8000)}`);
  const professor = extractProfessor(header);

  return {
    courseTitle: inferCourseDisplayTitle(lines, options),
    university: universities[0],
    professor,
  };
}

/** @deprecated Use extractSyllabusMetadata */
export function inferInstitutionFromLines(lines: PdfLine[]): {
  university?: UniversityInfo;
  professor?: ProfessorInfo;
} {
  const { university, professor } = extractSyllabusMetadata(lines);
  return { university, professor };
}

export function professorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const DEFAULT_UNIVERSITY_LOGO = "/universities/default.svg";
