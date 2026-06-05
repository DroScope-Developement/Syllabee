import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const lines = [
  "Introduction to Computer Science",
  "CS 101 · Spring 2026",
  "",
  "Week 1 — Computing & Problem Solving",
  "- History of computing and abstraction",
  "- Algorithms and pseudocode",
  "- Introductory Python syntax",
  "",
  "Week 2 — Data & Control Flow",
  "- Variables, types, and expressions",
  "- Conditional statements",
  "- For and while loops",
  "",
  "Week 3 — Functions & Decomposition",
  "- Defining and calling functions",
  "- Parameters, return values, and scope",
  "- Recursion basics",
  "",
  "Week 4 — Data Structures",
  "- Lists and list comprehensions",
  "- Dictionaries and sets",
  "- Big-O notation introduction",
];

const pdfDoc = await PDFDocument.create();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
const fontSize = 12;
const lineHeight = 18;
const margin = 50;
const pageHeight = 792;
let page = pdfDoc.addPage([612, pageHeight]);
let y = pageHeight - margin;

for (const line of lines) {
  if (y < margin) {
    page = pdfDoc.addPage([612, pageHeight]);
    y = pageHeight - margin;
  }
  page.drawText(line, { x: margin, y, size: fontSize, font });
  y -= lineHeight;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/fixtures");
const bytes = await pdfDoc.save();
writeFileSync(join(outDir, "cs101-syllabus.pdf"), bytes);
console.log("Wrote public/fixtures/cs101-syllabus.pdf");
