import type { PdfLine } from "./pdf/types";

export interface UniversityInfo {
  name: string;
  logoUrl?: string;
}

export interface ProfessorInfo {
  name: string;
  photoUrl?: string;
}

const KNOWN_UNIVERSITIES: Array<{
  pattern: RegExp;
  name: string;
  logoUrl: string;
}> = [
  {
    pattern: /harvard\s+(?:university|college)/i,
    name: "Harvard University",
    logoUrl: "/universities/harvard.svg",
  },
  {
    pattern: /harvard\.edu/i,
    name: "Harvard University",
    logoUrl: "/universities/harvard.svg",
  },
];

const KNOWN_PROFESSORS: Array<{
  pattern: RegExp;
  name: string;
}> = [
  { pattern: /oliver\s+knill/i, name: "Oliver Knill" },
  { pattern: /prof\.?\s+oliver\s+knill/i, name: "Oliver Knill" },
];

const INSTRUCTOR_LINE =
  /(?:instructor|professor|faculty|taught by|lecturer)s?[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i;

export function inferInstitutionFromLines(
  lines: PdfLine[],
): { university?: UniversityInfo; professor?: ProfessorInfo } {
  const text = lines.map((line) => line.text).join("\n");

  let university: UniversityInfo | undefined;
  for (const entry of KNOWN_UNIVERSITIES) {
    if (entry.pattern.test(text)) {
      university = { name: entry.name, logoUrl: entry.logoUrl };
      break;
    }
  }

  let professor: ProfessorInfo | undefined;
  for (const entry of KNOWN_PROFESSORS) {
    if (entry.pattern.test(text)) {
      professor = { name: entry.name };
      break;
    }
  }

  if (!professor) {
    const instructorMatch = text.match(INSTRUCTOR_LINE);
    if (instructorMatch) {
      professor = { name: instructorMatch[1].trim() };
    }
  }

  if (!professor) {
    const emailMatch = text.match(/([a-z]+)@math\.harvard\.edu/i);
    if (emailMatch?.[1] === "knill") {
      professor = { name: "Oliver Knill" };
    }
  }

  if (!university && /harvard/i.test(text)) {
    university = {
      name: "Harvard University",
      logoUrl: "/universities/harvard.svg",
    };
  }

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
