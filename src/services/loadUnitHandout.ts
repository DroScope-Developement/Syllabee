import { sanitizeHandoutContent } from "../lib/pdf/formatHandoutText";
import type { HandoutKind, UnitHandoutContent } from "../lib/pdf/parseHandoutContent";
import { parseHandoutLines } from "../lib/pdf/parseHandoutContent";
import { extractPdfLinesFromData } from "../lib/pdf/extractPdfLines";
import { handoutContentCache } from "../data/prebuilt/handoutContentCache";

const memoryCache = new Map<string, UnitHandoutContent>();

export async function loadUnitHandout(
  url: string,
  kind: HandoutKind,
): Promise<UnitHandoutContent> {
  const cacheKey = `${kind}:${url}`;
  const cached = memoryCache.get(cacheKey) ?? handoutContentCache[url];
  if (cached) {
    const sanitized = sanitizeHandoutContent(cached);
    memoryCache.set(cacheKey, sanitized);
    return sanitized;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load handout (${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  const lines = await extractPdfLinesFromData(buffer);
  const content = sanitizeHandoutContent(parseHandoutLines(lines, kind, url));
  memoryCache.set(cacheKey, content);
  return content;
}

export function peekUnitHandout(url: string): UnitHandoutContent | undefined {
  const cached = handoutContentCache[url];
  return cached ? sanitizeHandoutContent(cached) : undefined;
}
