/**
 * OCR orchestrator for achievement titles.
 * Tries Alt1 first, then Tesseract fallback.
 * To remove Tesseract later: delete tesseract_fallback.ts and the fallback call below.
 */
import { readTitleWithAlt1 } from "./alt1_reader.js";
import { readTitleWithTesseract } from "./tesseract_fallback.js";

function normalizeParsedLine(text: string): string {
  let out = text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/%:,.+\-()[\]&]/g, "")
    .trim();
  // Strip trailing OCR artifact "bY"/"by" from tooltip description bleed
  out = out.replace(/\s+b[Yy]\s*$/i, "").trim();
  // Strip leading garbage: extract "AREA SET TASKS - DIFFICULTY" when present (non-greedy prefix)
  const taskMatch = out.match(/.*?(\w+\s+SET\s+TASKS\s+-\s+(?:EASY|MEDIUM|HARD|ELITE))/i);
  if (taskMatch) out = taskMatch[1];
  // Strip trailing bracket artifacts (OCR misreads at title/description boundary)
  out = out.replace(/[\[\]\s]+$/, "").trim();
  return out;
}

export type ReadTitleResult = {
  text: string;
  source: string;
  debug?: Record<string, unknown>;
};

export async function readTitleFromImage(
  image: ImageData,
  bindFallback?: { bindId: number; localX: number; localY: number },
): Promise<ReadTitleResult> {
  const alt1Result = readTitleWithAlt1(image, bindFallback);
  if (alt1Result.text) {
    return { ...alt1Result, text: normalizeParsedLine(alt1Result.text) };
  }

  const tesseractText = await readTitleWithTesseract(image);
  if (tesseractText) {
    return { text: normalizeParsedLine(tesseractText), source: "tesseract" };
  }

  return { text: "", source: "none", debug: alt1Result.debug };
}
