/** A single text fragment from a PDF page with layout metadata. */
export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

/** A reconstructed logical line of text on a PDF page. */
export interface PdfLine {
  page: number;
  y: number;
  x: number;
  fontSize: number;
  text: string;
  items: PdfTextItem[];
  gapAbove: number;
  wordCount: number;
}

/** Relative prominence tier derived from document typography (not fixed sizes). */
export type LineTier = "title" | "heading" | "body" | "minor";

/** Vertical gap multiplier used to detect section boundaries. */
export const LINE_GAP_LARGE = 1.6;

export interface ClassifiedLine extends PdfLine {
  tier: LineTier;
  isProse: boolean;
}

export interface OutlineBlock {
  lines: ClassifiedLine[];
  /** True when each line is its own section (schedule rows). */
  flatSchedule: boolean;
}
